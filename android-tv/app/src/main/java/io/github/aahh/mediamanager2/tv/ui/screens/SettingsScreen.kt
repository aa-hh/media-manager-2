package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import io.github.aahh.mediamanager2.tv.api.AuthApi
import io.github.aahh.mediamanager2.tv.ui.components.ButtonKind
import io.github.aahh.mediamanager2.tv.ui.components.TvButton
import io.github.aahh.mediamanager2.tv.ui.components.TvDialog
import kotlinx.coroutines.launch

/**
 * Settings: Playback (subtitle size, audio and subtitle language, default quality), Account (Log out), App (App details),
 * Help (Get logs).
 * FINAL frames: T03d B1, B2 (subtitle size window), B3 (Log out dialog), B5 (Get logs). B4 is [AppDetailsScreen]. The
 * Log out dialog works now; the rest is a stub until its task builds it, and the signature is the one it keeps.
 * [onLoggedOut] runs once the session is gone; the app then opens the Address screen with the old address filled in.
 */
@Composable
fun SettingsScreen(auth: AuthApi, onOpenAppDetails: () -> Unit, onLoggedOut: () -> Unit) {
    var confirming by remember { mutableStateOf(false) }
    Placeholder("Settings", "T03d B1, B2, B3, B5") {
        TvButton("Log out", onClick = { confirming = true }, kind = ButtonKind.Outline)
        TvButton("App details", onClick = onOpenAppDetails, kind = ButtonKind.Outline)
    }
    if (confirming) LogOutDialog(auth, onCancel = { confirming = false }, onLoggedOut = onLoggedOut)
}

// T03d B3: a centred dialog, Cancel first and focused. Log out is blocked while it runs. Whatever the server answers,
// the TV forgets its cookie (AuthApi.logout), so it is signed out either way.
@Composable
private fun LogOutDialog(auth: AuthApi, onCancel: () -> Unit, onLoggedOut: () -> Unit) {
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    val cancel = remember { FocusRequester() }
    TvDialog(title = "Log out of Media Manager on this TV?", onDismiss = { if (!busy) onCancel() }) {
        // Asked from inside the dialog, which composes in its own window after the page.
        LaunchedEffect(Unit) { runCatching { cancel.requestFocus() } }
        TvButton("Cancel", onClick = { if (!busy) onCancel() }, modifier = Modifier.focusRequester(cancel))
        TvButton(
            if (busy) "Logging out…" else "Log out",
            onClick = {
                if (!busy) {
                    busy = true
                    scope.launch {
                        auth.logout()
                        onLoggedOut()
                    }
                }
            },
            kind = ButtonKind.Outline,
        )
    }
}
