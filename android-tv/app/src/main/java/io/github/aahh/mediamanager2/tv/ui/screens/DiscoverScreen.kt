package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import io.github.aahh.mediamanager2.tv.api.ApiResult
import io.github.aahh.mediamanager2.tv.api.BrowseApi
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.ui.FilmRoute
import io.github.aahh.mediamanager2.tv.ui.Route
import io.github.aahh.mediamanager2.tv.ui.ShowRoute
import io.github.aahh.mediamanager2.tv.ui.browse.AddTarget
import io.github.aahh.mediamanager2.tv.ui.browse.EmptyRails
import io.github.aahh.mediamanager2.tv.ui.browse.Rail
import io.github.aahh.mediamanager2.tv.ui.browse.RailsPage
import io.github.aahh.mediamanager2.tv.ui.browse.addTarget
import io.github.aahh.mediamanager2.tv.ui.browse.openRoute
import io.github.aahh.mediamanager2.tv.ui.browse.summaryReader
import io.github.aahh.mediamanager2.tv.ui.browse.traktRails

/**
 * Discover: every desktop Discover row, in the desktop's order, with the focused card's backdrop and summary at the top.
 * Rows still being built on the server are left out; the page reads again once, a few seconds later, to pick them up.
 * FINAL frames: T03a A1.
 */
@Composable
fun DiscoverScreen(browse: BrowseApi, library: LibraryApi, onNavigate: (Route) -> Unit) {
    var rails by remember { mutableStateOf<List<Rail>?>(null) }
    var failed by remember { mutableStateOf(false) }
    var reads by remember { mutableIntStateOf(0) }
    var adding by remember { mutableStateOf<AddTarget?>(null) }
    val summaryFor = remember(library) { summaryReader(library) }

    LaunchedEffect(reads) {
        val result = browse.discoverHome()
        failed = result !is ApiResult.Ok
        val home = (result as? ApiResult.Ok)?.value
        // Keep what is shown when a later read fails.
        if (home != null || rails == null) rails = traktRails(home, everyRow = true)
        val stillBuilding = home != null && listOfNotNull(home.trending.all, home.popularMovies, home.popularTv, home.upcomingMovies?.days90, home.upcomingTv)
            .plus(home.services).plus(home.extraRows).any { it.pending }
        if (stillBuilding && reads == 0) {
            kotlinx.coroutines.delay(PENDING_RETRY_MS)
            reads += 1
        }
    }

    val shown = rails ?: return
    if (shown.isEmpty()) {
        if (failed) {
            EmptyRails("Can’t load Discover", "Media Manager didn’t answer. Try again in a minute.", action = "Try again", onAction = { reads += 1 })
        } else {
            EmptyRails("Nothing to show yet", "Discover’s rows are still being built. Try again in a minute.", action = "Try again", onAction = { reads += 1 })
        }
        return
    }
    RailsPage(
        shown,
        library,
        onOpen = { item -> openRoute(item)?.let(onNavigate) ?: addTarget(item)?.let { adding = it } },
        onChanged = { reads += 1 },
        summaryFor = summaryFor,
    )
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

private const val PENDING_RETRY_MS = 5_000L
