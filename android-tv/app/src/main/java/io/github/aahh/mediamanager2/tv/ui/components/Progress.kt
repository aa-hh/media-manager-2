// v2/TV/Progress/Bar — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=35-4306
// (on a poster it is the watch bar: https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=53-4423)
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens

/**
 * A 4dp line, fully rounded: [fraction] (0 to 1) of it in `watch-bar` blue over a faint black track. The update download
 * and how far a title is watched both use it; on a poster it sits 8 in from the sides and bottom.
 */
@Composable
fun ProgressBar(fraction: Float, modifier: Modifier = Modifier, color: Color = Tokens.watchBar) {
    val shape = RoundedCornerShape(2.dp)
    Box(modifier.fillMaxWidth().height(4.dp).background(Tokens.shadow.copy(alpha = 0.12f), shape)) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).fillMaxHeight().background(color, shape))
    }
}

@Preview(widthDp = 480, heightDp = 60, backgroundColor = 0xFF1E2430, showBackground = true)
@Composable
private fun ProgressBarPreview() = AppTheme {
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ProgressBar(0.4f)
        ProgressBar(1f)
    }
}
