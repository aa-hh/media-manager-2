// v2/TV/SideMenu/NavItem — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=69-5812
// v2/TV/SideMenu/Divider — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=69-5629
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens

/**
 * One item of the side menu: a 48 high pill, 16 in, a 24dp icon and, when [expanded], the label 12 after it. Collapsed it
 * is the 56 wide icon alone (the menu at rest, T03a A1); expanded it fills the menu's width (T03a A2). The page the user
 * is on is [selected], a soft `action` tint with `action` words. Focus is the off-white fill with dark words that menu rows
 * and tabs share, with no ring and no growth.
 */
@Composable
fun NavItem(
    label: String,
    icon: ImageVector,
    selected: Boolean,
    expanded: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val restFill = if (selected) Tokens.action.copy(alpha = 0.16f) else Tokens.control
    val fill by animateFocusColor(focused, restFill, Tokens.foregroundOnDark)
    val restContent = if (selected) Tokens.action else Tokens.mutedForeground
    val content by animateFocusColor(focused, restContent, Tokens.background)
    val iconTint by animateFocusColor(focused, if (selected) Tokens.action else Tokens.foreground, Tokens.background)
    Row(
        modifier
            .then(if (expanded) Modifier.fillMaxWidth() else Modifier.width(56.dp))
            .height(48.dp)
            .background(fill, RoundedCornerShape(24.dp))
            .clickable(interactionSource = interaction, indication = null, role = Role.Button, onClick = onClick)
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = if (expanded) null else label, modifier = Modifier.size(24.dp), tint = iconTint)
        if (expanded) Text(label, style = TvText.nav, color = content, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** The thin line between the pages and the user's Plex lists; hidden with the lists when there are none (T03d C6). */
@Composable
fun SideMenuDivider(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(Tokens.borderOnVideo))
}

@Preview(widthDp = 400, heightDp = 300, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun NavItemPreview() = AppTheme {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
        Column(Modifier.width(56.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            NavItem("Home", TvIcons.Home, selected = false, expanded = false, onClick = {})
            NavItem("Discover", TvIcons.Explore, selected = true, expanded = false, onClick = {})
            SideMenuDivider()
            NavItem("Friday films", TvIcons.PlaylistPlay, selected = false, expanded = false, onClick = {})
        }
        Column(Modifier.width(256.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            NavItem("Home", TvIcons.Home, selected = true, expanded = true, onClick = {})
            NavItem("Films", TvIcons.Movie, selected = false, expanded = true, onClick = {}, modifier = Modifier.focusRequester(focus))
            NavItem("Search", TvIcons.Search, selected = false, expanded = true, onClick = {})
            SideMenuDivider()
            NavItem("Settings", TvIcons.Settings, selected = false, expanded = true, onClick = {})
        }
    }
}
