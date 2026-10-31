package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.runtime.Composable
import io.github.aahh.mediamanager2.tv.ui.PlayerRoute

/**
 * The player: controls and the remote, the subtitle, audio and quality panels, Skip intro and Up Next, opening, buffering
 * and errors. Back first hides the controls, then stops and closes.
 * FINAL frames: T03b A1–A4, B1–B5, C1–C3, D1–D4. Stub until T15 builds it; the signature is the one it keeps.
 */
@Suppress("UNUSED_PARAMETER")
@Composable
fun PlayerScreen(request: PlayerRoute, onClose: () -> Unit) {
    Placeholder("Player", "T03b A1–A4, B1–B5, C1–C3, D1–D4")
}
