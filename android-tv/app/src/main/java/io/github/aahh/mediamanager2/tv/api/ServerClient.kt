package io.github.aahh.mediamanager2.tv.api

import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response

/** One call to our server: its decoded reply, the server's `{error}` code, or no answer at all. */
sealed interface ApiResult<out T> {
    data class Ok<T>(val status: Int, val value: T) : ApiResult<T>
    data class Error(val status: Int, val code: String?) : ApiResult<Nothing>
    data class Failed(val cause: IOException) : ApiResult<Nothing>
}

/**
 * The OkHttp client for our server at [origin] (from [normaliseAddress]). It holds the session cookie in [cookies] and
 * adds the headers `requireBrowserPost` checks to every non-GET request, as a browser would. A 401 from a private
 * `/api/` route means the session ended, so it sets [signedOut].
 */
class ServerClient(
    val origin: String,
    val cookies: ServerCookieJar,
    base: OkHttpClient = OkHttpClient(),
) {
    // Defaults are sent (the server requires partIndex and offsetSeconds even at 0); nulls are left out, as optional keys must be absent.
    val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; explicitNulls = false }
    private val root: HttpUrl = origin.toHttpUrl()
    private val mutableSignedOut = MutableStateFlow(false)
    val signedOut: StateFlow<Boolean> = mutableSignedOut.asStateFlow()

    val http: OkHttpClient = base.newBuilder()
        .cookieJar(cookies)
        .addInterceptor(Interceptor { chain -> chain.proceed(withBrowserHeaders(chain.request())) })
        .addInterceptor(Interceptor { chain ->
            chain.proceed(chain.request()).also { response ->
                if (response.code == 401 && response.request.url.encodedPath.startsWith("/api/")) mutableSignedOut.value = true
            }
        })
        .build()

    private fun withBrowserHeaders(request: Request): Request {
        if (request.method == "GET" || request.method == "HEAD" || request.url.host != root.host || request.url.port != root.port) return request
        return request.newBuilder()
            .header("Origin", origin)
            .header("X-Requested-With", "media-manager-2")
            .header("Content-Type", JSON_TYPE)
            .build()
    }

    /** The address of [path] (which starts with `/`, query included) on our server. */
    fun url(path: String): HttpUrl = root.resolve(path) ?: error("not a path: $path")

    /** A new session (after sign-in) clears the signed-out state. */
    fun signedIn() {
        mutableSignedOut.value = false
    }

    suspend fun <T> get(path: String, reply: DeserializationStrategy<T>, headers: Map<String, String> = emptyMap()): ApiResult<T> =
        call(Request.Builder().url(url(path)).withHeaders(headers).build(), reply)

    /** POSTs [body], a JSON text (`{}` when the route takes no fields). */
    suspend fun <T> post(path: String, body: String, reply: DeserializationStrategy<T>?, headers: Map<String, String> = emptyMap()): ApiResult<T?> =
        call(Request.Builder().url(url(path)).withHeaders(headers).post(body.toRequestBody(JSON_TYPE.toMediaType())).build(), reply)

    private fun Request.Builder.withHeaders(headers: Map<String, String>) = apply { headers.forEach { (name, value) -> header(name, value) } }

    private suspend fun <T> call(request: Request, reply: DeserializationStrategy<T>?): ApiResult<T> = withContext(Dispatchers.IO) {
        try {
            http.newCall(request).execute().use { response -> decode(response, reply) }
        } catch (error: IOException) {
            ApiResult.Failed(error)
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun <T> decode(response: Response, reply: DeserializationStrategy<T>?): ApiResult<T> {
        val text = response.body.string()
        if (!response.isSuccessful) return ApiResult.Error(response.code, errorCode(text))
        if (reply == null || response.code == 204) return ApiResult.Ok(response.code, null as T)
        return try {
            ApiResult.Ok(response.code, json.decodeFromString(reply, text))
        } catch (error: SerializationException) {
            ApiResult.Failed(IOException("unreadable reply from ${response.request.url.encodedPath}", error))
        } catch (error: IllegalArgumentException) {
            ApiResult.Failed(IOException("unreadable reply from ${response.request.url.encodedPath}", error))
        }
    }

    private fun errorCode(text: String): String? = runCatching {
        ((json.parseToJsonElement(text) as? JsonObject)?.get("error") as? JsonPrimitive)?.takeIf { it.isString }?.content
    }.getOrNull()

    companion object {
        const val JSON_TYPE = "application/json"
    }
}
