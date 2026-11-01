// v2/TV/ListItem/Release — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=53-4553
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens

/**
 * A three-line list row (a release in the release picker, T03a C4/C5): 80 high, radius 8, 16 in. The [overline] (quality
 * and size) sits over the [title] (the release name, one line) and the [subtitle] (indexer, seeders, age). Focus fills
 * the row `foreground`, turns the title dark and the other lines `faint-foreground`, and grows it 1.05× from its centre.
 */
@Composable
fun ListItem(
    overline: String,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val progress by animateFocus(focused)
    val fill by animateFocusColor(focused, Tokens.control, Tokens.foreground)
    val titleColor by animateFocusColor(focused, Tokens.foreground, Tokens.background)
    val lineColor by animateFocusColor(focused, Tokens.mutedForeground, Tokens.faintForeground)
    Column(
        modifier
            .focusGrow({ progress }, scale = 1.05f)
            .fillMaxWidth()
            .height(80.dp)
            .background(fill, RoundedCornerShape(8.dp))
            .clickable(interactionSource = interaction, indication = null, role = Role.Button, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(overline, style = TvText.listOverline, color = lineColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(title, style = TvText.listTitle, color = titleColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(subtitle, style = TvText.listSubtitle, color = lineColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Preview(widthDp = 560, heightDp = 220, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun ListItemPreview() = AppTheme {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Column(Modifier.padding(24.dp).width(512.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ListItem("2160p · 18.4 GB", "Night.Harbour.2025.2160p.WEB-DL.DV.HDR.DDP5.1", "Indexer One · 412 seeders · 3 days", onClick = {}, modifier = Modifier.focusRequester(focus))
        ListItem("1080p · 6.1 GB", "Night.Harbour.2025.1080p.WEB-DL.DDP5.1.H.264", "Indexer Two · 1,208 seeders · 3 days", onClick = {})
    }
}
