package io.github.aahh.mediamanager2.tv.ui.browse

import io.github.aahh.mediamanager2.tv.api.ContinueWatchingItem
import io.github.aahh.mediamanager2.tv.api.DiscoverHome
import io.github.aahh.mediamanager2.tv.api.DiscoverResult
import io.github.aahh.mediamanager2.tv.api.DiscoverRow
import io.github.aahh.mediamanager2.tv.api.EpisodeRef
import io.github.aahh.mediamanager2.tv.api.LibraryTitle
import io.github.aahh.mediamanager2.tv.api.LibraryTitles
import io.github.aahh.mediamanager2.tv.api.LibraryWatch
import io.github.aahh.mediamanager2.tv.api.MovieDetail
import io.github.aahh.mediamanager2.tv.api.Playlist
import io.github.aahh.mediamanager2.tv.api.Playlists
import io.github.aahh.mediamanager2.tv.api.RecentlyAddedItem
import io.github.aahh.mediamanager2.tv.api.SeriesDetail
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

    // Not watched yet leads Home, since the top of the page helps most on titles not started: titles in Plex never
    // started, newest added first. A started or watched title, or one Plex lacks, in that row turns this red.
    @Test
    fun notWatchedYetLeadsWithNewestUnstartedTitles() {
        val newShow = show.copy(id = 1, added = "2026-11-10", watch = TitleWatch("show", "a", leafCount = 8))
        val newFilm = film.copy(id = 2, added = "2026-11-12", watch = TitleWatch("movie", "b"))
        val started = film.copy(id = 4, added = "2026-11-14", watch = TitleWatch("movie", "c", viewOffsetMs = 60_000))
        val halfSeen = show.copy(id = 5, added = "2026-11-15", watch = TitleWatch("show", "d", leafCount = 8, viewedLeafCount = 2))
        val notInPlex = film.copy(id = 6, added = "2026-11-16")
        val titles = LibraryTitles(listOf(newShow, newFilm, started, halfSeen, notInPlex), LibraryWatch(kind = "ok"))

        val first = plexRails(titles, null).first()

        assertEquals("Not watched yet", first.label)
        assertEquals(listOf(2, 1), first.items.map { (it as RailItem.Title).title.id })
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

    // OK opens the right page: Sonarr titles are shows, Trakt cards open only when in the library and otherwise offer
    // the add dialog for the right service. Mixing up the ids, or offering to add a title already in the library, turns
    // this red.
    @Test
    fun okOpensTheRightPage() {
        assertEquals(ShowRoute(7), openRoute(RailItem.Title(show, "")))
        assertEquals(FilmRoute(3), openRoute(RailItem.Title(film, "")))
        assertEquals(PlexListRoute("12", "Friday films"), openRoute(RailItem.PlexList(Playlist("12", "Friday films"))))
        assertEquals(ShowRoute(70), openRoute(RailItem.Found(found(1, type = "tv", libraryId = 70))))
        assertNull(openRoute(RailItem.Found(found(1))))
        assertEquals(AddTarget("sonarr", 2, "T2"), addTarget(RailItem.Found(found(2, type = "tv"))))
        assertNull(addTarget(RailItem.Found(found(2, type = "tv", libraryId = 70))))
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

    // A row slides one pitch per card until its last card's right edge reaches x 912, and a row that fits never slides.
    // Dropping the clamp, or getting the 792 wide space wrong, turns this red.
    @Test
    fun rowSlideStopsAtTheRowEnd() {
        assertEquals(0f, rowSlide(4, 5, 112f, 124f), 0f)
        assertEquals(0f, rowSlide(0, 9, 112f, 124f), 0f)
        assertEquals(248f, rowSlide(2, 9, 112f, 124f), 0f)
        for (card in 3..8) assertEquals(312f, rowSlide(card, 9, 112f, 124f), 0f)
        assertEquals("the last card's right edge", 912f, 120f + 8 * 124f - rowSlide(8, 9, 112f, 124f) + 112f, 0f)
    }

    // The open row sits 12 into the rows' area, the next row's title at page y 460, the row above 183 out of sight.
    // Changing the 195 or 47 heights turns this red.
    @Test
    fun rowTopsFollowTheOpenRow() {
        assertEquals(12, rowTop(2, 2))
        assertEquals(254, rowTop(3, 2))
        assertEquals(460, 206 + rowTop(3, 2))
        assertEquals(-183, rowTop(1, 2))
    }

    // Each row keeps its own card across Up and Down, presses stop at the ends, and a row that got shorter reads as its
    // last card. Resetting a row's card on Up or Down, or letting focus run past an end, turns this red.
    @Test
    fun moveFocusKeepsEachRowsCard() {
        fun rail(key: String, size: Int) = Rail(key, key, (1..size).map { RailItem.Title(film.copy(id = it), "") })
        val rails = listOf(rail("a", 5), rail("b", 3))

        var focus = HomeFocus()
        focus = moveFocus(rails, focus, Move.Left)
        assertEquals("the first card stops Left", 0, focus.cardIn(rails[0]))
        repeat(2) { focus = moveFocus(rails, focus, Move.Right) }
        focus = moveFocus(rails, focus, Move.Down)
        assertEquals(1, focus.open)
        assertEquals("a row first opened starts at its first card", 0, focus.cardIn(rails[1]))
        repeat(5) { focus = moveFocus(rails, focus, Move.Right) }
        assertEquals("the last card stops Right", 2, focus.cardIn(rails[1]))
        focus = moveFocus(rails, focus, Move.Down)
        assertEquals("the last row stops Down", 1, focus.open)
        focus = moveFocus(rails, focus, Move.Up)
        assertEquals(0, focus.open)
        assertEquals("the first row kept its card", 2, focus.cardIn(rails[0]))
        focus = moveFocus(rails, focus, Move.Up)
        assertEquals("the first row stops Up", 0, focus.open)

        val shorter = listOf(rail("a", 2))
        assertEquals(1, HomeFocus(open = 3, cards = mapOf("a" to 4)).cardIn(shorter[0]))
        assertEquals("a gone row reads as the last row", 0, HomeFocus(open = 3).openIn(shorter))
        assertEquals("Left from past the end lands one before the last", 0, moveFocus(shorter, HomeFocus(cards = mapOf("a" to 4)), Move.Left).cardIn(shorter[0]))
    }

    // The top's facts line is year, length or seasons, and first genre, and the picture is always the 16:9 one. Reading
    // backdropUrl, or formatting the length wrong, turns this red.
    @Test
    fun heroFactsAndPicture() {
        val filmCard = RailItem.Title(film.copy(year = 2014), "")
        val filmDetail = MovieDetail(
            id = 3, title = "Night Harbour", runtime = 118, genres = listOf("Thriller", "Drama"), overview = "A pilot.",
            backdropUrl = "/wide.jpg", heroBackdropUrl = "/hero.jpg", logoUrl = "/logo.png",
        )
        assertEquals(Hero("Night Harbour", "2014 · 1h 58m · Thriller", "A pilot.", "/logo.png", "/hero.jpg"), heroOf(filmCard, film = filmDetail))
        assertEquals("2014 · 2h 0m · Thriller", heroOf(filmCard, film = filmDetail.copy(runtime = 120)).facts)
        assertEquals("2014 · 57m · Thriller", heroOf(filmCard, film = filmDetail.copy(runtime = 57)).facts)

        val showCard = RailItem.Title(show.copy(year = 2022), "")
        val showDetail = SeriesDetail(id = 7, title = "The Quiet Year", genres = listOf("Drama"), backdropUrl = "/wide.jpg", heroBackdropUrl = "/hero.jpg")
        assertEquals("2022 · 2 seasons · Drama", heroOf(showCard, show = showDetail).facts)
        assertEquals("/hero.jpg", heroOf(showCard, show = showDetail).backdropPath)
        assertEquals(Hero("The Quiet Year", "2022 · 2 seasons", null, null, null), heroOf(showCard))

        val trakt = RailItem.Found(found(9).copy(genres = listOf("Comedy", "Drama"), overview = "Fun.", backdropUrl = "/wide.jpg", heroBackdropUrl = "/hero.jpg"))
        assertEquals(Hero("T9", "2024 · Comedy", "Fun.", null, "/hero.jpg"), heroOf(trakt))

        assertEquals(Hero("x", "Plex list · 1 item", null, null, null), heroOf(RailItem.PlexList(Playlist("1", "x", itemCount = 1))))
    }
}
