package io.github.aahh.mediamanager2.tv.log

import java.security.MessageDigest

// Everything the app logs passes through here first (android-tv/AGENTS.md: no token in a log). Plex tokens in addresses
// or headers, and cookie values, including our session cookie, become `sha256:` and the first 8 hex digits of their
// SHA-256: two lines that used the same token show the same hash, and the token itself never reaches the log.
private val PLEX_TOKEN = Regex("(X-Plex-Token\"?\\s*[=:]\\s*\"?)([^&\\s\"',;]+)", RegexOption.IGNORE_CASE)
private val COOKIE_HEADER = Regex("((Set-)?Cookie:\\s*)(.*)", RegexOption.IGNORE_CASE)
// Over https the cookies are __Host-mm_session and __Host-mm_plex; over http, plain mm_session and mm_plex.
private val SESSION_COOKIE = Regex("((?:__Host-)?mm_[a-z_]+=)([^;\\s\"',]+)", RegexOption.IGNORE_CASE)
private val HASHED = Regex("^sha256:[0-9a-f]{8}$")

/** `sha256:` and the first 8 hex digits of the value's SHA-256; a value already hashed stays as it is. */
fun tokenHash(value: String): String {
    if (HASHED.matches(value)) return value
    val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
    return "sha256:" + digest.take(4).joinToString("") { "%02x".format(it) }
}

// A cookie pair keeps its name and hashes its value; a part with no `=` is hashed whole.
private fun hashPair(pair: String): String {
    val equals = pair.indexOf('=')
    val lead = pair.length - pair.trimStart().length
    if (pair.isBlank()) return pair
    if (equals < 0) return pair.substring(0, lead) + tokenHash(pair.trim())
    val value = pair.substring(equals + 1).trim()
    return pair.substring(0, equals + 1) + if (value.isEmpty()) "" else tokenHash(value)
}

// A Cookie header hashes every value; a Set-Cookie header hashes its one cookie and keeps the attributes (Path, Secure).
private fun cookieHeader(match: MatchResult): String {
    val (prefix, set, rest) = match.destructured
    val parts = rest.split(';')
    val hashed = if (set.isEmpty()) parts.map(::hashPair) else listOf(hashPair(parts.first())) + parts.drop(1)
    return prefix + hashed.joinToString(";")
}

fun scrub(text: String): String = text
    .replace(PLEX_TOKEN) { it.groupValues[1] + tokenHash(it.groupValues[2]) }
    .replace(SESSION_COOKIE) { it.groupValues[1] + tokenHash(it.groupValues[2]) }
    .replace(COOKIE_HEADER, ::cookieHeader)
