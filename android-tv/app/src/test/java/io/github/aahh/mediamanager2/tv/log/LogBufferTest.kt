package io.github.aahh.mediamanager2.tv.log

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class LogBufferTest {
    @get:Rule
    val temporary = TemporaryFolder()

    // Dropping a pattern from scrub(), or letting it eat the text after a token, turns this red.
    @Test
    fun tokensAndCookiesAreScrubbed() {
        val scrubbed = scrub(
            "GET https://plex.example:32400/library/parts/1/file.mkv?X-Plex-Token=abc123&x=1 X-Plex-Token: def456 " +
                "Cookie: __Host-mm_session=s3cr3t; other=1",
        )
        assertFalse(scrubbed.contains("abc123"))
        assertFalse(scrubbed.contains("def456"))
        assertFalse(scrubbed.contains("s3cr3t"))
        assertTrue(scrubbed.contains("X-Plex-Token=${fingerprint("abc123")}&x=1"))
        assertEquals("Set-Cookie: ${fingerprint("__Host-mm_session=abc; Path=/; Secure")}", scrub("Set-Cookie: __Host-mm_session=abc; Path=/; Secure"))
        assertEquals("sent __Host-mm_session=${fingerprint("abc")} then", scrub("sent __Host-mm_session=abc then"))
        // Same token, same fingerprint; a known value, so the hash is SHA-256 and not something weaker.
        assertEquals("#ba7816bf", fingerprint("abc"))
        assertEquals("nothing secret here", scrub("nothing secret here"))
        // An http server address drops the __Host- prefix; a JSON body quotes the header name.
        assertEquals("mm_session=${fingerprint("abc")} mm_plex=${fingerprint("def")}", scrub("mm_session=abc mm_plex=def"))
        assertEquals("{\"X-Plex-Token\":\"${fingerprint("abc")}\"}", scrub("{\"X-Plex-Token\":\"abc\"}"))
    }

    // Dropping the newest lines instead of the oldest, or letting the buffer grow past its cap, turns this red.
    @Test
    fun theBufferKeepsTheNewestLinesUnderTheCap() {
        val buffer = LogBuffer(temporary.newFolder(), maxCharacters = 100, clock = { 0 })
        repeat(20) { buffer.log("t", "line $it") }
        val snapshot = buffer.snapshot()
        assertTrue(snapshot.length <= 100)
        assertTrue(snapshot.endsWith("t line 19\n"))
        assertFalse(snapshot.contains("line 0\n"))
        assertTrue(snapshot.startsWith("1970-01-01T00:00:00Z t line "))
    }

    // Keeping every earlier run, or losing the run before this one, turns this red.
    @Test
    fun thePreviousRunIsKeptOnce() {
        val folder = temporary.newFolder()
        LogBuffer(folder, clock = { 0 }).log("t", "first run")
        LogBuffer(folder, clock = { 0 }).log("t", "second run")
        val third = LogBuffer(folder, clock = { 0 })
        third.log("t", "third run")
        val snapshot = third.snapshot()
        assertFalse(snapshot.contains("first run"))
        assertEquals("1970-01-01T00:00:00Z t second run\n${LogBuffer.RUN_DIVIDER}1970-01-01T00:00:00Z t third run\n", snapshot)
    }

    // Never rewriting the file, or rewriting it without the newest lines, turns this red.
    @Test
    fun theFileStaysBoundedAndKeepsTheNewestLines() {
        val folder = temporary.newFolder()
        val buffer = LogBuffer(folder, maxCharacters = 200, clock = { 0 })
        repeat(500) { buffer.log("t", "line $it") }
        val file = java.io.File(folder, "current.log").readText()
        assertTrue(file.length <= 400)
        assertTrue(file.endsWith("t line 499\n"))
        assertTrue(LogBuffer(folder, maxCharacters = 200, clock = { 0 }).snapshot().endsWith("t line 499\n${LogBuffer.RUN_DIVIDER}"))
    }
}
