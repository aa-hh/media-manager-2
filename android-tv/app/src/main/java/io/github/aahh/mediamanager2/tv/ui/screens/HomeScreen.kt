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
import io.github.aahh.mediamanager2.tv.ui.DiscoverRoute
import io.github.aahh.mediamanager2.tv.ui.FilmRoute
import io.github.aahh.mediamanager2.tv.ui.Route
import io.github.aahh.mediamanager2.tv.ui.ShowRoute
import io.github.aahh.mediamanager2.tv.ui.browse.AddTarget
import io.github.aahh.mediamanager2.tv.ui.browse.EmptyRails
import io.github.aahh.mediamanager2.tv.ui.browse.Rail
import io.github.aahh.mediamanager2.tv.ui.browse.RailsPage
import io.github.aahh.mediamanager2.tv.ui.browse.addTarget
import io.github.aahh.mediamanager2.tv.ui.browse.openRoute
import io.github.aahh.mediamanager2.tv.ui.browse.plexRails
import io.github.aahh.mediamanager2.tv.ui.browse.summaryReader
import io.github.aahh.mediamanager2.tv.ui.browse.traktRails
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

/**
 * Home, where the app opens: the Plex rows (Continue watching, Recently added TV, Recently added films, Playlists), then
 * the Trakt rows; the top backdrop follows the focused card. A row that failed or is empty is hidden; with no rows at all
 * the page says so and offers Discover. FINAL frames: T03d A1, T03a A6 (rails scrolled), T03a A2 and T03d C6 (the side
 * menu, in Navigation.kt).
 */
@Composable
fun HomeScreen(library: LibraryApi, browse: BrowseApi, onNavigate: (Route) -> Unit) {
    var rails by remember { mutableStateOf<List<Rail>?>(null) }
    var reads by remember { mutableIntStateOf(0) }
    var adding by remember { mutableStateOf<AddTarget?>(null) }
    val summaryFor = remember(library) { summaryReader(library) }

    LaunchedEffect(reads) {
        rails = coroutineScope {
            val titles = async { library.titles() }
            val playlists = async { library.playlists() }
            val discover = async { browse.discoverHome() }
            plexRails((titles.await() as? ApiResult.Ok)?.value, (playlists.await() as? ApiResult.Ok)?.value) +
                traktRails((discover.await() as? ApiResult.Ok)?.value, everyRow = false)
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
