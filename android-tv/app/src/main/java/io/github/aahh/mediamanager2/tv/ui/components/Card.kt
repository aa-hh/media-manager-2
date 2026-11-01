// v2/TV/Card/Poster — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=53-4359
//   (focused: https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=53-4361)
// v2/TV/Card/Title — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=53-4360
// v2/TV/Card/Actions — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=56-5541
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.tv.material3.Border
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.api.ApiResult
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.api.Service
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens
import kotlin.math.roundToInt
import kotlinx.coroutines.launch

/**
 * A 2:3 poster card, [width] wide (104 in rails, 127 in the library grids). Focus grows it 1.1× from its centre with the
 * 3dp `ring` just outside its edge, over the gap, so its neighbours and its title never move; rows and grids leave room
 * for that growth (5% of the card on each side). Holding OK runs [onLongClick] (tv-material `Card`).
 *
 * The marks sit on the poster: [downloadingPercent] top left, [played] or [unwatched] top right, [watchProgress] as the
 * watch bar along the bottom. [poster] draws the picture; without one the card is the `muted` placeholder.
 */
@Composable
fun PosterCard(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    width: Dp = 127.dp,
    onLongClick: (() -> Unit)? = null,
    played: Boolean = false,
    unwatched: Int = 0,
    watchProgress: Float? = null,
    downloadingPercent: Int? = null,
    poster: @Composable BoxScope.() -> Unit = {},
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val progress by animateFocus(focused)
    val shape = RoundedCornerShape(12.dp)
    Card(
        onClick = onClick,
        onLongClick = onLongClick,
        modifier = modifier
            .width(width)
            .aspectRatio(2f / 3f)
            .focusGrow({ progress })
            .outerRing({ progress }, Tokens.ring, radius = 12.dp),
        shape = CardDefaults.shape(shape),
        colors = CardDefaults.colors(containerColor = Tokens.muted),
        // The growth and ring are drawn above on the shared 150 ms ease-out, so the card's own are off.
        scale = CardDefaults.scale(focusedScale = 1f),
        border = CardDefaults.border(focusedBorder = Border.None),
        interactionSource = interaction,
    ) {
        Box(Modifier.fillMaxSize()) {
            poster()
            if (downloadingPercent != null) {
                DownloadingTag(downloadingPercent, Modifier.align(Alignment.TopStart).padding(start = 6.dp, top = 8.dp))
            }
            if (played) {
                WatchMarkPlayed(Modifier.align(Alignment.TopEnd).padding(6.dp))
            } else if (unwatched > 0) {
                WatchMarkUnwatched(unwatched, Modifier.align(Alignment.TopEnd).padding(6.dp))
            }
            if (watchProgress != null) {
                ProgressBar(watchProgress, Modifier.align(Alignment.BottomCenter).padding(start = 8.dp, end = 8.dp, bottom = 8.dp))
            }
        }
    }
}

/** The title under a card, 16/500, and one muted line (type and year, or "S1 E5 · 31 min left"); neither moves on focus. */
@Composable
fun CardTitle(title: String, subtitle: String?, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(title, style = TvText.cardTitle, color = Tokens.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (subtitle != null) {
            Text(subtitle, style = TvText.cardSubtitle, color = Tokens.mutedForeground, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

/** What the hold-OK list acts on: a library title, by its Sonarr or Radarr id. */
data class CardActionTarget(
    val service: Service,
    val id: Int,
    /** The list's heading: the title, and on Continue Watching the episode ("The Quiet Year · S1 E5"). */
    val heading: String,
    val watched: Boolean,
    val monitored: Boolean,
    /** Only Continue Watching cards offer Remove from Continue Watching. */
    val inContinueWatching: Boolean,
)

enum class CardAction { MarkWatched, MarkUnwatched, Monitor, StopMonitoring, RemoveFromContinueWatching }

/**
 * A poster card with its title under it, 12 below. With an [actionTarget], holding OK opens the hold-OK action list
 * beside the card; [onActionDone] gets the action once the server has done it, so the page can reload the title.
 */
@Composable
fun PosterTile(
    title: String,
    subtitle: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    width: Dp = 127.dp,
    actionTarget: CardActionTarget? = null,
    library: LibraryApi? = null,
    onActionDone: (CardAction) -> Unit = {},
    played: Boolean = false,
    unwatched: Int = 0,
    watchProgress: Float? = null,
    downloadingPercent: Int? = null,
    poster: @Composable BoxScope.() -> Unit = {},
) {
    var actionsOpen by remember { mutableStateOf(false) }
    var bounds by remember { mutableStateOf<Rect?>(null) }
    Column(modifier.width(width)) {
        PosterCard(
            onClick = onClick,
            modifier = Modifier.onGloballyPositioned { bounds = it.boundsInWindow() },
            width = width,
            onLongClick = if (actionTarget != null && library != null) ({ actionsOpen = true }) else null,
            played = played,
            unwatched = unwatched,
            watchProgress = watchProgress,
            downloadingPercent = downloadingPercent,
            poster = poster,
        )
        Spacer(Modifier.height(12.dp))
        CardTitle(title, subtitle)
    }
    if (actionsOpen && actionTarget != null && library != null) {
        CardActionList(actionTarget, library, anchor = bounds, onDismiss = { actionsOpen = false }, onDone = {
            actionsOpen = false
            onActionDone(it)
        })
    }
}

/**
 * The hold-OK action list (T03a C1): a small window 16 beside [anchor] (the card, as it sits focused), top edges level,
 * on the left when there is no room on the right; the page behind dims to 50%. Mark as watched or unwatched, Monitor or
 * Stop monitoring, and Remove from Continue Watching on those cards. OK runs the focused action. While one runs, every
 * row and Back wait for it, so nothing is sent twice; when it is done the list closes and [onDone] gets it. A refusal
 * keeps the list open with one line saying who didn't answer.
 */
@Composable
fun CardActionList(target: CardActionTarget, library: LibraryApi, anchor: Rect?, onDismiss: () -> Unit, onDone: (CardAction) -> Unit) {
    val scope = rememberCoroutineScope()
    var running by remember { mutableStateOf<CardAction?>(null) }
    var problem by remember { mutableStateOf<String?>(null) }
    val first = remember { FocusRequester() }
    val service = if (target.service == "sonarr") "Sonarr" else "Radarr"

    fun run(action: CardAction) {
        if (running != null) return
        running = action
        problem = null
        scope.launch {
            val result = when (action) {
                CardAction.MarkWatched -> library.setWatched(target.service, target.id, watched = true)
                CardAction.MarkUnwatched -> library.setWatched(target.service, target.id, watched = false)
                CardAction.Monitor -> library.monitor(target.service, target.id, monitored = true)
                CardAction.StopMonitoring -> library.monitor(target.service, target.id, monitored = false)
                CardAction.RemoveFromContinueWatching -> library.removeFromContinueWatching(target.service, target.id)
            }
            running = null
            problem = when (result) {
                is ApiResult.Ok -> null
                is ApiResult.Failed -> "Can’t reach Media Manager."
                is ApiResult.Error -> if (action == CardAction.Monitor || action == CardAction.StopMonitoring) "$service didn’t answer." else "Plex didn’t answer."
            }
            if (result is ApiResult.Ok) onDone(action)
        }
    }

    val rows = buildList {
        add(if (target.watched) Triple(CardAction.MarkUnwatched, "Mark as unwatched", TvIcons.Check) else Triple(CardAction.MarkWatched, "Mark as watched", TvIcons.Check))
        add(if (target.monitored) Triple(CardAction.StopMonitoring, "Stop monitoring", TvIcons.BookmarkBorder) else Triple(CardAction.Monitor, "Monitor", TvIcons.Bookmark))
        if (target.inContinueWatching) add(Triple(CardAction.RemoveFromContinueWatching, "Remove from Continue Watching", TvIcons.VisibilityOff))
    }

    val properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)
    Dialog(onDismissRequest = { if (running == null) onDismiss() }, properties = properties) {
        DialogDim(0.5f)
        LaunchedEffect(Unit) { runCatching { first.requestFocus() } }
        AnchoredBeside(anchor) {
            MenuPanel(heading = target.heading, width = 340.dp, compactHeading = true) {
                rows.forEachIndexed { index, (action, label, icon) ->
                    MenuRow(
                        label = if (running == action) "$label…" else label,
                        onClick = { run(action) },
                        modifier = if (index == 0) Modifier.focusRequester(first) else Modifier,
                        icon = icon,
                    )
                }
                problem?.let {
                    Text(it, style = TvText.menuDetail, color = Tokens.destructive, modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp))
                }
            }
        }
    }
}

// Places its one child 16 to the right of [anchor] with top edges level, or to its left when the right has no room;
// centred when there is no anchor. Fills the dialog window, which covers the screen.
@Composable
private fun AnchoredBeside(anchor: Rect?, content: @Composable () -> Unit) {
    Layout(content = content, modifier = Modifier.fillMaxSize()) { measurables, constraints ->
        val panel = measurables.single().measure(constraints.copy(minWidth = 0, minHeight = 0))
        val gap = 16.dp.roundToPx()
        val maxX = (constraints.maxWidth - panel.width).coerceAtLeast(0)
        val maxY = (constraints.maxHeight - panel.height).coerceAtLeast(0)
        val (x, y) = if (anchor == null) {
            maxX / 2 to maxY / 2
        } else {
            val right = anchor.right.roundToInt() + gap
            val left = anchor.left.roundToInt() - gap - panel.width
            val x = if (right + panel.width <= constraints.maxWidth || left < 0) right.coerceAtMost(maxX) else left
            x to anchor.top.roundToInt().coerceIn(0, maxY)
        }
        layout(constraints.maxWidth, constraints.maxHeight) { panel.place(x, y) }
    }
}

@Preview(widthDp = 480, heightDp = 300, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun PosterCardPreview() = AppTheme {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Row(Modifier.padding(24.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
        PosterTile("Night Harbour", "Movie · 2025", onClick = {}, played = true)
        PosterTile(
            "The Quiet Year",
            "S1 E5 · 31 min left",
            onClick = {},
            modifier = Modifier.focusRequester(focus),
            unwatched = 3,
            watchProgress = 0.6f,
        )
        PosterTile("Iron Valley", "TV · 2023", onClick = {}, downloadingPercent = 64)
    }
}

@Preview(widthDp = 400, heightDp = 220, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun CardActionsPreview() = AppTheme {
    Box(Modifier.padding(24.dp)) {
        MenuPanel(heading = "The Quiet Year · S1 E5", width = 340.dp, compactHeading = true) {
            MenuRow("Mark as watched", onClick = {}, icon = TvIcons.Check)
            MenuRow("Stop monitoring", onClick = {}, icon = TvIcons.BookmarkBorder)
            MenuRow("Remove from Continue Watching", onClick = {}, icon = TvIcons.VisibilityOff)
        }
    }
}
