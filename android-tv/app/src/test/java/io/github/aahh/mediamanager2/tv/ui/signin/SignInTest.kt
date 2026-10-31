package io.github.aahh.mediamanager2.tv.ui.signin

import io.github.aahh.mediamanager2.tv.api.LinkOutcome
import java.io.IOException
import java.net.ConnectException
import java.security.cert.CertificateException
import javax.net.ssl.SSLHandshakeException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SignInTest {
    // A8 refuses http:// with its own wording and a bare host gets https://; folding http into Invalid turns this red.
    @Test
    fun addressInputSplitsHttpFromUnusable() {
        assertEquals(AddressInput.Ok("https://media.example.com"), readAddress("media.example.com"))
        assertEquals(AddressInput.Http, readAddress("  HTTP://media.example.com "))
        assertEquals(AddressInput.Invalid, readAddress("ftp://media.example.com"))
        assertEquals(AddressInput.Invalid, readAddress(""))
        assertEquals("https://media.example.com:8080/x", switchToHttps(" Http://media.example.com:8080/x"))
        assertEquals("Sign-in needs a secure https:// address.", AddressProblem.Http.message)
    }

    // A7 is shown only for a certificate the TV refuses, even when wrapped; dropping the cause walk turns this red.
    @Test
    fun certificateFailuresAreTheirOwnProblem() {
        assertEquals(AddressProblem.Untrusted, problemFor(SSLHandshakeException("bad cert"), "h"))
        assertEquals(AddressProblem.Untrusted, problemFor(IOException("wrapped", CertificateException("untrusted")), "h"))
        assertEquals(AddressProblem.Unreachable("media.example.com"), problemFor(ConnectException("refused"), "media.example.com"))
    }

    // Each server code picks its B frame; sending owner_only or setup_required to the catch-all B6 turns this red.
    @Test
    fun refusalsPickTheirFrame() {
        val rows = listOf(
            "owner_only" to LinkProblem.NotOwner,
            "setup_required" to LinkProblem.SetupRequired,
            "flow_expired" to LinkProblem.Expired,
            "rate_limited" to LinkProblem.PlexUnreachable,
            "plex_unavailable" to LinkProblem.PlexUnreachable,
            null to LinkProblem.PlexUnreachable,
        )
        for ((code, frame) in rows) assertEquals("code $code", frame, linkProblemFor(LinkOutcome.Refused(429, code)))
    }

    // Targets, durations and the success green delay are the desktop's; changing any of 4 s, 165°, 1.7 s or 0.5 s turns this red.
    @Test
    fun planetTweensMatchTheDesktop() {
        val motion = PlanetMotion(reducedMotion = false)
        assertEquals(30.0, motion.value(0, 0.0), 1e-9)
        motion.setState(PlanetState.Checking, 10.0)
        assertEquals((30 + 165) / 2.0, motion.value(0, 12.0), 1e-9)
        assertEquals(165.0, motion.value(0, 14.0), 1e-9)
        assertEquals(1.06, motion.value(1, 14.0), 1e-9)
        motion.setState(PlanetState.Success, 20.0)
        assertEquals(0.0, motion.value(3, 20.5), 1e-9)
        assertEquals(0.5, motion.value(2, 20.85), 1e-9)
        assertEquals(1.0, motion.value(3, 22.2), 1e-9)
        assertEquals(1.0, motion.value(2, 21.7), 1e-9)
    }

    // 24 fps while settled, full rate 1 s after a change and 3.2 s after success; widening the window turns this red.
    @Test
    fun fullRateOnlyAroundAChange() {
        val motion = PlanetMotion(reducedMotion = false)
        motion.setState(PlanetState.Checking, 5.0)
        assertTrue(motion.fast(5.9))
        assertFalse(motion.fast(6.1))
        motion.setState(PlanetState.Success, 10.0)
        assertTrue(motion.fast(13.1))
        assertFalse(motion.fast(13.3))
    }

    // The eddy's extra twist starts at the first checking and caps at 40 s; resetting or uncapping it turns this red.
    @Test
    fun twistAccumulatesFromTheFirstCheck() {
        val motion = PlanetMotion(reducedMotion = false)
        assertEquals(0f, motion.frame(3.0).twist)
        motion.setState(PlanetState.Checking, 2.0)
        assertEquals(0.12f * 10, motion.frame(12.0).twist, 1e-5f)
        motion.setState(PlanetState.Idle, 12.0)
        motion.setState(PlanetState.Checking, 20.0)
        assertEquals(0.12f * 40, motion.frame(100.0).twist, 1e-5f)
    }

    // With the animator duration scale at 0 a state lands at once; tweening there turns this red.
    @Test
    fun reducedMotionJumps() {
        val motion = PlanetMotion(reducedMotion = true)
        motion.setState(PlanetState.Success, 7.0)
        assertEquals(165.0, motion.value(0, 7.0), 1e-9)
        assertEquals(1.0, motion.value(3, 7.0), 1e-9)
    }

    // Bytes and sum were printed by the desktop's generator (mulberry32(11), 64³); a drift in the port turns this red.
    @Test
    fun noiseVolumeIsTheDesktops() {
        val volume = planetNoise()
        val expected = mapOf(0 to 130, 1 to 130, 2 to 132, 3 to 134, 4 to 135, 5 to 137, 777 to 75, 4097 to 121, 123456 to 200, 262143 to 118)
        for ((index, value) in expected) assertEquals("byte $index", value, volume[index].toInt() and 0xFF)
        assertEquals(33180387L, volume.sumOf { (it.toInt() and 0xFF).toLong() })
    }
}
