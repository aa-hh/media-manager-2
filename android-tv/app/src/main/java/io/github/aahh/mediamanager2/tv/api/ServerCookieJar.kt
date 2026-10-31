package io.github.aahh.mediamanager2.tv.api

import android.content.SharedPreferences
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

/** Where the server's cookies live between app starts. */
interface CookieStore {
    fun load(): List<String>
    fun save(cookies: List<String>)
}

/** App-private SharedPreferences; `allowBackup` is off, so the session never leaves the TV. */
class PreferencesCookieStore(private val preferences: SharedPreferences) : CookieStore {
    override fun load(): List<String> = preferences.getStringSet(KEY, emptySet()).orEmpty().toList()
    override fun save(cookies: List<String>) {
        preferences.edit().putStringSet(KEY, cookies.toSet()).apply()
    }

    private companion object {
        const val KEY = "server_cookies"
    }
}

/**
 * Keeps only cookies from the server's own host, so the session cookie is never sent anywhere else, and stores them so
 * the TV stays signed in after a restart. A cookie the server clears (Max-Age 0) or that has expired is dropped.
 */
class ServerCookieJar(
    private val server: HttpUrl,
    private val store: CookieStore,
    private val now: () -> Long = System::currentTimeMillis,
) : CookieJar {
    private val lock = Any()
    private var cookies: List<Cookie> = store.load().mapNotNull { Cookie.parse(server, it) }

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        if (url.host != server.host || url.port != server.port) return
        synchronized(lock) {
            val kept = this.cookies.filterNot { old -> cookies.any { it.name == old.name && it.path == old.path } }
            this.cookies = (kept + cookies).filter { it.expiresAt > now() }
            store.save(this.cookies.filter { it.persistent }.map { it.toString() })
        }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        if (url.host != server.host || url.port != server.port) return emptyList()
        return synchronized(lock) { cookies.filter { it.expiresAt > now() && it.matches(url) } }
    }

    /** Forgets every cookie, as after Log out. */
    fun clear() = synchronized(lock) {
        cookies = emptyList()
        store.save(emptyList())
    }
}
