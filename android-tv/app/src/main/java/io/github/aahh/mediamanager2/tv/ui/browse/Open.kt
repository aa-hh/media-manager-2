package io.github.aahh.mediamanager2.tv.ui.browse

import io.github.aahh.mediamanager2.tv.api.ApiResult
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.ui.FilmRoute
import io.github.aahh.mediamanager2.tv.ui.PlexListRoute
import io.github.aahh.mediamanager2.tv.ui.Route
import io.github.aahh.mediamanager2.tv.ui.ShowRoute

/**
 * Where OK on a card goes: a library title's page, a Plex list's page, or a Trakt card's page when that title is already
 * in the library. A Trakt card for a title not in the library goes nowhere yet: adding it is T18's dialog.
 */
fun openRoute(item: RailItem): Route? = when (item) {
    is RailItem.Title -> if (item.title.service == "sonarr") ShowRoute(item.title.id) else FilmRoute(item.title.id)
    is RailItem.PlexList -> PlexListRoute(item.playlist.id, item.playlist.title)
    is RailItem.Found -> item.result.libraryId?.let { if (item.result.type == "tv") ShowRoute(it) else FilmRoute(it) }
}

/**
 * The top of the page for a card. A Trakt card carries its own summary and backdrop; a library card needs its title's
 * detail read (null when that fails, so the top shows the overline and title only); a Plex list shows its collage.
 */
fun summaryReader(library: LibraryApi): suspend (RailItem) -> Summary? = { item ->
    when (item) {
        is RailItem.Found -> Summary(item.result.overview, item.result.backdropUrl)
        is RailItem.PlexList -> Summary(null, library.playlistCollage(item.playlist.id).encodedPath)
        is RailItem.Title -> if (item.title.service == "sonarr") {
            (library.series(item.title.id) as? ApiResult.Ok)?.value?.let { Summary(it.overview, it.backdropUrl) }
        } else {
            (library.movie(item.title.id) as? ApiResult.Ok)?.value?.let { Summary(it.overview, it.backdropUrl) }
        }
    }
}
