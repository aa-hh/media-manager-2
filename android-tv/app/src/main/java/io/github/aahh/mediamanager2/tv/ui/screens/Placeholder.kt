package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.ui.Tokens

/** What a stub screen shows until its task builds it: its name and the FINAL frames it comes from. */
@Composable
internal fun Placeholder(name: String, frames: String, modifier: Modifier = Modifier, content: @Composable () -> Unit = {}) {
    Column(modifier.fillMaxSize().padding(48.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(name, style = MaterialTheme.typography.headlineMedium, color = Tokens.foreground)
        Text("Built from $frames", color = Tokens.mutedForeground)
        content()
    }
}

/** A plain focusable button for stubs and simple dialogs until T13b builds the shared button from the approved frames. */
@Composable
internal fun StubButton(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val shape = RoundedCornerShape(12.dp)
    Box(
        modifier
            .background(if (focused) Tokens.primary else Tokens.secondary, shape)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 10.dp),
    ) {
        Text(label, color = if (focused) Tokens.primaryForeground else Tokens.secondaryForeground)
    }
}
