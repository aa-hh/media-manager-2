package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.api.AuthApi
import io.github.aahh.mediamanager2.tv.ui.Tokens
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
        StubButton("Log out") { confirming = true }
        StubButton("App details", onClick = onOpenAppDetails)
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
    LaunchedEffect(Unit) { runCatching { cancel.requestFocus() } }
    Dialog(onDismissRequest = { if (!busy) onCancel() }) {
        Column(
            Modifier.background(Tokens.popover, RoundedCornerShape(16.dp)).padding(32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Log out of Media Manager on this TV?", color = Tokens.popoverForeground)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StubButton("Cancel", Modifier.focusRequester(cancel)) { if (!busy) onCancel() }
                StubButton("Log out") {
                    if (busy) return@StubButton
                    busy = true
                    scope.launch {
                        auth.logout()
                        onLoggedOut()
                    }
                }
            }
        }
    }
}
