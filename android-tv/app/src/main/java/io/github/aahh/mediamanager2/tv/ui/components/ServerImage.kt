package io.github.aahh.mediamanager2.tv.ui.components

import android.content.Context
import android.os.SystemClock
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import coil3.ImageLoader
import coil3.compose.AsyncImage
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.crossfade
import coil3.size.Scale
import io.github.aahh.mediamanager2.tv.api.ServerClient

/** The logcat tag of every TV Home timing line (`adb logcat -s HomeTiming`). */
const val TIMING_TAG = "HomeTiming"

/**
 * Pictures from our own server (`/api/images/…`): posters, fanart and Plex list collages. They load through the
 * server client's OkHttp, so they carry the session cookie and keep its https-only rule.
 */
class ServerImages(private val context: Context, private val client: ServerClient) {
    val loader: ImageLoader = ImageLoader.Builder(context)
        .components { add(OkHttpNetworkFetcherFactory(callFactory = { client.http })) }
        .crossfade(true)
        .build()

    /**
     * The full address of a server path, or an https address as given (library posters come straight from TMDB or
     * TheTVDB; the cookie jar sends the session to our server only). Null for anything else.
     */
    fun url(path: String): String? = when {
        path.startsWith("https://") -> path
        path.startsWith("/") && !path.startsWith("//") -> client.url(path).toString()
        else -> null
    }

    /**
     * Loads [path] into the image cache ahead of time, at [width] × [height] pixels, cropped to fill when [fill] or fitted
     * otherwise, through the same loader and address [ServerImage] uses, and logs how long it took under [kind]. Returns
     * whether it loaded.
     */
    suspend fun prefetch(path: String, width: Int, height: Int, fill: Boolean, kind: String): Boolean {
        val url = url(path) ?: return false
        val start = SystemClock.uptimeMillis()
        val request = ImageRequest.Builder(context).data(url).size(width, height).scale(if (fill) Scale.FILL else Scale.FIT).build()
        val ok = loader.execute(request) is SuccessResult
        Log.i(TIMING_TAG, "$kind prefetch ms=${SystemClock.uptimeMillis() - start} ok=$ok path=$path")
        return ok
    }
}

/** Set by the navigation once there is a server; null before then, when pictures show nothing. */
val LocalServerImages = staticCompositionLocalOf<ServerImages?> { null }

/**
 * A picture from our server at [path], filling [modifier]; nothing while it loads, when it fails or when [path] is null.
 * With [timing] set, logs how long the load took from when that path was first composed.
 */
@Composable
fun ServerImage(
    path: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    alignment: Alignment = Alignment.Center,
    onSuccess: () -> Unit = {},
    onError: () -> Unit = {},
    timing: String? = null,
) {
    val images = LocalServerImages.current ?: return
    val url = path?.let(images::url) ?: return
    val start = remember(path) { SystemClock.uptimeMillis() }
    fun log(ok: Boolean) {
        if (timing != null) Log.i(TIMING_TAG, "$timing load ms=${SystemClock.uptimeMillis() - start} ok=$ok path=$path")
    }
    AsyncImage(
        model = url,
        contentDescription = null,
        imageLoader = images.loader,
        modifier = modifier,
        alignment = alignment,
        contentScale = contentScale,
        onSuccess = {
            log(true)
            onSuccess()
        },
        onError = {
            log(false)
            onError()
        },
    )
}
