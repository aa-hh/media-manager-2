package io.github.aahh.mediamanager2.tv.log

import java.io.File
import java.time.Instant

/**
 * The app's recent log for Settings' Get logs: the newest [maxCharacters] of lines, scrubbed, in memory and in
 * app-private files, so the run before a crash or restart is sent too. Each start moves the last run's file aside,
 * replacing the one before it, so exactly one previous run is kept.
 */
class LogBuffer(
    folder: File,
    private val maxCharacters: Int = MAX_CHARACTERS,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    private val current = File(folder, "current.log")
    private val previousRun: String
    private val lines = ArrayDeque<String>()
    private var characters = 0
    private var writtenSinceRewrite = 0

    init {
        folder.mkdirs()
        val previous = File(folder, "previous.log")
        previous.delete()
        if (current.exists()) current.renameTo(previous)
        previousRun = if (previous.exists()) runCatching { previous.readText() }.getOrDefault("").takeLast(maxCharacters) else ""
        current.writeText("")
    }

    @Synchronized
    fun log(tag: String, message: String) {
        val line = "${Instant.ofEpochMilli(clock())} $tag ${scrub(message)}".take(MAX_LINE_CHARACTERS) + "\n"
        lines.addLast(line)
        characters += line.length
        while (characters > maxCharacters && lines.size > 1) characters -= lines.removeFirst().length
        // The file grows by appends and is rewritten from memory once it holds twice the cap, so it stays bounded.
        writtenSinceRewrite += line.length
        runCatching {
            if (writtenSinceRewrite > maxCharacters) {
                current.writeText(lines.joinToString(""))
                writtenSinceRewrite = characters
            } else {
                current.appendText(line)
            }
        }
    }

    /** What Get logs sends: the previous run, then this one, cut to the newest [maxCharacters] at a line start. */
    @Synchronized
    fun snapshot(): String {
        val thisRun = lines.joinToString("")
        val whole = if (previousRun.isEmpty()) thisRun else "$previousRun$RUN_DIVIDER$thisRun"
        if (whole.length <= maxCharacters) return whole
        val cut = whole.takeLast(maxCharacters)
        val lineStart = cut.indexOf('\n')
        return if (lineStart in 0 until cut.length - 1) cut.substring(lineStart + 1) else cut
    }

    companion object {
        /** The server's limit for one log (POST /api/device-logs). */
        const val MAX_CHARACTERS = 256 * 1024
        const val MAX_LINE_CHARACTERS = 4_000
        const val RUN_DIVIDER = "--- previous run above, this run below ---\n"
    }
}
