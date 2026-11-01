package io.github.aahh.mediamanager2.tv.ui.browse

import io.github.aahh.mediamanager2.tv.api.ContinueWatchingItem
import io.github.aahh.mediamanager2.tv.api.DiscoverHome
import io.github.aahh.mediamanager2.tv.api.DiscoverResult
import io.github.aahh.mediamanager2.tv.api.DiscoverRow
import io.github.aahh.mediamanager2.tv.api.EpisodeRef
import io.github.aahh.mediamanager2.tv.api.LibraryTitle
import io.github.aahh.mediamanager2.tv.api.LibraryTitles
import io.github.aahh.mediamanager2.tv.api.LibraryWatch
import io.github.aahh.mediamanager2.tv.api.Playlist
import io.github.aahh.mediamanager2.tv.api.Playlists
import io.github.aahh.mediamanager2.tv.api.RecentlyAddedItem
import io.github.aahh.mediamanager2.tv.api.TitleWatch
import io.github.aahh.mediamanager2.tv.api.TrendingRows
import io.github.aahh.mediamanager2.tv.api.TvCounts
import io.github.aahh.mediamanager2.tv.api.UpcomingMovies
import io.github.aahh.mediamanager2.tv.ui.FilmRoute
import io.github.aahh.mediamanager2.tv.ui.PlexListRoute
import io.github.aahh.mediamanager2.tv.ui.ShowRoute
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private val show = LibraryTitle(type = "tv", service = "sonarr", id = 7, title = "The Quiet Year", year = 2026, tv = TvCounts(10, 12, 12, 2))
private val film = LibraryTitle(type = "movie", service = "radarr", id = 3, title = "Night Harbour", year = 2025)

private fun found(id: Int, type: String = "movie", libraryId: Int? = null) = DiscoverResult(tmdbId = id, type = type, title = "T$id", year = 2024, libraryId = libraryId)
private fun row(vararg ids: Int, pending: Boolean = false, failed: Boolean = false, id: String? = null, label: String? = null) =
    DiscoverRow(results = ids.map { found(it) }, pending = pending, failed = failed, id = id, label = label)

class RailsTest {
    // Home's Plex rows come in the order the owner set (T03a A6 notes), with Continue watching's episode and time left
    // under the card. Reordering the rows, or losing the episode line, turns this red.
    @Test
    fun plexRowsComeInTheOwnersOrderWithTheContinueLine() {
        val titles = LibraryTitles(
            titles = listOf(show, film),
            watch = LibraryWatch(
                kind = "ok",
                continueWatching = listOf(
                    ContinueWatchingItem("sonarr", 7, viewOffsetMs = 600_000, durationMs = 2_460_000, episode = EpisodeRef(1, 5)),
                    ContinueWatchingItem("radarr", 3, viewOffsetMs = 60_000, durationMs = 120_000),
                    ContinueWatchingItem("radarr", 99),
                ),
                recentlyAddedTv = listOf(RecentlyAddedItem("sonarr", 7, 1)),
                recentlyAddedFilms = listOf(RecentlyAddedItem("radarr", 3, 1)),
            ),
        )
        val rails = plexRails(titles, Playlists("ok", listOf(Playlist("12", "Friday films", itemCount = 24))))

        assertEquals(listOf("Continue watching", "Recently added TV", "Recently added films", "Playlists"), rails.map { it.label })
        val continuing = rails[0].items.map { it as RailItem.Title }
        assertEquals("a title no longer in the library is left out", 2, continuing.size)
        assertEquals("S1 E5 · 31 min left", continuing[0].subtitle)
        assertEquals("1 min left", continuing[1].subtitle)
        assertEquals(600_000f / 2_460_000, continuing[0].progress!!, 0.0001f)
        assertTrue(continuing.all { it.inContinueWatching })
        assertEquals("TV · 2026", (rails[1].items.single() as RailItem.Title).subtitle)
        assertEquals("Movie · 2025", (rails[2].items.single() as RailItem.Title).subtitle)
    }

    // An empty or failed row is hidden (plan T16a), and Plex being off or unavailable hides Playlists. Showing an empty
    // heading turns this red.
    @Test
    fun emptyOrMissingRowsAreHidden() {
        val empty = LibraryTitles(titles = listOf(show), watch = LibraryWatch(kind = "off"))
        assertEquals(emptyList<Rail>(), plexRails(empty, Playlists("off")))
        assertEquals(emptyList<Rail>(), plexRails(null, Playlists("ok", emptyList())))
        assertEquals(emptyList<Rail>(), traktRails(null, everyRow = true))
    }

    // Discover keeps the desktop's order with every row; Home keeps its short list. Rows still building or failed are
    // hidden. Dropping a row, or showing a pending one, turns this red.
    @Test
    fun discoverHasEveryRowAndHomeTheShortList() {
        val home = DiscoverHome(
            trending = TrendingRows(all = row(1)),
            popularMovies = row(2),
            popularTv = row(3, pending = true),
            upcomingMovies = UpcomingMovies(days30 = row(40), days90 = row(4)),
            upcomingTv = row(5, failed = true),
            services = listOf(DiscoverRow(results = listOf(found(6)), providerId = 8, name = "Netflix")),
            extraRows = listOf(row(7, id = "most-anticipated", label = "Most anticipated"), row(8, id = "box-office", label = "Weekend box office")),
        )
        assertEquals(
            listOf("Trending", "Popular movies", "Upcoming movies", "Netflix", "Most anticipated", "Weekend box office"),
            traktRails(home, everyRow = true).map { it.label },
        )
        assertEquals(listOf("Trending", "Popular movies", "Upcoming movies", "Most anticipated"), traktRails(home, everyRow = false).map { it.label })
        assertEquals("the 90-day upcoming row", 4, (traktRails(home, everyRow = false)[2].items.single() as RailItem.Found).result.tmdbId)
    }

    // OK opens the right page: Sonarr titles are shows, Trakt cards open only when in the library. Mixing up the ids
    // turns this red.
    @Test
    fun okOpensTheRightPage() {
        assertEquals(ShowRoute(7), openRoute(RailItem.Title(show, "")))
        assertEquals(FilmRoute(3), openRoute(RailItem.Title(film, "")))
        assertEquals(PlexListRoute("12", "Friday films"), openRoute(RailItem.PlexList(Playlist("12", "Friday films"))))
        assertEquals(ShowRoute(70), openRoute(RailItem.Found(found(1, type = "tv", libraryId = 70))))
        assertNull(openRoute(RailItem.Found(found(1))))
    }

    // The top line and the card marks follow Plex's counts; marking a half-watched show as played, or counting episodes
    // on a show nobody has started, turns this red.
    @Test
    fun overlineAndMarks() {
        assertEquals("Series · 2026 · 2 seasons", overline(RailItem.Title(show, "")))
        assertEquals("Movie · 2025", overline(RailItem.Title(film, "")))
        assertEquals("Plex list · 1 item", overline(RailItem.PlexList(Playlist("1", "x", itemCount = 1))))
        assertTrue(played(TitleWatch("movie", "1", viewCount = 1)))
        assertTrue(played(TitleWatch("show", "1", leafCount = 3, viewedLeafCount = 3)))
        assertFalse(played(TitleWatch("show", "1", leafCount = 3, viewedLeafCount = 2)))
        assertEquals(1, unwatched(TitleWatch("show", "1", leafCount = 3, viewedLeafCount = 2)))
        assertEquals("an unstarted show shows no count", 0, unwatched(TitleWatch("show", "1", leafCount = 3)))
    }
}
