package io.github.aahh.mediamanager2.tv.ui.signin

import android.animation.ValueAnimator
import android.content.Context
import android.content.res.AssetManager
import android.opengl.GLES30
import android.opengl.GLSurfaceView
import android.util.Log
import android.view.Choreographer
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import java.nio.ByteBuffer
import java.nio.ByteOrder
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin

/** What the planet shows: idle on a form, checking while the app waits on the server, success once signed in. */
enum class PlanetState { Idle, Checking, Success }

/**
 * The sign-in planet behind the address and link-code screens: `src/client/signInPlanet.ts` ported to OpenGL ES 3.0. The
 * shader is the desktop's text, in `assets/signin/`. When Android's animator duration scale is 0 it draws one still
 * frame and jumps between states, as the desktop does for reduced motion.
 */
@Composable
fun Planet(state: PlanetState, modifier: Modifier = Modifier) {
    AndroidView(factory = ::PlanetView, modifier = modifier, update = { it.setState(state) })
}

// Every constant below is copied from signInPlanet.ts; a change there is made here too.
private const val JETS = 4f
private const val FLOW = 1f
private const val WARP = 1f
private const val VORTEX = 1f
private const val CONTRAST = 0.8f
private const val SPIN = 90.0
private const val GRAIN = 0.05f
internal const val RES = 0.5f
private const val START = 40.0
private val STOPS = intArrayOf(0x0b0d13, 0x1c2230, 0x3a4253, 0x6a7079, 0xa7a59c, 0xe2ddcf)
private const val ACCENT = 0x93c4d4
private const val EL = 19.47

private const val AZ = 0
private const val ZOOM = 1
private const val ORDER = 2
private const val GREEN = 3
private val TARGET = mapOf(
    PlanetState.Idle to doubleArrayOf(30.0, 1.0, 0.0, 0.0),
    PlanetState.Checking to doubleArrayOf(165.0, 1.06, 0.0, 0.0),
    PlanetState.Success to doubleArrayOf(165.0, 1.06, 1.0, 1.0),
)
private val DUR = mapOf(
    PlanetState.Idle to doubleArrayOf(0.7, 0.7, 0.7, 0.7),
    PlanetState.Checking to doubleArrayOf(4.0, 4.0, 0.6, 0.6),
    PlanetState.Success to doubleArrayOf(1.7, 1.7, 1.7, 1.7),
)
private const val GREEN_DELAY = 0.5

internal fun ease(x: Double): Double = when {
    x <= 0 -> 0.0
    x >= 1 -> 1.0
    x < 0.5 -> 4 * x * x * x
    else -> 1 - (-2 * x + 2).pow(3) / 2
}

/** The uniforms that change per frame. */
internal data class PlanetFrame(
    val lx: Float, val ly: Float, val lz: Float,
    val zoom: Float, val order: Float, val green: Float, val twist: Float,
    val tc: Float, val rot: Float, val eddyLon: Float,
)

/** The state tweens and per-frame values of signInPlanet.ts, with time [t] in seconds since the planet started. */
internal class PlanetMotion(private val reducedMotion: Boolean) {
    /** A phone-width screen, where the light swings down-left; never true on a TV, kept for parity. */
    var narrow = false
    private val from = TARGET.getValue(PlanetState.Idle).copyOf()
    private val to = TARGET.getValue(PlanetState.Idle).copyOf()
    private val t0 = DoubleArray(4)
    private val dur = DoubleArray(4) { 1.0 }
    var state = PlanetState.Idle
        private set
    private var tCheck: Double? = null
    private var lastChange = -99.0

    private fun target(s: PlanetState, k: Int) = if (k == AZ && s != PlanetState.Idle && narrow) 235.0 else TARGET.getValue(s)[k]

    fun value(k: Int, t: Double) = from[k] + (to[k] - from[k]) * ease((t - t0[k]) / dur[k])

    fun setState(s: PlanetState, t: Double) {
        if (s == state) return
        val instant = reducedMotion
        for (k in 0..3) {
            val delay = if (s == PlanetState.Success && k == GREEN) GREEN_DELAY else 0.0
            from[k] = if (instant) target(s, k) else value(k, t)
            to[k] = target(s, k)
            t0[k] = t + if (instant) 0.0 else delay
            dur[k] = if (instant) 1e-6 else DUR.getValue(s)[k]
        }
        if (s == PlanetState.Checking && tCheck == null) tCheck = t
        state = s
        lastChange = t
    }

    /** Full frame rate through the success change and for 1 s after any other; otherwise a 24 fps step. */
    fun fast(t: Double) = t - lastChange < (if (state == PlanetState.Success) 1.7 + GREEN_DELAY + 1 else 1.0)

    fun frame(t: Double): PlanetFrame {
        val tc = START + t
        val twist = tCheck?.let { 0.12 * min(max(0.0, t - it), 40.0) } ?: 0.0
        val az = value(AZ, t) * PI / 180
        val el = EL * PI / 180
        return PlanetFrame(
            (cos(el) * cos(az)).toFloat(), (cos(el) * sin(az)).toFloat(), sin(el).toFloat(),
            value(ZOOM, t).toFloat(), value(ORDER, t).toFloat(), value(GREEN, t).toFloat(), twist.toFloat(),
            tc.toFloat(), ((tc / SPIN) % 1 * 2 * PI).toFloat(), (3.3 - 0.002 * tc * FLOW).toFloat(),
        )
    }
}

/** The 64³ noise volume: smooth (quintic) interpolation of a 16³ lattice from mulberry32(11), wrapping on every axis. */
internal fun planetNoise(): ByteArray {
    val s = 64
    val l = 16
    var a = 11
    val lattice = FloatArray(l * l * l) {
        a += 0x6D2B79F5
        var t = (a xor (a ushr 15)) * (1 or a)
        t = (t + (t xor (t ushr 7)) * (61 or t)) xor t
        (((t xor (t ushr 14)).toLong() and 0xFFFFFFFFL) / 4294967296.0).toFloat()
    }
    fun f(x: Double) = x * x * x * (x * (x * 6 - 15) + 10)
    fun at(x: Int, y: Int, z: Int) = lattice[(z * l + y) * l + x].toDouble()
    fun m(p: Double, q: Double, t: Double) = p + (q - p) * t
    val volume = ByteArray(s * s * s)
    var k = 0
    for (z in 0 until s) for (y in 0 until s) for (x in 0 until s) {
        val gx = x * l.toDouble() / s
        val gy = y * l.toDouble() / s
        val gz = z * l.toDouble() / s
        val x0 = gx.toInt()
        val y0 = gy.toInt()
        val z0 = gz.toInt()
        val u = f(gx - x0)
        val v = f(gy - y0)
        val w = f(gz - z0)
        val x1 = (x0 + 1) % l
        val y1 = (y0 + 1) % l
        val z1 = (z0 + 1) % l
        val value = m(
            m(m(at(x0, y0, z0), at(x1, y0, z0), u), m(at(x0, y1, z0), at(x1, y1, z0), u), v),
            m(m(at(x0, y0, z1), at(x1, y0, z1), u), m(at(x0, y1, z1), at(x1, y1, z1), u), v),
            w,
        )
        volume[k++] = (255 * value).toInt().toByte()
    }
    return volume
}

private const val STEP_MS = 1000.0 / 24

/**
 * The GL view. Frame timing runs on the main thread's Choreographer and asks for a render only when a frame is due, as
 * the desktop's requestAnimationFrame loop does; it stops while the window is hidden. The surface is RES buffer pixels
 * per dp, scaled up by the system.
 */
private class PlanetView(context: Context) : GLSurfaceView(context), Choreographer.FrameCallback {
    private val reducedMotion = !ValueAnimator.areAnimatorsEnabled()
    private val motion = PlanetMotion(reducedMotion)
    private val renderer = PlanetRenderer(context.assets)
    private var running = false
    private var startedAt = 0.0
    private var tBase = 0.0
    private var curT = 0.0
    private var lastDraw = -1e9

    init {
        setEGLContextClientVersion(3)
        setRenderer(renderer)
        renderMode = RENDERMODE_WHEN_DIRTY
        draw(0.0)
    }

    fun setState(state: PlanetState) {
        if (state == motion.state) return
        motion.setState(state, curT)
        if (reducedMotion) draw(curT)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        val density = resources.displayMetrics.density
        holder.setFixedSize(max(1, (w / density * RES).roundToInt()), max(1, (h / density * RES).roundToInt()))
        motion.narrow = w / density < 640
        if (reducedMotion) draw(curT)
    }

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        if (reducedMotion) return
        if (visibility == VISIBLE) start() else stop()
    }

    override fun onDetachedFromWindow() {
        stop()
        super.onDetachedFromWindow()
    }

    private fun start() {
        if (running) return
        running = true
        startedAt = System.nanoTime() / 1e6
        tBase = curT
        Choreographer.getInstance().postFrameCallback(this)
    }

    private fun stop() {
        running = false
        Choreographer.getInstance().removeFrameCallback(this)
    }

    override fun doFrame(frameTimeNanos: Long) {
        if (!running) return
        Choreographer.getInstance().postFrameCallback(this)
        val now = frameTimeNanos / 1e6
        val t = tBase + (now - startedAt) / 1000
        // razor: 24 fps fixed step while idle or checking, as on the desktop; full rate only through a state change.
        if (!motion.fast(t)) {
            if (now - lastDraw < STEP_MS) return
            lastDraw = now - min((now - lastDraw) % STEP_MS, STEP_MS / 2)
        } else {
            lastDraw = now
        }
        draw(t)
    }

    private fun draw(t: Double) {
        curT = t
        renderer.next = motion.frame(t)
        requestRender()
    }
}

private class PlanetRenderer(private val assets: AssetManager) : GLSurfaceView.Renderer {
    @Volatile var next: PlanetFrame? = null
    private var program = 0
    private val uniforms = HashMap<String, Int>()
    private var frameNo = 0

    private fun u(name: String) = uniforms.getOrPut(name) { GLES30.glGetUniformLocation(program, name) }

    override fun onSurfaceCreated(unused: GL10?, config: EGLConfig?) {
        uniforms.clear()
        program = runCatching { build() }.getOrElse {
            // razor: no fallback drawing, as on the desktop; the page ground shows instead.
            Log.w("Planet", "The sign-in planet shader failed to build: the planet is not drawn", it)
            0
        }
        if (program == 0) return
        val texture = IntArray(1)
        GLES30.glGenTextures(1, texture, 0)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_3D, texture[0])
        GLES30.glPixelStorei(GLES30.GL_UNPACK_ALIGNMENT, 1)
        val noise = planetNoise()
        val buffer = ByteBuffer.allocateDirect(noise.size).order(ByteOrder.nativeOrder()).put(noise).also { it.position(0) }
        GLES30.glTexImage3D(GLES30.GL_TEXTURE_3D, 0, GLES30.GL_R8, 64, 64, 64, 0, GLES30.GL_RED, GLES30.GL_UNSIGNED_BYTE, buffer)
        for (p in intArrayOf(GLES30.GL_TEXTURE_MIN_FILTER, GLES30.GL_TEXTURE_MAG_FILTER)) GLES30.glTexParameteri(GLES30.GL_TEXTURE_3D, p, GLES30.GL_LINEAR)
        for (p in intArrayOf(GLES30.GL_TEXTURE_WRAP_S, GLES30.GL_TEXTURE_WRAP_T, GLES30.GL_TEXTURE_WRAP_R)) {
            GLES30.glTexParameteri(GLES30.GL_TEXTURE_3D, p, GLES30.GL_REPEAT)
        }
        GLES30.glUniform1i(u("uNoise"), 0)
        GLES30.glUniform3fv(u("uPal"), STOPS.size, STOPS.flatMap(::rgb).toFloatArray(), 0)
        GLES30.glUniform3fv(u("uAcc"), 1, rgb(ACCENT).toFloatArray(), 0)
        GLES30.glUniform1f(u("uJets"), JETS)
        GLES30.glUniform1f(u("uFlow"), FLOW)
        GLES30.glUniform1f(u("uWarp"), WARP)
        GLES30.glUniform1f(u("uVortex"), VORTEX)
        GLES30.glUniform1f(u("uContrast"), CONTRAST)
        GLES30.glUniform1f(u("uGrain"), GRAIN)
    }

    private fun build(): Int {
        fun shader(type: Int, file: String): Int {
            val id = GLES30.glCreateShader(type)
            GLES30.glShaderSource(id, assets.open("signin/$file").bufferedReader().use { it.readText() })
            GLES30.glCompileShader(id)
            val ok = IntArray(1)
            GLES30.glGetShaderiv(id, GLES30.GL_COMPILE_STATUS, ok, 0)
            check(ok[0] != 0) { GLES30.glGetShaderInfoLog(id) }
            return id
        }
        val id = GLES30.glCreateProgram()
        GLES30.glAttachShader(id, shader(GLES30.GL_VERTEX_SHADER, "planet.vert"))
        GLES30.glAttachShader(id, shader(GLES30.GL_FRAGMENT_SHADER, "planet.frag"))
        GLES30.glBindAttribLocation(id, 0, "p")
        GLES30.glLinkProgram(id)
        val ok = IntArray(1)
        GLES30.glGetProgramiv(id, GLES30.GL_LINK_STATUS, ok, 0)
        check(ok[0] != 0) { GLES30.glGetProgramInfoLog(id) }
        GLES30.glUseProgram(id)
        val vbo = IntArray(1)
        GLES30.glGenBuffers(1, vbo, 0)
        GLES30.glBindBuffer(GLES30.GL_ARRAY_BUFFER, vbo[0])
        val triangle = floatArrayOf(-1f, -1f, 3f, -1f, -1f, 3f)
        val data = ByteBuffer.allocateDirect(triangle.size * 4).order(ByteOrder.nativeOrder()).asFloatBuffer().put(triangle).also { it.position(0) }
        GLES30.glBufferData(GLES30.GL_ARRAY_BUFFER, triangle.size * 4, data, GLES30.GL_STATIC_DRAW)
        GLES30.glEnableVertexAttribArray(0)
        GLES30.glVertexAttribPointer(0, 2, GLES30.GL_FLOAT, false, 0, 0)
        return id
    }

    override fun onSurfaceChanged(unused: GL10?, width: Int, height: Int) {
        GLES30.glViewport(0, 0, width, height)
        if (program == 0) return
        val w = width.toFloat()
        val h = height.toFloat()
        val narrow = w / RES < 640
        GLES30.glUniform2f(u("uRes"), w, h)
        GLES30.glUniform3f(
            u("uGeo"),
            if (narrow) w * 0.62f else w * 0.76f,
            if (narrow) h * 0.3f else h * 0.5f,
            if (narrow) min(w, h) * 0.62f else min(h * 0.66f, w * 0.38f),
        )
    }

    override fun onDrawFrame(unused: GL10?) {
        val frame = next
        if (program == 0 || frame == null) {
            GLES30.glClearColor(7 / 255f, 8 / 255f, 11 / 255f, 1f)
            GLES30.glClear(GLES30.GL_COLOR_BUFFER_BIT)
            return
        }
        GLES30.glUniform3f(u("uL"), frame.lx, frame.ly, frame.lz)
        GLES30.glUniform1f(u("uZoom"), frame.zoom)
        GLES30.glUniform1f(u("uOrder"), frame.order)
        GLES30.glUniform1f(u("uGreen"), frame.green)
        GLES30.glUniform1f(u("uTwist"), frame.twist)
        GLES30.glUniform1f(u("uTc"), frame.tc)
        GLES30.glUniform1f(u("uRot"), frame.rot)
        GLES30.glUniform1f(u("uEddyLon"), frame.eddyLon)
        GLES30.glUniform1f(u("uFrame"), (frameNo++).toFloat())
        GLES30.glDrawArrays(GLES30.GL_TRIANGLES, 0, 3)
    }

    private fun rgb(color: Int) = listOf((color shr 16) and 0xFF, (color shr 8) and 0xFF, color and 0xFF).map { it / 255f }
}
