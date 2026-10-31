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
 * server says the code ran out (`flow_expired`). A short network or Plex outage while waiting is waited out. The TV's
 * clock is never compared with the server's `expiresAt`, since a TV clock can be minutes out; a local cap of
 * [MAX_WAIT_MS] from when the code arrived only stops a loop the server never ends. Cancelling the coroutine (Back on the
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
        val giveUpAt = now() + MAX_WAIT_MS
        try {
            while (now() < giveUpAt) {
                pause(POLL_MS)
                when (val progress = auth.linkComplete()) {
                    is ApiResult.Ok -> if (progress.status == 200) {
                        client.signedIn()
                        return LinkOutcome.SignedIn
                    }
                    is ApiResult.Error -> when {
                        // The server prunes a run-out attempt when anyone starts a sign-in, so a late ask can get invalid_flow.
                        progress.code == "flow_expired" || progress.code == "invalid_flow" -> return LinkOutcome.Expired
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

        /** An attempt lives at most 10 minutes on the server (`auth.ts` link attempts); one more for slow replies. */
        const val MAX_WAIT_MS = 11 * 60_000L
    }
}
