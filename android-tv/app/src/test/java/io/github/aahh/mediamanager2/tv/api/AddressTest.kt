package io.github.aahh.mediamanager2.tv.api

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AddressTest {
    // Each row is what desktop/lib/address.js gives for the same input; a row that differs means the TV and desktop
    // accept different addresses, and a change to the port turns this red.
    @Test
    fun addressesMatchTheDesktopApp() {
        val rows = listOf(
            "media.example.com" to "https://media.example.com",
            "  media.example.com/some/page?x=1  " to "https://media.example.com",
            "HTTPS://Media.Example.COM:443/" to "https://media.example.com",
            "http://192.168.1.20:8080/path" to "http://192.168.1.20:8080",
            "http://box.local:80" to "http://box.local",
            "localhost:3000" to "https://localhost:3000",
            "http://[::1]:3000" to "http://[::1]:3000",
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
