package io.github.aahh.mediamanager2.tv.api

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AddressTest {
    // Each https row is what desktop/lib/address.js gives for the same input; a change to the port turns this red. The TV
    // refuses plain http (the session cookie and sign-in would cross the network in the clear); accepting it turns this red.
    @Test
    fun addressesMatchTheDesktopApp() {
        val rows = listOf(
            "media.example.com" to "https://media.example.com",
            "  media.example.com/some/page?x=1  " to "https://media.example.com",
            "HTTPS://Media.Example.COM:443/" to "https://media.example.com",
            "https://192.168.1.20:8443/path" to "https://192.168.1.20:8443",
            "http://192.168.1.20:8080/path" to null,
            "http://box.local:80" to null,
            "HTTP://media.example.com" to null,
            "localhost:3000" to "https://localhost:3000",
            "https://[::1]:3000" to "https://[::1]:3000",
            "http://[::1]:3000" to null,
            "" to null,
            "   " to null,
            "ftp://media.example.com" to null,
            "https://user:secret@media.example.com" to null,
            "javascript:alert(1)" to null,
            "http://" to null,
        )
        for ((input, expected) in rows) assertEquals("input \"$input\"", expected, normaliseAddress(input))
    }

    // Only our server answers /auth/status with a boolean `configured`; accepting any 200 here turns this red.
    @Test
    fun onlyOurServersStatusReplyCounts() {
        assertTrue(isMediaManager(200, """{"configured":true,"pending":false,"firstRun":false,"provider":"plex"}"""))
        assertTrue(isMediaManager(200, """{"configured":false}"""))
        assertFalse(isMediaManager(200, """{"configured":"yes"}"""))
        assertFalse(isMediaManager(200, """[{"configured":true}]"""))
        assertFalse(isMediaManager(200, "<html>router login</html>"))
        assertFalse(isMediaManager(404, """{"configured":true}"""))
    }

    // web Settings lists the TV by this name and the server refuses control characters or more than 64 characters;
    // dropping the clean-up turns this red.
    @Test
    fun theDeviceNameIsWhatTheServerAccepts() {
        assertEquals("Lounge TV", cleanDeviceName("  Lounge TV \n", "Chromecast"))
        assertEquals("Chromecast", cleanDeviceName("   ", "Chromecast"))
        assertEquals("Chromecast", cleanDeviceName(null, "Chromecast"))
        assertEquals("Android TV", cleanDeviceName(null, null))
        assertEquals("Lounge TV", cleanDeviceName("Lounge\u0007TV", null))
        val cut = cleanDeviceName("😀".repeat(70), null)
        assertEquals(64, cut.codePointCount(0, cut.length))
    }
}
