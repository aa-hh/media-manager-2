// v2/TV/Player/IconButton — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=43-4057
// v2/TV/Player/TrackButton — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=43-4066
// v2/TV/Player/Timeline — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=43-4124
// v2/TV/Player/MenuRow — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=43-4103
// v2/TV/Player/Panel — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=46-4203
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens

/**
 * A round player control, 48dp with a 28dp icon in `foreground-on-dark`, no fill at rest. Focus grows it 1.1× with a
 * white 12% fill and the 3dp ring (Back 10 s, Play or Pause, Forward 30 s).
 */
@Composable
fun PlayerIconButton(icon: ImageVector, contentDescription: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val progress by animateFocus(focused)
    Box(
        modifier
            .focusGrow({ progress })
            .outerRing({ progress }, Tokens.ring)
            .size(48.dp)
            .background(Tokens.surfacePressedOnVideo.copy(alpha = Tokens.surfacePressedOnVideo.alpha * progress), CircleShape)
            .clickable(interactionSource = interaction, indication = null, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = contentDescription, modifier = Modifier.size(28.dp), tint = Tokens.foregroundOnDark)
    }
}

/**
 * A track choice in the controls row (Subtitles, Audio, Quality): a 20dp icon and the current choice, 16/600, 40 high,
 * no fill at rest. Focus is the same as [PlayerIconButton]'s.
 */
@Composable
fun TrackButton(label: String, icon: ImageVector, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val progress by animateFocus(focused)
    val shape = RoundedCornerShape(20.dp)
    Row(
        modifier
            .focusGrow({ progress })
            .outerRing({ progress }, Tokens.ring)
            .height(40.dp)
            .background(Tokens.surfacePressedOnVideo.copy(alpha = Tokens.surfacePressedOnVideo.alpha * progress), shape)
            .clickable(interactionSource = interaction, indication = null, role = Role.Button, onClick = onClick)
            .padding(horizontal = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp), tint = Tokens.foregroundOnDark)
        Text(label, style = TvText.label, color = Tokens.foregroundOnDark, maxLines = 1)
    }
}

/**
 * The player's line: a 4dp track in `input-on-dark`, what has loaded ahead in white 45%, the played part in
 * `foreground-on-dark` with a 14dp white dot at the play head, 3dp black gaps at chapter starts and a 2dp mark above the
 * intro; the elapsed time under its left end and the length under its right. It shows where play is; the remote moves it,
 * so it never takes focus. Times are in milliseconds.
 */
@Composable
fun Timeline(
    positionMs: Long,
    durationMs: Long,
    modifier: Modifier = Modifier,
    loadedMs: Long = positionMs,
    chapterStartsMs: List<Long> = emptyList(),
    introMs: LongRange? = null,
) {
    val length = durationMs.coerceAtLeast(1L).toFloat()
    fun at(ms: Long) = (ms / length).coerceIn(0f, 1f)
    Column(modifier.fillMaxWidth()) {
        Canvas(Modifier.fillMaxWidth().height(16.dp)) {
            val trackHeight = 4.dp.toPx()
            val top = (size.height - trackHeight) / 2f
            val radius = CornerRadius(trackHeight / 2f)
            fun bar(from: Float, to: Float, color: Color) = drawRoundRect(
                color = color,
                topLeft = Offset(size.width * from, top),
                size = Size(size.width * (to - from), trackHeight),
                cornerRadius = radius,
            )
            bar(0f, 1f, Tokens.inputOnDark)
            bar(0f, at(loadedMs), Tokens.focusOnDark.copy(alpha = 0.45f))
            bar(0f, at(positionMs), Tokens.foregroundOnDark)
            val gap = 3.dp.toPx()
            for (start in chapterStartsMs) {
                if (start <= 0L) continue
                drawRect(Tokens.background, topLeft = Offset(size.width * at(start) - gap / 2f, top), size = Size(gap, trackHeight))
            }
            if (introMs != null) {
                val mark = 2.dp.toPx()
                drawRect(
                    Tokens.markOnVideo,
                    topLeft = Offset(size.width * at(introMs.first), top - 2.dp.toPx() - mark),
                    size = Size(size.width * (at(introMs.last) - at(introMs.first)), mark),
                )
            }
            drawCircle(Tokens.focusOnDark, radius = 7.dp.toPx(), center = Offset(size.width * at(positionMs), size.height / 2f))
        }
        Spacer(Modifier.height(6.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(clock(positionMs), style = TvText.time, color = Tokens.foregroundOnDark)
            Text(clock(durationMs), style = TvText.time, color = Tokens.mutedForegroundOnDark)
        }
    }
}

// 24:18, or 1:02:05 past an hour.
private fun clock(ms: Long): String {
    val total = (ms.coerceAtLeast(0L) / 1000L)
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

/**
 * The small window the player's choices, the hold-OK list and Settings' choices open in: the `bar` fill, a 1dp white 12%
 * edge, radius 16, 16 in, rows 2 apart under an 18/700 heading ([compactHeading] is the 16/700 heading of the hold-OK
 * list). 280 wide in the player.
 */
@Composable
fun MenuPanel(
    heading: String,
    modifier: Modifier = Modifier,
    width: Dp = 280.dp,
    compactHeading: Boolean = false,
    rows: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier
            .width(width)
            .shadow(16.dp, shape, ambientColor = Tokens.shadow, spotColor = Tokens.shadow)
            .background(Tokens.bar, shape)
            .border(1.dp, Tokens.borderOnVideo, shape)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            heading,
            style = if (compactHeading) TvText.actionHeading else TvText.panelTitle,
            color = if (compactHeading) Tokens.foreground else Tokens.foregroundOnDark,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(8.dp))
        rows()
    }
}

/** The line between groups of rows in a [MenuPanel] (the subtitle choices, then Timing and Text size). */
@Composable
fun MenuSeparator(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().padding(vertical = 6.dp).height(1.dp).background(Tokens.borderOnVideo))
}

/**
 * One choice in a [MenuPanel]: 40 high, radius 10, a 20dp icon (the radio, filled when [checked], unless an [icon] is
 * given) and the label 16/600, with an optional 12/400 [detail] line. Focus is the off-white fill with dark words, as
 * the side menu and tabs, not the ring. Disabled is 40% and focus skips it.
 */
@Composable
fun MenuRow(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    checked: Boolean = false,
    icon: ImageVector = if (checked) TvIcons.RadioChecked else TvIcons.RadioUnchecked,
    detail: String? = null,
    enabled: Boolean = true,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val fill by animateFocusColor(focused, Tokens.control, Tokens.foregroundOnDark)
    val content by animateFocusColor(focused, Tokens.foregroundOnDark, Tokens.background)
    val secondary by animateFocusColor(focused, Tokens.mutedForegroundOnDark, Tokens.faintForeground)
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = 40.dp)
            .alpha(if (enabled) 1f else 0.4f)
            .background(fill, RoundedCornerShape(10.dp))
            .clickable(interactionSource = interaction, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp), tint = content)
        Column(Modifier.weight(1f)) {
            Text(label, style = TvText.label, color = content, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (detail != null) Text(detail, style = TvText.menuDetail, color = secondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Preview(widthDp = 960, heightDp = 160, backgroundColor = 0xFF2A2230, showBackground = true)
@Composable
private fun PlayerControlsPreview() = AppTheme {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Column(Modifier.padding(horizontal = 48.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Timeline(positionMs = 1_458_000, durationMs = 3_360_000, loadedMs = 1_900_000, chapterStartsMs = listOf(620_000, 2_200_000), introMs = 60_000L..300_000L)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            PlayerIconButton(TvIcons.Replay10, "Back 10 seconds", onClick = {})
            PlayerIconButton(TvIcons.PlayArrow, "Play", onClick = {}, modifier = Modifier.focusRequester(focus))
            PlayerIconButton(TvIcons.Forward30, "Forward 30 seconds", onClick = {})
            Spacer(Modifier.weight(1f))
            TrackButton("English", TvIcons.Subtitles, onClick = {})
            TrackButton("English 5.1", TvIcons.Audiotrack, onClick = {})
            TrackButton("Original", TvIcons.HighQuality, onClick = {})
        }
    }
}

@Preview(widthDp = 320, heightDp = 420, backgroundColor = 0xFF2A2230, showBackground = true)
@Composable
private fun MenuPanelPreview() = AppTheme {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Box(Modifier.padding(20.dp)) {
        MenuPanel(heading = "Subtitles") {
            MenuRow("Off", onClick = {})
            MenuRow("English", onClick = {}, checked = true, modifier = Modifier.focusRequester(focus))
            MenuRow("French", onClick = {})
            MenuSeparator()
            MenuRow("Timing", onClick = {}, icon = TvIcons.Timer, detail = "0.0 s")
            MenuRow("Text size", onClick = {}, icon = TvIcons.FormatSize, detail = "Normal", enabled = false)
        }
    }
}
