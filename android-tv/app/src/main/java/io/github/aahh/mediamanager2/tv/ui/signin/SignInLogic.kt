package io.github.aahh.mediamanager2.tv.ui.signin

import io.github.aahh.mediamanager2.tv.api.LinkOutcome
import io.github.aahh.mediamanager2.tv.api.isMediaManager
import io.github.aahh.mediamanager2.tv.api.normaliseAddress
import java.io.IOException
import java.security.cert.CertificateException
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLHandshakeException
import javax.net.ssl.SSLPeerUnverifiedException
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response

/** What the address field holds once read: an https origin, a refused http address (A8), or nothing usable. */
sealed interface AddressInput {
    data class Ok(val origin: String) : AddressInput
    data object Http : AddressInput
    data object Invalid : AddressInput
}

private val HTTP = Regex("^http://", RegexOption.IGNORE_CASE)

fun readAddress(text: String): AddressInput =
    normaliseAddress(text)?.let(AddressInput::Ok) ?: if (HTTP.containsMatchIn(text.trim())) AddressInput.Http else AddressInput.Invalid

/** A8's Switch to https://: the typed address with its start swapped. */
fun switchToHttps(text: String): String = text.trim().replaceFirst(HTTP, "https://")

/** Why the address screen cannot go on, with the T03c A4/A5/A7/A8 wording under the field. */
sealed interface AddressProblem {
    val message: String

    data object Http : AddressProblem {
        override val message = "Sign-in needs a secure https:// address."
    }
    data object Invalid : AddressProblem {
        override val message = ADDRESS_HINT
    }
    data class Unreachable(val host: String) : AddressProblem {
        override val message = "Couldn’t reach $host. Check the address, and that the server is on."
    }
    data object Untrusted : AddressProblem {
        override val message = "The TV doesn’t trust this server’s certificate. The server needs one from a public authority, such as Let’s Encrypt."
    }
    data class NotOurs(val host: String) : AddressProblem {
        override val message = "Something answered at $host, but it isn’t media-manager-2. Check the address."
    }
}

const val ADDRESS_HINT = "Starts with https://. If you leave it out, it’s added for you."

/** The origin as the frames show it: no scheme. */
fun hostOf(origin: String): String = origin.removePrefix("https://")

/** A4 for a network failure, A7 when the failure is the server's certificate. */
fun problemFor(error: IOException, host: String): AddressProblem {
    var cause: Throwable? = error
    while (cause != null) {
        if (cause is SSLHandshakeException || cause is SSLPeerUnverifiedException || cause is CertificateException) return AddressProblem.Untrusted
        cause = cause.cause
    }
    return AddressProblem.Unreachable(host)
}

/** Our server's address check: its own client, which never follows https to http and gives up after 10 s. */
fun addressCheckClient(): OkHttpClient = OkHttpClient.Builder().followSslRedirects(false).callTimeout(10, TimeUnit.SECONDS).build()

/** Asks `GET {origin}/auth/status`; null when media-manager-2 answered. Cancelling (Back on A3) cancels the request. */
suspend fun checkServer(http: OkHttpClient, origin: String): AddressProblem? {
    val host = hostOf(origin)
    val call = http.newCall(Request.Builder().url("$origin/auth/status".toHttpUrl()).build())
    return suspendCancellableCoroutine { continuation ->
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                continuation.resume(problemFor(e, host))
            }

            override fun onResponse(call: Call, response: Response) {
                val problem = try {
                    response.use { if (isMediaManager(it.code, it.body.string())) null else AddressProblem.NotOurs(host) }
                } catch (error: IOException) {
                    problemFor(error, host)
                }
                continuation.resume(problem)
            }
        })
    }
}

/** Which T03c B frame a link sign-in that did not succeed shows. */
enum class LinkProblem { Expired, NotOwner, SetupRequired, PlexUnreachable }

/** B2, B3, B4; everything else (`rate_limited`, `plex_unavailable`, no answer) is B6. */
fun linkProblemFor(outcome: LinkOutcome.Refused): LinkProblem = when (outcome.code) {
    "owner_only" -> LinkProblem.NotOwner
    "setup_required" -> LinkProblem.SetupRequired
    "flow_expired", "invalid_flow" -> LinkProblem.Expired
    else -> LinkProblem.PlexUnreachable
}
