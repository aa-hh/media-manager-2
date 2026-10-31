package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.api.AuthApi
import io.github.aahh.mediamanager2.tv.api.LinkOutcome
import io.github.aahh.mediamanager2.tv.api.LinkSignIn
import io.github.aahh.mediamanager2.tv.api.ServerClient
import io.github.aahh.mediamanager2.tv.api.deviceName
import io.github.aahh.mediamanager2.tv.ui.Tokens

/**
 * Sign in with a Plex link code: the code to enter at plex.tv/link, then a short hand-off once signed in. Leaving the
 * screen (Back) cancels the attempt, and `LinkSignIn` tells the server.
 * FINAL frames: T03c B1–B6. A working stub (code, expiry and refusal as plain text) until T14 builds the frames; the
 * signature is the one it keeps.
 */
@Composable
fun LinkCodeScreen(client: ServerClient, onSignedIn: () -> Unit) {
    val context = LocalContext.current
    var code by remember { mutableStateOf<String?>(null) }
    var problem by remember { mutableStateOf<String?>(null) }
    var attempt by remember { mutableIntStateOf(0) }
    LaunchedEffect(attempt) {
        code = null
        problem = null
        when (val outcome = LinkSignIn(AuthApi(client), client).signIn(deviceName(context)) { code = it.code }) {
            LinkOutcome.SignedIn -> onSignedIn()
            LinkOutcome.Expired -> problem = "The code ran out."
            is LinkOutcome.Refused -> problem = "Sign-in failed (${outcome.code ?: outcome.status ?: "no answer"})."
        }
    }
    Placeholder("Sign in with Plex", "T03c B1–B6") {
        val shown = code
        if (shown != null && problem == null) {
            Text("Go to plex.tv/link and enter", color = Tokens.mutedForeground)
            Text(shown, style = MaterialTheme.typography.displayMedium, color = Tokens.foreground)
        }
        problem?.let {
            Text(it, color = Tokens.destructive)
            StubButton("Get a new code") { attempt += 1 }
        }
    }
}
