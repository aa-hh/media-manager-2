package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.ui.Tokens
import io.github.aahh.mediamanager2.tv.update.AvailableUpdate

/**
 * The update pop-up at launch, after a newer release is found: Update now first, Later second; Back or Later closes it
 * until the next launch.
 * FINAL frames: T03c C1–C5 (C3 is Android's own installer screen). Stub until T19 builds it with Update now; the
 * signature is the one it keeps.
 */
@Composable
fun UpdatePrompt(update: AvailableUpdate, onLater: () -> Unit) {
    Dialog(onDismissRequest = onLater) {
        Column(
            Modifier.background(Tokens.popover, RoundedCornerShape(16.dp)).padding(32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("A new version is ready (${update.tag}).", color = Tokens.popoverForeground)
            StubButton("Later", onClick = onLater)
        }
    }
}
