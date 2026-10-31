package io.github.aahh.mediamanager2.tv.api

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/** How a link-code sign-in ended. */
sealed interface LinkOutcome {
    data object SignedIn : LinkOutcome
    /** The code ran out before anyone entered it; the screen offers a new one. */
    data object Expired : LinkOutcome
    /** The server refused (`setup_required`, `owner_only`, `rate_limited`, …) or could not be reached; [code] is its error. */
    data class Refused(val status: Int?, val code: String?) : LinkOutcome
}

/**
 * Signs the TV in with a Plex link code: starts an attempt, hands the code to [showCode], then asks every 2 s until the
 * code's `expiresAt`. A short network or Plex outage while waiting is waited out. Cancelling the coroutine (Back on the
 * code screen) tells the server to drop the attempt.
 */
class LinkSignIn(
    private val auth: AuthApi,
    private val client: ServerClient,
    private val now: () -> Long = System::currentTimeMillis,
    private val pause: suspend (Long) -> Unit = { delay(it) },
) {
    suspend fun signIn(deviceName: String, showCode: (LinkCode) -> Unit): LinkOutcome {
        val code = when (val started = auth.linkStart(deviceName)) {
            is ApiResult.Ok -> started.value ?: return LinkOutcome.Refused(started.status, null)
            is ApiResult.Error -> return LinkOutcome.Refused(started.status, started.code)
            is ApiResult.Failed -> return LinkOutcome.Refused(null, null)
        }
        showCode(code)
        try {
            while (now() < code.expiresAt) {
                pause(POLL_MS)
                when (val progress = auth.linkComplete()) {
                    is ApiResult.Ok -> if (progress.status == 200) {
                        client.signedIn()
                        return LinkOutcome.SignedIn
                    }
                    is ApiResult.Error -> when {
                        progress.code == "flow_expired" -> return LinkOutcome.Expired
                        progress.code == "in_progress" || progress.status >= 500 -> Unit
                        else -> return LinkOutcome.Refused(progress.status, progress.code)
                    }
                    is ApiResult.Failed -> Unit
                }
            }
            return LinkOutcome.Expired
        } catch (cancelled: CancellationException) {
            withContext(NonCancellable) { auth.cancel() }
            throw cancelled
        }
    }

    companion object {
        const val POLL_MS = 2_000L
    }
}
