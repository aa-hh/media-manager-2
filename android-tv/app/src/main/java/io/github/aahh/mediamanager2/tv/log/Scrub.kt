package io.github.aahh.mediamanager2.tv.log

import java.security.MessageDigest

// Everything the app logs passes through here first (android-tv/AGENTS.md: no token in a log). Plex tokens in addresses
// or headers, and cookies, including our session cookie, become #<first 8 hex of their SHA-256>: two lines can be
// matched to the same token, but the token cannot be read back.
private val PLEX_TOKEN = Regex("(X-Plex-Token\"?\\s*[=:]\\s*\"?)[^&\\s\"',;]+", RegexOption.IGNORE_CASE)
private val COOKIE_HEADER = Regex("((?:Set-)?Cookie:\\s*).*", RegexOption.IGNORE_CASE)
// Over https the cookies are __Host-mm_session and __Host-mm_plex; over http, plain mm_session and mm_plex.
private val SESSION_COOKIE = Regex("((?:__Host-)?mm_[a-z_]+=)[^;\\s\"',]+", RegexOption.IGNORE_CASE)

fun scrub(text: String): String = text
    .replace(PLEX_TOKEN) { it.groupValues[1] + fingerprint(it.value.substring(it.groupValues[1].length)) }
    .replace(COOKIE_HEADER) { it.groupValues[1] + fingerprint(it.value.substring(it.groupValues[1].length)) }
    .replace(SESSION_COOKIE) { it.groupValues[1] + fingerprint(it.value.substring(it.groupValues[1].length)) }

internal fun fingerprint(secret: String): String =
    "#" + MessageDigest.getInstance("SHA-256").digest(secret.toByteArray()).take(4).joinToString("") { "%02x".format(it) }
