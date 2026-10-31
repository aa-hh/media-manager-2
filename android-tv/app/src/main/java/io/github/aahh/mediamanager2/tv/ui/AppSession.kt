package io.github.aahh.mediamanager2.tv.ui

import android.content.Context
import io.github.aahh.mediamanager2.tv.api.PreferencesCookieStore
import io.github.aahh.mediamanager2.tv.api.ServerClient
import io.github.aahh.mediamanager2.tv.api.ServerCookieJar
import okhttp3.HttpUrl.Companion.toHttpUrl

/**
 * The server address the TV signed in to and the client for it, kept in app-private preferences (backup is off). The
 * address is set once, on the Address screen; Log out keeps it so the Address screen can offer it again.
 */
class AppSession(context: Context) {
    private val preferences = context.getSharedPreferences("server", Context.MODE_PRIVATE)

    val address: String? get() = preferences.getString(KEY_ADDRESS, null)

    var client: ServerClient? = address?.let(::clientFor)
        private set

    /** [origin] comes from `normaliseAddress`, so it is https. */
    fun useAddress(origin: String): ServerClient {
        preferences.edit().putString(KEY_ADDRESS, origin).apply()
        return ServerClient(origin, ServerCookieJar(origin.toHttpUrl(), PreferencesCookieStore(preferences))).also { client = it }
    }

    // An address saved by an older build that is no longer accepted (http) counts as none, so the TV asks again.
    private fun clientFor(origin: String): ServerClient? = runCatching {
        ServerClient(origin, ServerCookieJar(origin.toHttpUrl(), PreferencesCookieStore(preferences)))
    }.getOrNull()

    private companion object {
        const val KEY_ADDRESS = "address"
    }
}
