package io.github.aahh.mediamanager2.tv.api

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

private val SCHEME = Regex("^[a-z][a-z0-9+.-]*://", RegexOption.IGNORE_CASE)

/**
 * The typed server address as an origin (scheme, host, port), or null. A bare host means https, and only https is
 * accepted: the session cookie and the Plex sign-in never cross the network in the clear. Plain http is for Plex's video
 * streams only, which never go through here. Otherwise a port of `desktop/lib/address.js` normaliseAddress.
 */
fun normaliseAddress(input: String): String? {
    var text = input.trim()
    if (text.isEmpty()) return null
    if (!SCHEME.containsMatchIn(text)) text = "https://$text"
    val url = text.toHttpUrlOrNull() ?: return null
    if (!url.isHttps || url.host.isEmpty() || url.username.isNotEmpty() || url.password.isNotEmpty()) return null
    val host = if (':' in url.host) "[${url.host}]" else url.host
    return if (url.port == 443) "https://$host" else "https://$host:${url.port}"
}

/** Whether a reply from `GET {address}/auth/status` came from media-manager-2: a 200 whose JSON has a boolean `configured`. */
fun isMediaManager(status: Int, body: String): Boolean {
    if (status != 200) return false
    val configured = runCatching { Json.parseToJsonElement(body) }.getOrNull()
        .let { it as? JsonObject }?.get("configured") as? JsonPrimitive ?: return false
    return !configured.isString && configured.booleanOrNull != null
}
