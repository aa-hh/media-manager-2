package io.github.aahh.mediamanager2.tv.ui.browse

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.gestures.BringIntoViewSpec
import androidx.compose.foundation.gestures.LocalBringIntoViewSpec
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.ui.Tokens
import io.github.aahh.mediamanager2.tv.ui.components.Backdrop
import io.github.aahh.mediamanager2.tv.ui.components.BackdropScrim
import io.github.aahh.mediamanager2.tv.ui.components.ButtonKind
import io.github.aahh.mediamanager2.tv.ui.components.CardActionTarget
import io.github.aahh.mediamanager2.tv.ui.components.PosterTile
import io.github.aahh.mediamanager2.tv.ui.components.ServerImage
import io.github.aahh.mediamanager2.tv.ui.components.TitleSummary
import io.github.aahh.mediamanager2.tv.ui.components.TvButton
import io.github.aahh.mediamanager2.tv.ui.components.TvText
import io.github.aahh.mediamanager2.tv.ui.components.animateFocus
import io.github.aahh.mediamanager2.tv.ui.components.focusGrow
import io.github.aahh.mediamanager2.tv.ui.components.outerRing
import kotlinx.coroutines.delay

/** What the top of the page says about the focused card, beyond its row item: the summary and the backdrop picture. */
data class Summary(val text: String?, val backdropPath: String?)

/** How long focus must rest on a card before the top of the page follows it, so moving along a row doesn't flash pictures. */
private const val FOCUS_REST_MS = 300L

/**
 * Home and Discover (T03d A1, T03a A1 and A6): the focused card's backdrop and summary at the top, then [rails] of cards.
 * The top follows focus once it rests ~300 ms and crossfades over 150 ms; [summaryFor] supplies the summary and backdrop
 * (a title's detail read, for library cards) and each answer is kept. Once the rows scroll past the first, the backdrop
 * fades out, as A6 draws. Focus starts on the first card of the first row.
 *
 * Library cards open the hold-OK action list; [onChanged] runs after one of its actions, so the page reads again.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun RailsPage(
    rails: List<Rail>,
    library: LibraryApi,
    onOpen: (RailItem) -> Unit,
    onChanged: () -> Unit,
    summaryFor: suspend (RailItem) -> Summary?,
    modifier: Modifier = Modifier,
) {
    var focused by remember { mutableStateOf<RailItem?>(null) }
    var focusedRail by remember { mutableStateOf(-1) }
    var shown by remember { mutableStateOf<RailItem?>(null) }
    val summaries = remember { mutableStateMapOf<String, Summary>() }
    val firstCard = remember { FocusRequester() }
    var focusPlaced by remember { mutableStateOf(false) }
    val list = rememberLazyListState()

    LaunchedEffect(focused) {
        val item = focused ?: return@LaunchedEffect
        delay(FOCUS_REST_MS)
        shown = item
        if (item.key !in summaries) summaryFor(item)?.let { summaries[item.key] = it }
    }
    // Back on the first row, the summary at the top comes back into view with it.
    LaunchedEffect(focusedRail) { if (focusedRail == 0) list.animateScrollToItem(0) }
    LaunchedEffect(rails.isNotEmpty()) {
        if (rails.isNotEmpty() && !focusPlaced) focusPlaced = runCatching { firstCard.requestFocus() }.isSuccess
    }

    val backdropAlpha by animateFloatAsState(if (list.firstVisibleItemIndex == 0) 1f else 0f, tween(150), label = "backdrop")
    val current = shown
    val summary = current?.let { summaries[it.key] }

    Box(modifier.fillMaxSize().background(Tokens.background)) {
        Backdrop(BackdropScrim.Browse, Modifier.alpha(backdropAlpha)) {
            Crossfade(summary?.backdropPath, animationSpec = tween(150), label = "backdrop picture") { path ->
                ServerImage(path, Modifier.fillMaxSize())
            }
        }
        // Scrolling keeps a focused card clear of the page's edges, so its 1.1× growth, ring and title are never cut off.
        CompositionLocalProvider(LocalBringIntoViewSpec provides rememberEdgeSpec(start = 40.dp, end = 64.dp)) {
        LazyColumn(state = list, modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 48.dp)) {
            item(key = "summary") {
                Box(Modifier.fillMaxWidth().height(288.dp)) {
                    if (current != null) {
                        TitleSummary(overline(current), nameOf(current), summary?.text, Modifier.padding(start = 120.dp, top = 110.dp))
                    }
                }
            }
            itemsIndexed(rails, key = { _, rail -> rail.key }) { railIndex, rail ->
                Column(Modifier.padding(bottom = 12.dp)) {
                    Text(rail.label, style = TvText.label, color = Tokens.foreground, modifier = Modifier.padding(start = 120.dp))
                    // Room above and below for the focused card's 1.1× growth and ring, which the row would otherwise clip.
                    CompositionLocalProvider(LocalBringIntoViewSpec provides rememberEdgeSpec(start = 120.dp, end = 48.dp)) {
                    LazyRow(
                        contentPadding = PaddingValues(start = 120.dp, end = 48.dp, top = 12.dp, bottom = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(20.dp),
                    ) {
                        itemsIndexed(rail.items, key = { _, item -> item.key }) { index, item ->
                            val tracking = Modifier
                                .onFocusChanged {
                                    if (it.hasFocus) {
                                        focused = item
                                        focusedRail = railIndex
                                    }
                                }
                                .then(if (railIndex == 0 && index == 0) Modifier.focusRequester(firstCard) else Modifier)
                            RailCard(item, library, onOpen = { onOpen(item) }, onChanged = onChanged, modifier = tracking)
                        }
                    }
                    }
                }
            }
        }
        }
    }
}

/**
 * Scrolls a focused card into view with at least [start] before it and [end] after it, instead of the default of just
 * touching the edge, where the scroll container would clip the card's growth and ring (and, down the page, its title).
 * A card bigger than the space between the two lines is lined up on [start].
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun rememberEdgeSpec(start: Dp, end: Dp): BringIntoViewSpec {
    val density = LocalDensity.current
    return remember(density, start, end) {
        val before = with(density) { start.toPx() }
        val after = with(density) { end.toPx() }
        object : BringIntoViewSpec {
            override fun calculateScrollDistance(offset: Float, size: Float, containerSize: Float): Float = when {
                offset < before || size > containerSize - before - after -> offset - before
                offset + size > containerSize - after -> offset + size - (containerSize - after)
                else -> 0f
            }
        }
    }
}

/** The page shown instead of the rows when there are none: one heading, one line and an optional button (T03d C5's layout). */
@Composable
fun EmptyRails(heading: String, line: String, action: String? = null, onAction: () -> Unit = {}) {
    val focus = remember { FocusRequester() }
    if (action != null) LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Column(Modifier.fillMaxSize().background(Tokens.background).padding(start = 120.dp, top = 120.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(heading, style = TvText.label.copy(fontSize = 20.sp, lineHeight = 25.sp), color = Tokens.foreground)
        Text(line, style = TvText.pageBody.copy(lineHeight = 19.sp), color = Tokens.mutedForeground)
        if (action != null) {
            Spacer(Modifier.height(16.dp))
            TvButton(action, onClick = onAction, kind = ButtonKind.Filled, modifier = Modifier.focusRequester(focus))
        }
    }
}

private fun nameOf(item: RailItem) = when (item) {
    is RailItem.Title -> item.title.title
    is RailItem.Found -> item.result.title
    is RailItem.PlexList -> item.playlist.title
}

@Composable
private fun RailCard(item: RailItem, library: LibraryApi, onOpen: () -> Unit, onChanged: () -> Unit, modifier: Modifier) {
    when (item) {
        is RailItem.Title -> {
            val title = item.title
            val watched = played(title.watch)
            val heading = listOfNotNull(title.title, item.episode?.let { "S${it.seasonNumber} E${it.episodeNumber}" }).joinToString(" · ")
            PosterTile(
                title = title.title,
                subtitle = item.subtitle,
                onClick = onOpen,
                modifier = modifier,
                width = 104.dp,
                actionTarget = CardActionTarget(title.service, title.id, heading, watched, title.monitored, item.inContinueWatching),
                library = library,
                onActionDone = { onChanged() },
                played = watched && !item.inContinueWatching,
                unwatched = if (item.inContinueWatching) 0 else unwatched(title.watch),
                watchProgress = item.progress,
            ) { ServerImage(title.smallPosterUrl ?: title.posterUrl, Modifier.fillMaxSize()) }
        }
        is RailItem.Found -> PosterTile(
            title = item.result.title,
            subtitle = item.subtitle,
            onClick = onOpen,
            modifier = modifier,
            width = 104.dp,
        ) { ServerImage(item.result.posterUrl, Modifier.fillMaxSize()) }
        is RailItem.PlexList -> PlaylistTile(item, library, onOpen, modifier)
    }
}

/**
 * A Plex list card (T03a A6): 200 × 113 with Plex's collage of the list, a bottom scrim and the item count, the list's
 * name under it. Focus grows it 1.1× with the ring, like the poster cards.
 */
@Composable
private fun PlaylistTile(item: RailItem.PlexList, library: LibraryApi, onOpen: () -> Unit, modifier: Modifier) {
    val interaction = remember { MutableInteractionSource() }
    val isFocused by interaction.collectIsFocusedAsState()
    val progress by animateFocus(isFocused)
    val shape = RoundedCornerShape(12.dp)
    Column(modifier.width(200.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Card(
            onClick = onOpen,
            modifier = Modifier.size(200.dp, 113.dp).focusGrow({ progress }).outerRing({ progress }, Tokens.ring, radius = 12.dp),
            shape = CardDefaults.shape(shape),
            colors = CardDefaults.colors(containerColor = Tokens.muted),
            scale = CardDefaults.scale(focusedScale = 1f),
            border = CardDefaults.border(focusedBorder = Border.None),
            interactionSource = interaction,
        ) {
            Box(Modifier.fillMaxSize()) {
                ServerImage(library.playlistCollage(item.playlist.id).encodedPath, Modifier.fillMaxSize())
                Box(
                    Modifier.fillMaxWidth().height(57.dp).align(Alignment.BottomCenter)
                        .background(Brush.verticalGradient(listOf(Tokens.background.copy(alpha = 0f), Tokens.background.copy(alpha = 0.9f)))),
                )
                Text(
                    itemCount(item.playlist.itemCount),
                    style = TvText.badge.copy(fontSize = 11.sp, fontWeight = FontWeight.Medium),
                    color = Tokens.foreground,
                    modifier = Modifier.align(Alignment.BottomStart).padding(start = 12.dp, bottom = 12.dp),
                )
            }
        }
        Text(
            item.playlist.title,
            style = TvText.label.copy(fontSize = 14.sp, lineHeight = 17.sp),
            color = Tokens.foreground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
