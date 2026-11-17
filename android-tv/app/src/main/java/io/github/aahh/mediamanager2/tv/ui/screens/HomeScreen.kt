package io.github.aahh.mediamanager2.tv.ui.screens

import android.os.SystemClock
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import io.github.aahh.mediamanager2.tv.api.ApiResult
import io.github.aahh.mediamanager2.tv.api.BrowseApi
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.ui.DiscoverRoute
import io.github.aahh.mediamanager2.tv.ui.FilmRoute
import io.github.aahh.mediamanager2.tv.ui.Route
import io.github.aahh.mediamanager2.tv.ui.ShowRoute
import io.github.aahh.mediamanager2.tv.ui.browse.AddTarget
import io.github.aahh.mediamanager2.tv.ui.browse.EmptyRails
import io.github.aahh.mediamanager2.tv.ui.browse.Hero
import io.github.aahh.mediamanager2.tv.ui.browse.HomeRowsPage
import io.github.aahh.mediamanager2.tv.ui.browse.Rail
import io.github.aahh.mediamanager2.tv.ui.browse.RailItem
import io.github.aahh.mediamanager2.tv.ui.browse.addTarget
import io.github.aahh.mediamanager2.tv.ui.browse.heroKeys
import io.github.aahh.mediamanager2.tv.ui.browse.heroOf
import io.github.aahh.mediamanager2.tv.ui.browse.heroReader
import io.github.aahh.mediamanager2.tv.ui.browse.openRoute
import io.github.aahh.mediamanager2.tv.ui.browse.plexRails
import io.github.aahh.mediamanager2.tv.ui.browse.traktRails
import io.github.aahh.mediamanager2.tv.ui.components.LocalServerImages
import io.github.aahh.mediamanager2.tv.ui.components.TIMING_TAG
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit

/**
 * Home, where the app opens: the Plex rows (Not watched yet first, then Continue watching, Recently added TV, Recently
 * added films, Playlists), then the Trakt rows. Every row drives the top of the page (the picture, logo, facts and
 * summary follow the focused card), and no card has text under it. A row that failed or is empty is hidden; with no
 * rows at all the page says so and offers Discover. FINAL frames: T03d A1, T03a A6 (rails scrolled), T03a A2 and T03d C6 (the side
 * menu, in Navigation.kt).
 */
@Composable
fun HomeScreen(library: LibraryApi, browse: BrowseApi, onNavigate: (Route) -> Unit) {
    var rails by remember { mutableStateOf<List<Rail>?>(null) }
    var reads by remember { mutableIntStateOf(0) }
    var adding by remember { mutableStateOf<AddTarget?>(null) }
    val heroFor = remember(library, browse) { heroReader(library, browse) }
    val heroes = remember { mutableStateMapOf<String, Hero>() }
    val started = remember { SystemClock.uptimeMillis() }
    val images = LocalServerImages.current
    val logoSize = with(LocalDensity.current) { IntSize(300.dp.roundToPx(), 64.dp.roundToPx()) }
    // Logos prefetched on this screen, logos being prefetched now, and whether the first frame of the rows has been
    // logged; none is drawn. A logo joins prefetched only once it loaded, so a cancelled or failed one is tried again.
    val prefetched = remember { mutableSetOf<String>() }
    val prefetching = remember { mutableSetOf<String>() }
    val frameLogged = remember { BooleanArray(1) }

    LaunchedEffect(reads) {
        val read = coroutineScope {
            val titles = async { library.titles() }
            val playlists = async { library.playlists() }
            val discover = async { browse.discoverHome() }
            plexRails((titles.await() as? ApiResult.Ok)?.value, (playlists.await() as? ApiResult.Ok)?.value) +
                traktRails((discover.await() as? ApiResult.Ok)?.value, everyRow = false)
        }
        Log.i(TIMING_TAG, "rows ms=${SystemClock.uptimeMillis() - started} rows=${read.size} cards=${read.sumOf { it.items.size }}")
        rails = read
    }

    // One heroes read for every card once the rows are known, and one more after 5 s for the logos it still had loading.
    LaunchedEffect(rails) {
        val shown = rails ?: return@LaunchedEffect
        val keys = heroKeys(shown)
        if (keys.isEmpty()) return@LaunchedEffect
        val items = buildMap<String, RailItem> { for (rail in shown) for (item in rail.items) getOrPut(item.key) { item } }
        val logoSlots = Semaphore(4)

        suspend fun ask(attempt: Int, asked: List<String>): List<String> {
            val result = library.heroes(asked)
            val answers = (result as? ApiResult.Ok)?.value?.heroes.orEmpty()
            val status = when (result) {
                is ApiResult.Ok -> "ok"
                is ApiResult.Error -> "error"
                is ApiResult.Failed -> "failed"
            }
            val counts = answers.values.groupingBy { it.logo }.eachCount()
            Log.i(
                TIMING_TAG,
                "heroes attempt=$attempt ms=${SystemClock.uptimeMillis() - started} status=$status asked=${asked.size} " +
                    "answered=${answers.size} ready=${counts["ready"] ?: 0} none=${counts["none"] ?: 0} loading=${counts["loading"] ?: 0}",
            )
            for (key in asked) {
                val answer = answers[key] ?: continue
                val item = items[key] ?: continue
                if (answer.logo == "loading" && heroes[key]?.logoPending == false) continue
                heroes[key] = heroOf(item, answer)
            }
            for (key in asked) {
                val path = answers[key]?.logoUrl ?: continue
                if (images == null || path in prefetched || !prefetching.add(path)) continue
                launch {
                    try {
                        if (logoSlots.withPermit { images.prefetch(path, logoSize.width, logoSize.height, fill = false, kind = "logo") }) {
                            prefetched.add(path)
                        }
                    } finally {
                        prefetching.remove(path)
                    }
                }
            }
            return asked.filter { answers[it]?.logo == "loading" }
        }

        val loading = ask(1, keys)
        if (loading.isNotEmpty()) {
            delay(5_000)
            ask(2, loading)
        }
    }

    val shown = rails ?: return
    if (shown.isEmpty()) {
        EmptyRails(
            "Nothing here yet",
            "Add a show or a film from Discover and it shows up here.",
            action = "Go to Discover",
            onAction = { onNavigate(DiscoverRoute) },
        )
        return
    }
    HomeRowsPage(
        shown,
        library,
        onOpen = { item -> openRoute(item)?.let(onNavigate) ?: addTarget(item)?.let { adding = it } },
        onChanged = { reads += 1 },
        heroFor = heroFor,
        heroes = heroes,
    )
    LaunchedEffect(Unit) {
        if (frameLogged[0]) return@LaunchedEffect
        withFrameNanos { }
        frameLogged[0] = true
        Log.i(TIMING_TAG, "first-frame ms=${SystemClock.uptimeMillis() - started}")
    }
    adding?.let { target ->
        AddDialog(
            library,
            browse,
            target.service,
            target.tmdbId,
            null,
            target.name,
            onAdded = { id ->
                adding = null
                reads += 1
                onNavigate(if (target.service == "sonarr") ShowRoute(id) else FilmRoute(id))
            },
            onDismiss = { adding = null },
        )
    }
}
