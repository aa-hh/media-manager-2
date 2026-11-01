package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.runtime.Composable
import io.github.aahh.mediamanager2.tv.ui.components.TvButton

/**
 * Can't reach Media Manager: replaces any page and tries again.
 * FINAL frames: T03d C1. Stub until its task builds it; the signature is the one it keeps.
 */
@Composable
fun OfflineScreen(onRetry: () -> Unit) {
    Placeholder("Can’t reach Media Manager", "T03d C1") { TvButton("Try again", onClick = onRetry) }
}
