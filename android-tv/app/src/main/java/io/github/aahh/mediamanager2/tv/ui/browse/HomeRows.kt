package io.github.aahh.mediamanager2.tv.ui.browse

import android.os.SystemClock
import android.util.Log
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.ui.Tokens
import io.github.aahh.mediamanager2.tv.ui.components.EaseIn
import io.github.aahh.mediamanager2.tv.ui.components.EaseOut
import io.github.aahh.mediamanager2.tv.ui.components.HeroWords
import io.github.aahh.mediamanager2.tv.ui.components.LocalServerImages
import io.github.aahh.mediamanager2.tv.ui.components.ServerImage
import io.github.aahh.mediamanager2.tv.ui.components.TIMING_TAG
import io.github.aahh.mediamanager2.tv.ui.components.TvText
import io.github.aahh.mediamanager2.tv.ui.components.scrim
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * TV Home: a 16:9 picture at the top right, the focused card's [HeroWords] at the left, and [rails] below, where the
 * open row is large and the others small. Every row drives the top. The words change the moment focus moves, from
 * [heroes] (which the screen fills from one heroes read for every card) or else from what the card knows; a card the
 * read did not answer, or whose logo it still had loading, asks [heroFor] once focus has rested 300 ms. The picture
 * follows after a 200 ms rest and its load, and is prefetched as focus lands when its address is known; once focus has
 * rested, the pictures of the cards around it are prefetched too. Each row remembers its card. No card has text under it.
 *
 * Library cards open the hold-OK action list; [onChanged] runs after one of its actions, so the page reads again, and
 * focus stays where it was.
 */
@Composable
fun HomeRowsPage(
    rails: List<Rail>,
    library: LibraryApi,
    onOpen: (RailItem) -> Unit,
    onChanged: () -> Unit,
    heroFor: suspend (RailItem) -> Hero,
    heroes: SnapshotStateMap<String, Hero>,
    modifier: Modifier = Modifier,
) {
    var focus by remember { mutableStateOf(HomeFocus()) }
    var restedKey by remember { mutableStateOf<String?>(null) }
    val requester = remember { FocusRequester() }
    val scope = rememberCoroutineScope()
    val currentRails by rememberUpdatedState(rails)
    var verticalUntil by remember { mutableLongStateOf(0L) }
    var held by remember { mutableStateOf<Move?>(null) }
    var pageHasFocus by remember { mutableStateOf(false) }

    val images = LocalServerImages.current
    val pictureSize = with(LocalDensity.current) { IntSize(672.dp.roundToPx(), 378.dp.roundToPx()) }

    val open = focus.openIn(rails)
    val item = rails[open].items[focus.cardIn(rails[open])]
    val landed = remember(item.key) { SystemClock.uptimeMillis() }

    fun CoroutineScope.prefetchPicture(key: String) {
        val path = heroes[key]?.backdropPath ?: return
        images ?: return
        launch { images.prefetch(path, pictureSize.width, pictureSize.height, fill = true, kind = "picture") }
    }

    LaunchedEffect(item.key) {
        restedKey = null
        prefetchPicture(item.key)
        delay(PICTURE_REST_MS)
        restedKey = item.key
        delay(FOCUS_REST_MS - PICTURE_REST_MS)
        if (heroes[item.key]?.logoPending != false) {
            heroes[item.key] = heroFor(item)
            Log.i(TIMING_TAG, "fallback key=${item.key} ms=${SystemClock.uptimeMillis() - landed}")
        }
        for (near in picturesNear(currentRails, focus)) prefetchPicture(near.key)
    }
    LaunchedEffect(focus) { runCatching { requester.requestFocus() } }
    // A reload after an action takes focus back only if the page had it, so an open side menu keeps focus.
    LaunchedEffect(rails) { if (pageHasFocus) runCatching { requester.requestFocus() } }

    // Up and Down within 240 ms of the last one wait for the 240 ms to end; only the latest waiting one is applied, and
    // only if focus is still on the page. One that moves nothing neither starts nor extends the 240 ms.
    fun vertical(move: Move) {
        val now = SystemClock.uptimeMillis()
        if (now < verticalUntil) {
            if (held == null) {
                scope.launch {
                    delay(verticalUntil - now)
                    held?.let {
                        held = null
                        if (pageHasFocus) vertical(it)
                    }
                }
            }
            held = move
            return
        }
        val next = moveFocus(currentRails, focus, move)
        if (next.openIn(currentRails) == focus.openIn(currentRails)) return
        verticalUntil = now + 240
        focus = next
    }

    Box(
        modifier.fillMaxSize().background(Tokens.background).onFocusChanged { pageHasFocus = it.hasFocus }.onPreviewKeyEvent { event ->
            val move = when (event.key) {
                Key.DirectionLeft -> Move.Left
                Key.DirectionRight -> Move.Right
                Key.DirectionUp -> Move.Up
                Key.DirectionDown -> Move.Down
                else -> return@onPreviewKeyEvent false
            }
            // Left on the open row's first card is left to Compose, so focus can go to the side menu when it is open.
            if (move == Move.Left) {
                val row = currentRails[focus.openIn(currentRails)]
                if (moveFocus(currentRails, focus, move).cardIn(row) == focus.cardIn(row)) return@onPreviewKeyEvent false
            }
            if (event.type == KeyEventType.KeyDown) {
                if (move == Move.Left || move == Move.Right) focus = moveFocus(currentRails, focus, move) else vertical(move)
            }
            true
        },
    ) {
        HeroPicture(item.key, if (restedKey == item.key) heroes[item.key] else null, landed, Modifier.align(Alignment.TopEnd))
        Words(heroes[item.key] ?: heroOf(item), item.key, landed)
        // The rows, clipped at x 104 where the side menu would end.
        Box(Modifier.fillMaxSize().padding(start = 104.dp, top = 206.dp).clipToBounds()) {
            for (row in (open - 1).coerceAtLeast(0)..(open + 2).coerceAtMost(rails.lastIndex)) {
                val rail = rails[row]
                key(rail.key) { HomeRow(rail, row, open, focus.cardIn(rail), requester, library, onOpen, onChanged) }
            }
        }
    }
}

/**
 * One row. Open: 112 × 168 cards 124 apart, 48 under the row's top; closed: 90 × 135 (scaled from each card's top left)
 * 100 apart, 36 under, at 55%. Rows above the open one fade out. Everything moves over 220 ms.
 */
@Composable
private fun HomeRow(
    rail: Rail,
    row: Int,
    open: Int,
    card: Int,
    requester: FocusRequester,
    library: LibraryApi,
    onOpen: (RailItem) -> Unit,
    onChanged: () -> Unit,
) {
    val isOpen = row == open
    val above = row < open
    val openness = animateFloatAsState(if (isOpen) 1f else 0f, tween(220, easing = EaseOut), label = "row open")
    val top = animateFloatAsState(rowTop(row, open).toFloat(), tween(220, easing = EaseOut), label = "row top")
    val fade = animateFloatAsState(if (above) 0f else 1f, if (above) tween(120, easing = EaseIn) else tween(220, easing = EaseOut), label = "row fade")
    val count = rail.items.size
    val slideOpen = animateFloatAsState(rowSlide(card, count, 112f, 124f), tween(220, easing = EaseOut), label = "open slide")
    val slideClosed = animateFloatAsState(rowSlide(card, count, 90f, 100f), tween(220, easing = EaseOut), label = "closed slide")

    Text(
        rail.label,
        style = TvText.rowTitle,
        color = Tokens.foreground,
        maxLines = 1,
        modifier = Modifier
            .offset { IntOffset(16.dp.roundToPx(), top.value.dp.roundToPx()) }
            .graphicsLayer { alpha = fade.value * (0.5f + 0.5f * openness.value) },
    )
    // Only the cards near the screen are composed, so an Up or Down press builds a few cards, not whole rows.
    for (index in cardWindow(card, count)) {
        val item = rail.items[index]
        key(item.key) { HomeCard(item, index, isOpen && index == card, openness, slideOpen, slideClosed, top, fade, requester, library, onOpen, onChanged) }
    }
}

/** One card of a [HomeRow], placed and faded by the row's animations; [focusable] only for the open row's card. */
@Composable
private fun HomeCard(
    item: RailItem,
    index: Int,
    focusable: Boolean,
    openness: State<Float>,
    slideOpen: State<Float>,
    slideClosed: State<Float>,
    top: State<Float>,
    fade: State<Float>,
    requester: FocusRequester,
    library: LibraryApi,
    onOpen: (RailItem) -> Unit,
    onChanged: () -> Unit,
) {
    // Positions go through a placement offset, so the hold-OK list is anchored where the card really is.
    val placed = Modifier
        .offset { cardOffset(index, openness, slideOpen, slideClosed, top).let { (x, y) -> IntOffset(x.dp.roundToPx(), y.dp.roundToPx()) } }
        .graphicsLayer {
            val s = CLOSED_SCALE + (1f - CLOSED_SCALE) * openness.value
            scaleX = s
            scaleY = s
            transformOrigin = TransformOrigin(0f, 0f)
            alpha = fade.value * (0.55f + 0.45f * openness.value)
        }
        // Only the open row's remembered card can take focus, so focus coming from the side menu lands on it.
        .then(if (focusable) Modifier.focusRequester(requester) else Modifier.focusProperties { canFocus = false })
    RailCard(item, library, onOpen = { onOpen(item) }, onChanged = onChanged, modifier = placed, width = 112.dp, caption = false)
}

private const val CLOSED_SCALE = 90f / 112f

/** How long focus must rest on a card before its picture may fade in; the fallback read waits the full [FOCUS_REST_MS]. */
private const val PICTURE_REST_MS = 200L

// A card's place inside the rows' area (which starts at x 104 on the page): page x 120 + index × pitch − slide, with the
// open and closed numbers blended by how open the row is.
private fun cardOffset(index: Int, openness: State<Float>, slideOpen: State<Float>, slideClosed: State<Float>, top: State<Float>): Pair<Float, Float> {
    val o = openness.value
    val xOpen = 120f + index * 124f - slideOpen.value
    val xClosed = 120f + index * 100f - slideClosed.value
    return (xClosed + (xOpen - xClosed) * o - 104f) to (top.value + 36f + 12f * o)
}

/**
 * The words at start 120, top 40, for the focused card [key], whose focus [landed] at that uptime. A [wanted] with a
 * different title, facts or summary fades the words out over 50 ms, swaps them, and fades them in over 120 ms while the
 * logo box rises 4 dp; a change during the 50 ms only changes which words land. One that differs only in its logo, in
 * whether the logo is still pending, or in its picture swaps without a fade, so the facts and summary don't blink when
 * the logo arrives. The logo box stays empty while the logo is pending; the plain title shows for a title with no logo,
 * and from then on for one whose logo fails to load.
 */
@Composable
private fun Words(wanted: Hero, key: String, landed: Long) {
    val fade = remember { Animatable(1f) }
    val rise = remember { Animatable(0f) }
    var shown by remember { mutableStateOf(wanted to key) }
    val latest by rememberUpdatedState(wanted to key)
    val focusedKey by rememberUpdatedState(key)
    val landedAt by rememberUpdatedState(landed)
    val badLogos = remember { mutableStateMapOf<String, Unit>() }
    // The landing already logged, outside snapshot state so logging recomposes nothing.
    val logged = remember { LongArray(1) }

    fun logWords(shownKey: String) {
        if (shownKey != focusedKey || logged[0] == landedAt) return
        logged[0] = landedAt
        Log.i(TIMING_TAG, "words key=$shownKey ms=${SystemClock.uptimeMillis() - landedAt}")
    }

    LaunchedEffect(Unit) {
        var fadeIn: Job? = null
        snapshotFlow { latest }.collect {
            if (it.first.wordsOnly() == shown.first.wordsOnly()) {
                shown = it
                return@collect
            }
            fadeIn?.cancel()
            fade.animateTo(0f, tween(50, easing = EaseIn))
            shown = latest
            rise.snapTo(4f)
            fadeIn = launch {
                launch { rise.animateTo(0f, tween(120, easing = EaseOut)) }
                fade.animateTo(1f, tween(120, easing = EaseOut))
            }
        }
    }

    val (hero, shownKey) = shown
    val logoPath = hero.logoPath?.takeIf { it !in badLogos }
    val logo: (@Composable BoxScope.() -> Unit)? = when {
        hero.logoPending -> ({})
        logoPath != null -> ({
            ServerImage(
                logoPath,
                Modifier.fillMaxSize(),
                ContentScale.Fit,
                alignment = Alignment.BottomStart,
                onSuccess = { logWords(shownKey) },
                onError = { badLogos[logoPath] = Unit },
                timing = "logo",
            )
        })
        else -> null
    }
    if (logo == null) SideEffect { logWords(shownKey) }
    HeroWords(
        hero.title,
        hero.facts,
        hero.summary,
        Modifier.padding(start = 120.dp, top = 40.dp).graphicsLayer { alpha = fade.value },
        rise = { rise.value },
        logo = logo,
    )
}

// The parts of a hero whose change fades the words: everything but the logo, whether it is pending, and the picture.
private fun Hero.wordsOnly() = copy(logoPath = null, backdropPath = null, logoPending = false)

/** A picture on screen, or loading, and the card ([key]) it belongs to. */
private data class Picture(val path: String, val key: String)

/**
 * The 672 × 378 picture, crop centred under two gradients. The picture on screen fades out over 150 ms the moment focus
 * moves to another card. Once focus has rested 200 ms and the card's [known] hero has a picture, that picture loads as a
 * second layer and, once loaded, fades in from 1.03× over 600 ms and replaces the old one. A started fade finishes; a
 * load for a card that lost focus is dropped; no picture, or a failed load, fades the one on screen out over 160 ms.
 * [landed] is the uptime focus landed on [focusedKey], for the timing log.
 */
@Composable
private fun HeroPicture(focusedKey: String, known: Hero?, landed: Long, modifier: Modifier) {
    var onScreen by remember { mutableStateOf<Picture?>(null) }
    var incoming by remember { mutableStateOf<Picture?>(null) }
    var fading by remember { mutableStateOf(false) }
    var cleared by remember { mutableStateOf(false) }
    val screenAlpha = remember { Animatable(1f) }
    val inAlpha = remember { Animatable(0f) }
    val inScale = remember { Animatable(1.03f) }
    val scope = rememberCoroutineScope()
    val landedAt by rememberUpdatedState(landed)

    val otherCard = !cleared && onScreen?.key != focusedKey
    val screenTarget = when {
        cleared -> 0f
        otherCard -> 0f
        else -> 1f
    }
    LaunchedEffect(screenTarget, onScreen) {
        screenAlpha.animateTo(screenTarget, tween(if (otherCard) 150 else 160, easing = EaseOut))
        if (screenTarget == 0f) {
            onScreen = null
            cleared = false
        }
    }
    LaunchedEffect(focusedKey) { if (!fading && incoming?.key != focusedKey) incoming = null }
    LaunchedEffect(focusedKey, known) {
        val hero = known ?: return@LaunchedEffect
        snapshotFlow { fading }.first { !it }
        val path = hero.backdropPath
        val current = onScreen
        when {
            path == null -> cleared = true
            current != null && path == current.path -> {
                onScreen = current.copy(key = focusedKey)
                cleared = false
            }
            else -> {
                inAlpha.snapTo(0f)
                inScale.snapTo(1.03f)
                incoming = Picture(path, focusedKey)
            }
        }
    }

    fun fadeIn() {
        val arriving = incoming ?: return
        if (fading) return
        fading = true
        Log.i(TIMING_TAG, "picture-shown key=${arriving.key} ms=${SystemClock.uptimeMillis() - landedAt}")
        scope.launch {
            coroutineScope {
                launch { inScale.animateTo(1f, tween(600, easing = EaseOut)) }
                inAlpha.animateTo(1f, tween(600, easing = EaseOut))
            }
            screenAlpha.snapTo(1f)
            onScreen = arriving
            incoming = null
            cleared = false
            fading = false
        }
    }

    Box(modifier.size(672.dp, 378.dp).clipToBounds()) {
        for (picture in listOfNotNull(onScreen, incoming)) {
            key(picture.path) {
                val arriving = picture.path == incoming?.path
                ServerImage(
                    picture.path,
                    Modifier.fillMaxSize().graphicsLayer {
                        if (arriving) {
                            alpha = inAlpha.value
                            scaleX = inScale.value
                            scaleY = inScale.value
                        } else {
                            alpha = screenAlpha.value
                        }
                    },
                    onSuccess = { if (incoming?.path == picture.path) fadeIn() },
                    onError = {
                        if (incoming?.path == picture.path) {
                            incoming = null
                            cleared = true
                        }
                    },
                    timing = "picture",
                )
            }
        }
        val bg = Tokens.background
        Box(
            Modifier.fillMaxSize().scrim(
                Brush.horizontalGradient(0f to bg, 0.18f to bg.copy(alpha = 0.97f), 0.34f to bg.copy(alpha = 0.80f), 0.54f to bg.copy(alpha = 0.32f), 0.70f to bg.copy(alpha = 0f)),
                Brush.verticalGradient(0.42f to bg.copy(alpha = 0f), 0.70f to bg.copy(alpha = 0.55f), 0.90f to bg.copy(alpha = 0.92f), 1f to bg),
            ),
        )
    }
}
