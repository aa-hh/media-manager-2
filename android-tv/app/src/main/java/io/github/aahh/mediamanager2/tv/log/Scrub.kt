package io.github.aahh.mediamanager2.tv.log

// Everything the app logs passes through here first (android-tv/AGENTS.md: no token in a log). Plex tokens in addresses
// or headers, and cookies, including our session cookie, become ***.
private val PLEX_TOKEN = Regex("(X-Plex-Token[=:]\\s*)[^&\\s\"',;]+", RegexOption.IGNORE_CASE)
private val COOKIE_HEADER = Regex("((?:Set-)?Cookie:\\s*).*", RegexOption.IGNORE_CASE)
private val SESSION_COOKIE = Regex("(__Host-mm_[a-z_]+=)[^;\\s\"',]+", RegexOption.IGNORE_CASE)

fun scrub(text: String): String = text
    .replace(PLEX_TOKEN, "$1***")
    .replace(COOKIE_HEADER, "$1***")
    .replace(SESSION_COOKIE, "$1***")
