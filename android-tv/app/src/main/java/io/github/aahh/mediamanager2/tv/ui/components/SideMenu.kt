// v2/TV/SideMenu — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=153-16550
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.downloads.MenuDownloads
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens

/**
 * One item of the side menu: a 40 high pill, a 24dp [icon] slot 16 in and, when [expanded], the label 12 after it. It is
 * 56 wide at rest and 160 wide when the menu is open. The slot receives the item's icon colour and may draw past its
 * edge. The page the user is on is [selected]: the off-white `foreground-on-dark` fill with a dark icon and label. Focus
 * changes no colour and no size: it adds a 3dp `focus-on-dark` outline inside the item's edge, and on the current page's
 * item the fill shrinks to 5 inside it.
 */
@Composable
fun NavItem(
    label: String,
    icon: @Composable (Color) -> Unit,
    selected: Boolean,
    expanded: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val focus by animateFocus(focused)
    val iconColor = if (selected) Tokens.background else Tokens.foreground
    val labelColor = if (selected) Tokens.background else Tokens.mutedForeground
    Row(
        modifier
            .width(if (expanded) 160.dp else 56.dp)
            .height(40.dp)
            .then(if (expanded) Modifier else Modifier.semantics { contentDescription = label })
            .drawWithContent {
                if (selected) {
                    val inset = 5.dp.toPx() * focus
                    val height = size.height - 2 * inset
                    drawRoundRect(
                        color = Tokens.foregroundOnDark,
                        topLeft = Offset(inset, inset),
                        size = Size(size.width - 2 * inset, height),
                        cornerRadius = CornerRadius(height / 2, height / 2),
                    )
                }
                drawContent()
                if (focus > 0f) {
                    val stroke = 3.dp.toPx()
                    val height = size.height - stroke
                    drawRoundRect(
                        color = Tokens.focusOnDark.copy(alpha = focus),
                        topLeft = Offset(stroke / 2, stroke / 2),
                        size = Size(size.width - stroke, height),
                        cornerRadius = CornerRadius(height / 2, height / 2),
                        style = Stroke(stroke),
                    )
                }
            }
            .clickable(interactionSource = interaction, indication = null, role = Role.Button, onClick = onClick)
            .padding(start = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(24.dp), contentAlignment = Alignment.Center) { icon(iconColor) }
        if (expanded) {
            Spacer(Modifier.width(12.dp))
            Text(label, style = TvText.nav, color = labelColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

/** The name over a group of side menu items ("Watch", "Manage"), shown while the menu is open. */
@Composable
fun NavGroupLabel(text: String, modifier: Modifier = Modifier) {
    Text(text, modifier, style = TvText.navGroup, color = Tokens.mutedForeground)
}

/**
 * The Downloads item's icon: a 28dp ring around a download arrow, centred on the 24dp icon slot. The arc fills clockwise
 * from the top with [downloads]' overall progress, in `live`, or `status-stalled` with a "!" in place of the arrow while
 * a download is stalled. [color] is the item's icon colour.
 */
@Composable
fun DownloadsRing(downloads: MenuDownloads?, color: Color) {
    val stalled = downloads?.stalled == true
    val fraction = downloads?.fraction
    Box(Modifier.requiredSize(28.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val radius = 11.9.dp.toPx()
            val stroke = Stroke(4.2.dp.toPx(), cap = StrokeCap.Butt)
            drawCircle(color.copy(alpha = color.alpha * 0.18f), radius = radius, style = stroke)
            if (fraction != null) {
                drawArc(
                    color = if (stalled) Tokens.statusStalled else Tokens.live,
                    startAngle = -90f,
                    sweepAngle = 360f * fraction,
                    useCenter = false,
                    topLeft = Offset(center.x - radius, center.y - radius),
                    size = Size(radius * 2, radius * 2),
                    style = stroke,
                )
            }
        }
        if (stalled) {
            Text("!", style = TvText.number(14), color = Tokens.statusStalled)
        } else {
            Icon(TvIcons.Download, contentDescription = null, modifier = Modifier.size(9.3333.dp), tint = color)
        }
    }
}

/** The Calendar item's icon: a 24 × 26 tile, centred on the icon slot, showing [day] of the month under a 6-high band. */
@Composable
fun DateTile(day: Int, color: Color) {
    Box(Modifier.requiredSize(24.dp, 26.dp).clip(RoundedCornerShape(5.dp)).background(Color.White.copy(alpha = 0.08f))) {
        Box(Modifier.fillMaxWidth().height(6.dp).background(color.copy(alpha = color.alpha * 0.35f)))
        Box(Modifier.padding(top = 6.dp).fillMaxWidth().height(20.dp), contentAlignment = Alignment.Center) {
            Text(day.toString(), style = TvText.number(15), color = color)
        }
    }
}

/** What covers the page while the side menu is open: `background` from 98% at the left edge to 40% at the right. */
val SideMenuScrim: Brush = Brush.horizontalGradient(
    0.0f to Tokens.background.copy(alpha = 0.98f),
    0.14f to Tokens.background.copy(alpha = 0.96f),
    0.23f to Tokens.background.copy(alpha = 0.90f),
    0.46f to Tokens.background.copy(alpha = 0.60f),
    1.0f to Tokens.background.copy(alpha = 0.40f),
)

// One column of the menu's pieces; [focusCurrent] puts focus on the current page's item instead of a plain one.
@Composable
private fun SideMenuPreviewColumn(expanded: Boolean, focusCurrent: Boolean) {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (expanded) NavGroupLabel("Watch", Modifier.padding(start = 16.dp))
        NavItem("Search", { Icon(TvIcons.Search, null, tint = it) }, selected = false, expanded = expanded, onClick = {})
        NavItem(
            "Home", { Icon(TvIcons.Home, null, tint = it) }, selected = true, expanded = expanded, onClick = {},
            modifier = if (focusCurrent) Modifier.focusRequester(focus) else Modifier,
        )
        NavItem(
            "Films", { Icon(TvIcons.Movie, null, tint = it) }, selected = false, expanded = expanded, onClick = {},
            modifier = if (focusCurrent) Modifier else Modifier.focusRequester(focus),
        )
        NavItem("Calendar", { DateTile(17, it) }, selected = false, expanded = expanded, onClick = {})
        NavItem("Downloads", { DownloadsRing(MenuDownloads(0.4f, false), it) }, selected = false, expanded = expanded, onClick = {})
        NavItem("Downloads", { DownloadsRing(MenuDownloads(0.4f, true), it) }, selected = false, expanded = expanded, onClick = {})
    }
}

@Preview(widthDp = 200, heightDp = 360, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun SideMenuCollapsedPreview() = AppTheme { SideMenuPreviewColumn(expanded = false, focusCurrent = false) }

@Preview(widthDp = 200, heightDp = 360, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun SideMenuCollapsedFocusCurrentPreview() = AppTheme { SideMenuPreviewColumn(expanded = false, focusCurrent = true) }

@Preview(widthDp = 200, heightDp = 380, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun SideMenuExpandedPreview() = AppTheme { SideMenuPreviewColumn(expanded = true, focusCurrent = false) }

@Preview(widthDp = 200, heightDp = 380, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun SideMenuExpandedFocusCurrentPreview() = AppTheme { SideMenuPreviewColumn(expanded = true, focusCurrent = true) }
