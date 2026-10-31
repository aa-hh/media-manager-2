// tv/Browse/EpisodeRow — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=54-5074
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens

/** What the status column of an [EpisodeRow] says, and its tone. */
sealed interface EpisodeStatus {
    /** On disk: "1080p", "Watched", and so on, in `muted-foreground`. */
    data class Ready(val text: String) : EpisodeStatus

    /** Aired but not on disk, in `warning`. */
    data object Missing : EpisodeStatus

    /** Downloading: "Downloading 42%" with a lime line under it. */
    data class Downloading(val percent: Int) : EpisodeStatus

    /** Not aired yet: the air date, in `muted-foreground`. */
    data class Upcoming(val text: String) : EpisodeStatus
}

/**
 * One episode in a show's season list (T03a B2/B3): 76 high, radius 12, 10 in, 14 between its parts. A 100 × 56 [still]
 * (radius 6), the [title] ("3. The Lantern Room") over its [line] (air date and runtime) with an optional 120-wide watch
 * bar, the [status], and the monitor bookmark (filled when [monitored]). Focus fills the row `foreground` and turns its
 * words dark; it does not grow, so the long list does not jump.
 */
@Composable
fun EpisodeRow(
    title: String,
    line: String,
    status: EpisodeStatus,
    monitored: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    watchProgress: Float? = null,
    still: @Composable BoxScope.() -> Unit = {},
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val fill by animateFocusColor(focused, Tokens.control, Tokens.foreground)
    val titleColor by animateFocusColor(focused, Tokens.foreground, Tokens.background)
    val lineColor by animateFocusColor(focused, Tokens.mutedForeground, Tokens.faintForeground)
    val statusRest = if (status is EpisodeStatus.Missing) Tokens.warning else Tokens.mutedForeground
    val statusColor by animateFocusColor(focused, statusRest, if (status is EpisodeStatus.Missing) Tokens.warningSoft else Tokens.faintForeground)
    Row(
        modifier
            .fillMaxWidth()
            .height(76.dp)
            .background(fill, RoundedCornerShape(12.dp))
            .clickable(interactionSource = interaction, indication = null, role = Role.Button, onClick = onClick)
            .padding(horizontal = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(100.dp, 56.dp).clip(RoundedCornerShape(6.dp)).background(Tokens.muted), content = still)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = TvText.episodeTitle, color = titleColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(line, style = TvText.episodeLine, color = lineColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (watchProgress != null) {
                Line(watchProgress, 120.dp, if (focused) Tokens.background else Tokens.watchBar, Tokens.kbdOnVideo)
            }
        }
        Column(Modifier.width(120.dp), verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.End) {
            val text = when (status) {
                is EpisodeStatus.Ready -> status.text
                EpisodeStatus.Missing -> "Missing"
                is EpisodeStatus.Downloading -> "Downloading ${status.percent}%"
                is EpisodeStatus.Upcoming -> status.text
            }
            Text(text, style = TvText.episodeStatus, color = statusColor, maxLines = 1)
            if (status is EpisodeStatus.Downloading) Line(status.percent / 100f, 80.dp, Tokens.live, Tokens.kbdOnVideo)
        }
        Icon(
            if (monitored) TvIcons.Bookmark else TvIcons.BookmarkBorder,
            contentDescription = if (monitored) "Monitored" else "Not monitored",
            modifier = Modifier.size(22.dp),
            tint = lineColor,
        )
    }
}

/** A 3dp line [width] wide, [fraction] of it in [color] over [track]. */
@Composable
private fun Line(fraction: Float, width: Dp, color: Color, track: Color) {
    val shape = RoundedCornerShape(2.dp)
    Box(Modifier.width(width).height(3.dp).background(track, shape)) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).fillMaxHeight().background(color, shape))
    }
}

@Preview(widthDp = 720, heightDp = 280, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun EpisodeRowPreview() = AppTheme {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        EpisodeRow("1. Low Tide", "12 Sep 2026 · 52 min", EpisodeStatus.Ready("Watched"), monitored = true, onClick = {}, watchProgress = 1f)
        EpisodeRow("2. The Keeper’s Log", "19 Sep 2026 · 48 min", EpisodeStatus.Downloading(42), monitored = true, onClick = {}, modifier = Modifier.focusRequester(focus))
        EpisodeRow("3. The Lantern Room", "26 Sep 2026 · 50 min", EpisodeStatus.Missing, monitored = false, onClick = {})
    }
}
