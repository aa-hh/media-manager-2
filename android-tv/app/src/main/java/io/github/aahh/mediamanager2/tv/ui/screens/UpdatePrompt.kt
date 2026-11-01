package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import io.github.aahh.mediamanager2.tv.ui.components.ButtonKind
import io.github.aahh.mediamanager2.tv.ui.components.TvButton
import io.github.aahh.mediamanager2.tv.ui.components.TvDialog
import io.github.aahh.mediamanager2.tv.update.AvailableUpdate

/**
 * The update pop-up at launch, after a newer release is found: Update now first, Later second; Back or Later closes it
 * until the next launch.
 * FINAL frames: T03c C1–C5 (C3 is Android's own installer screen). Stub until T19 builds it with Update now; the
 * signature is the one it keeps.
 */
@Composable
fun UpdatePrompt(update: AvailableUpdate, onLater: () -> Unit) {
    val later = remember { FocusRequester() }
    TvDialog(title = "A new version is ready (${update.tag}).", onDismiss = onLater) {
        // Asked from inside the dialog, which composes in its own window after the page.
        LaunchedEffect(Unit) { runCatching { later.requestFocus() } }
        TvButton("Later", onClick = onLater, modifier = Modifier.focusRequester(later), kind = ButtonKind.Outline)
    }
}
