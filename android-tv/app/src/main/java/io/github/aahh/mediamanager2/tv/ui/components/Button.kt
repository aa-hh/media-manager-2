// v2/TV/Button/Filled — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=33-4667
// v2/TV/Button/Outline — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=35-4096
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens

enum class ButtonKind {
    /** The one main action: glow-blue `action` fill. */
    Filled,

    /** Every other action, and the destructive one beside Cancel. */
    Outline,
}

/**
 * The TV button: 40 high, a pill, 16 in at the sides (12 before an icon). At rest a filled button is 80% and an outline is
 * a faint `input` edge; focus brings it to full strength, grows it 1.1× and adds the 3dp ring (Filled) or a white 3dp
 * edge (Outline). A disabled button is 40% and focus skips it. A button that is busy keeps focus and says so in its
 * [label] ("Connecting…"); the caller ignores presses while it is.
 */
@Composable
fun TvButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: ButtonKind = ButtonKind.Filled,
    icon: ImageVector? = null,
    enabled: Boolean = true,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val progress by animateFocus(focused && enabled)
    val shape = RoundedCornerShape(50)
    val filled = kind == ButtonKind.Filled
    val content = if (filled) Tokens.actionForeground else Tokens.foreground
    Row(
        modifier
            .alpha(if (enabled) 1f else 0.4f)
            .focusGrow({ progress })
            .then(if (filled) Modifier.outerRing({ progress }, Tokens.ring) else Modifier)
            .height(40.dp)
            .then(
                if (filled) {
                    Modifier.background(Tokens.action.copy(alpha = 0.8f + 0.2f * progress), shape)
                } else {
                    Modifier.border(
                        width = (1.5f + 1.5f * progress).dp,
                        color = lerp(Tokens.input.copy(alpha = 0.4f), Tokens.focusOnDark, progress),
                        shape = shape,
                    )
                },
            )
            .clickable(interactionSource = interaction, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(start = if (icon != null) 12.dp else 16.dp, end = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val tint = content.copy(alpha = 0.8f + 0.2f * progress)
        if (icon != null) Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp), tint = tint)
        Text(label, style = if (filled) TvText.label else TvText.outlineLabel, color = tint, maxLines = 1)
    }
}

@Preview(widthDp = 560, heightDp = 120, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun ButtonPreview() = AppTheme {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Row(Modifier.padding(24.dp), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
        TvButton("Update now", onClick = {}, modifier = Modifier.focusRequester(focus))
        TvButton("Later", onClick = {}, kind = ButtonKind.Outline)
        TvButton("Add to library", onClick = {}, icon = TvIcons.Add)
        TvButton("Grab", onClick = {}, enabled = false)
    }
}
