package io.github.aahh.mediamanager2.tv.ui.browse

import io.github.aahh.mediamanager2.tv.api.DiscoverHome
import io.github.aahh.mediamanager2.tv.api.DiscoverResult
import io.github.aahh.mediamanager2.tv.api.DiscoverRow
import io.github.aahh.mediamanager2.tv.api.EpisodeRef
import io.github.aahh.mediamanager2.tv.api.HeroAnswer
import io.github.aahh.mediamanager2.tv.api.LibraryTitle
import io.github.aahh.mediamanager2.tv.api.LibraryTitles
import io.github.aahh.mediamanager2.tv.api.MovieDetail
import io.github.aahh.mediamanager2.tv.api.Playlist
import io.github.aahh.mediamanager2.tv.api.Playlists
import io.github.aahh.mediamanager2.tv.api.SeriesDetail
import io.github.aahh.mediamanager2.tv.api.TitleWatch
import kotlin.math.ceil
import kotlin.math.floor

// The rows of Home and Discover, worked out from the server's replies (T03d A1, T03a A1 and A6). Pure, so it is tested
// without a screen.

/** One card in a row. [key] is unique within its row. */
sealed interface RailItem {
    val key: String

    /** A title in the library. [subtitle] is the line under the card; [progress] the watch bar, 0–1. */
    data class Title(
        val title: LibraryTitle,
        val subtitle: String,
        val progress: Float? = null,
        val episode: EpisodeRef? = null,
        val inContinueWatching: Boolean = false,
    ) : RailItem {
        override val key get() = "${title.service}:${title.id}"
    }

    /** A Trakt card from Discover; [result]'s `libraryId` is set when it is already in the library. */
    data class Found(val result: DiscoverResult) : RailItem {
        override val key get() = "${result.type}:${result.tmdbId}"
        val subtitle get() = typeAndYear(result.type == "tv", result.year)
    }

    /** One of the signed-in Plex user's lists. */
    data class PlexList(val playlist: Playlist) : RailItem {
        override val key get() = "list:${playlist.id}"
    }
}

data class Rail(val key: String, val label: String, val items: List<RailItem>)

/**
 * Home's Plex rows, in order: Not watched yet, Continue watching, Recently added TV, Recently added films, Playlists. A row
 * whose reply failed or has nothing in it is left out, as is any item whose title is no longer in the library.
 *
 * Every Home row drives the top of the page. Not watched yet still comes first because the top helps most on titles the
 * viewer has added but not started; a show they watch every week needs no picture.
 */
fun plexRails(titles: LibraryTitles?, playlists: Playlists?): List<Rail> = buildList {
    if (titles != null) {
        val byKey = titles.titles.associateBy { "${it.service}:${it.id}" }
        // razor: newest 20 by date added; a "see all" page is the upgrade if the viewer wants the rest.
        addRail("not-watched", "Not watched yet", titles.titles.filter { notStarted(it.watch) }.sortedByDescending { it.added }.take(20).map(::libraryItem))
        val continueWatching = titles.watch.continueWatching.mapNotNull { item ->
            val title = byKey["${item.service}:${item.id}"] ?: return@mapNotNull null
            RailItem.Title(
                title,
                subtitle = continueLine(title, item.episode, item.viewOffsetMs, item.durationMs),
                progress = fraction(item.viewOffsetMs, item.durationMs),
                episode = item.episode,
                inContinueWatching = true,
            )
        }
        addRail("continue-watching", "Continue watching", continueWatching)
        addRail("recent-tv", "Recently added TV", titles.watch.recentlyAddedTv.mapNotNull { byKey["${it.service}:${it.id}"]?.let(::libraryItem) })
        addRail("recent-films", "Recently added films", titles.watch.recentlyAddedFilms.mapNotNull { byKey["${it.service}:${it.id}"]?.let(::libraryItem) })
    }
    if (playlists != null && playlists.kind == "ok") addRail("playlists", "Playlists", playlists.playlists.map(RailItem::PlexList))
}

/**
 * The Trakt rows. Discover ([everyRow]) has every desktop Discover row in the desktop's order: Trending, Popular movies,
 * Popular TV, Upcoming movies (90 days), Upcoming TV, one row per streaming service, then the extra rows. Home keeps the
 * short list from the T03a notes: Trending, Popular movies, Popular TV, Upcoming movies, Upcoming TV, Most anticipated.
 * A row still being built, failed or empty is left out.
 */
fun traktRails(home: DiscoverHome?, everyRow: Boolean): List<Rail> = buildList {
    if (home == null) return@buildList
    addTrakt("trending", "Trending", home.trending.all)
    addTrakt("popular-movies", "Popular movies", home.popularMovies)
    addTrakt("popular-tv", "Popular TV", home.popularTv)
    addTrakt("upcoming-movies", "Upcoming movies", home.upcomingMovies?.days90)
    addTrakt("upcoming-tv", "Upcoming TV", home.upcomingTv)
    if (everyRow) {
        for (row in home.services) addTrakt("service:${row.providerId ?: row.name}", row.name ?: "Streaming service", row)
        for (row in home.extraRows) addTrakt("extra:${row.id ?: row.label}", row.label ?: continue, row)
    } else {
        home.extraRows.firstOrNull { it.id == "most-anticipated" }?.let { addTrakt("extra:most-anticipated", it.label ?: "Most anticipated", it) }
    }
}

/** The line at the top of the page for the focused card: "Series · 2026 · 2 seasons", "Movie · 2025", "Plex list · 24 items". */
fun overline(item: RailItem): String = when (item) {
    is RailItem.Title -> {
        val title = item.title
        val seasons = title.tv?.seasonCount?.takeIf { it > 0 }?.let { if (it == 1) "1 season" else "$it seasons" }
        listOfNotNull(if (title.type == "tv") "Series" else "Movie", title.year?.toString(), seasons).joinToString(" · ")
    }
    is RailItem.Found -> listOfNotNull(if (item.result.type == "tv") "Series" else "Movie", item.result.year?.toString()).joinToString(" · ")
    is RailItem.PlexList -> "Plex list · ${itemCount(item.playlist.itemCount)}"
}

fun itemCount(count: Int) = if (count == 1) "1 item" else "$count items"

/**
 * What Home's top shows for a card: the plain [title] (always the accessibility label, and shown when there is no logo),
 * the [facts] line, the [summary], the [logoPath] and the 16:9 [backdropPath]. [logoPending] means the logo is not known
 * yet, so the logo box stays empty.
 */
data class Hero(
    val title: String,
    val facts: String,
    val summary: String?,
    val logoPath: String?,
    val backdropPath: String?,
    val logoPending: Boolean = false,
)

/**
 * The [Hero] for a card. A library title's summary, logo and picture come from its detail ([show] or [film]) and are null
 * without it; its year and season count come from the card. Facts are the parts that exist, joined with " · ". A library
 * title with no detail and a Trakt card don't know their logo yet.
 */
fun heroOf(item: RailItem, show: SeriesDetail? = null, film: MovieDetail? = null): Hero = when (item) {
    is RailItem.Title -> {
        val title = item.title
        val pending = show == null && film == null
        if (title.service == "sonarr") {
            Hero(title.title, libraryFacts(item, null, show?.genres?.firstOrNull()), show?.overview, show?.logoUrl, show?.heroBackdropUrl, pending)
        } else {
            Hero(title.title, libraryFacts(item, film?.runtime, film?.genres?.firstOrNull()), film?.overview, film?.logoUrl, film?.heroBackdropUrl, pending)
        }
    }
    is RailItem.Found -> Hero(
        item.result.title,
        facts(item.result.year?.toString(), item.result.genres.firstOrNull()),
        item.result.overview,
        null,
        item.result.heroBackdropUrl,
        logoPending = true,
    )
    is RailItem.PlexList -> Hero(item.playlist.title, "Plex list · ${itemCount(item.playlist.itemCount)}", null, null, null)
}

/**
 * The [Hero] for a card from the heroes read's [answer]: the same facts as the detail form, with the logo still pending
 * while the answer says `loading`. A Trakt card keeps its own words and picture and takes only the logo.
 */
fun heroOf(item: RailItem, answer: HeroAnswer): Hero {
    val pending = answer.logo == "loading"
    return when (item) {
        is RailItem.Title -> Hero(
            item.title.title,
            libraryFacts(item, answer.runtime, answer.genre),
            answer.overview,
            answer.logoUrl,
            answer.heroBackdropUrl,
            pending,
        )
        is RailItem.Found -> heroOf(item).copy(logoPath = answer.logoUrl, logoPending = pending)
        is RailItem.PlexList -> heroOf(item)
    }
}

// Year, then seasons (from the card, for a show) or length (for a film), then genre.
private fun libraryFacts(item: RailItem.Title, runtime: Int?, genre: String?): String {
    val title = item.title
    val middle = if (title.service == "sonarr") {
        title.tv?.seasonCount?.takeIf { it > 0 }?.let { if (it == 1) "1 season" else "$it seasons" }
    } else {
        runtime?.takeIf { it > 0 }?.let { if (it < 60) "${it}m" else "${it / 60}h ${it % 60}m" }
    }
    return facts(title.year?.toString(), middle, genre)
}

private fun facts(vararg parts: String?) = parts.filterNotNull().joinToString(" · ")

/** The keys the heroes read asks for: library and Trakt cards in row order, each once, at most 300; Plex lists left out. */
fun heroKeys(rails: List<Rail>): List<String> =
    rails.asSequence().flatMap { it.items }.filter { it !is RailItem.PlexList }.map { it.key }.distinct().take(300).toList()

/**
 * The cards of a row worth composing while card [card] of [count] is its remembered one: every card on screen in either
 * the open (112 wide, 124 apart) or the closed (90 wide, 100 apart) layout between x 104 and 960, and two more each side.
 */
fun cardWindow(card: Int, count: Int): IntRange {
    var first = Int.MAX_VALUE
    var last = Int.MIN_VALUE
    for ((width, pitch) in listOf(112f to 124f, 90f to 100f)) {
        val s = rowSlide(card, count, width, pitch)
        // Smallest i with 120 + i·pitch − s + width > 104, and largest i with 120 + i·pitch − s < 960.
        first = minOf(first, floor((104f - 120f + s - width) / pitch).toInt() + 1)
        last = maxOf(last, ceil((960f - 120f + s) / pitch).toInt() - 1)
    }
    val end = maxOf(0, count - 1)
    return (first - 2).coerceIn(0, end)..(last + 2).coerceIn(0, end)
}

/**
 * The cards whose pictures are worth loading early from [focus]: the open row's cards two either side of the focused one,
 * then the remembered card of the row above and of the row below.
 */
fun picturesNear(rails: List<Rail>, focus: HomeFocus): List<RailItem> {
    if (rails.isEmpty()) return emptyList()
    val open = focus.openIn(rails)
    val row = rails[open]
    val card = focus.cardIn(row)
    return listOf(-2, -1, 1, 2).mapNotNull { row.items.getOrNull(card + it) } +
        listOfNotNull(rails.getOrNull(open - 1), rails.getOrNull(open + 1)).map { it.items[focus.cardIn(it)] }
}

/**
 * How far a row of [count] cards slides left so card [focus] is in view: one [pitch] per card, never past the point where
 * the last card's right edge (a [cardWidth] card) sits at x 912 on the page, and never for a row that already fits.
 */
fun rowSlide(focus: Int, count: Int, cardWidth: Float, pitch: Float): Float =
    (focus * pitch).coerceIn(0f, maxOf(0f, (count - 1) * pitch + cardWidth - 792f))

/** A Home row's top inside the rows' area: the open row at 12, closed rows 195 apart, rows below the open one 47 lower. */
fun rowTop(row: Int, open: Int): Int = 12 + (row - open) * 195 + if (row > open) 47 else 0

enum class Move { Left, Right, Up, Down }

/** Home's focus: the open row, and the card each row last had focus on, by [Rail.key] (0 when absent). */
data class HomeFocus(val open: Int = 0, val cards: Map<String, Int> = emptyMap()) {
    /** The open row in [rails]; past the last row reads as the last row. */
    fun openIn(rails: List<Rail>): Int = open.coerceIn(0, maxOf(0, rails.lastIndex))

    /** [rail]'s card; past its last card reads as its last card. */
    fun cardIn(rail: Rail): Int = (cards[rail.key] ?: 0).coerceIn(0, maxOf(0, rail.items.lastIndex))
}

/**
 * One press on Home: Left and Right move along the open row, stopping at its ends; Up and Down change the open row,
 * stopping at the first and last, and every row keeps its own card.
 */
fun moveFocus(rails: List<Rail>, focus: HomeFocus, move: Move): HomeFocus {
    if (rails.isEmpty()) return focus
    val open = focus.openIn(rails)
    return when (move) {
        Move.Up -> focus.copy(open = (open - 1).coerceAtLeast(0))
        Move.Down -> focus.copy(open = (open + 1).coerceAtMost(rails.lastIndex))
        Move.Left, Move.Right -> {
            val rail = rails[open]
            val card = (focus.cardIn(rail) + if (move == Move.Right) 1 else -1).coerceIn(0, rail.items.lastIndex)
            focus.copy(open = open, cards = focus.cards + (rail.key to card))
        }
    }
}

/** Plex's played mark: a film watched at least once, or a show with every episode watched. */
fun played(watch: TitleWatch?): Boolean = when {
    watch == null -> false
    watch.kind == "show" -> watch.leafCount > 0 && watch.viewedLeafCount >= watch.leafCount
    else -> watch.viewCount > 0
}

/** In Plex and never started: a film with no views and no resume point, or a show with episodes and none watched. */
fun notStarted(watch: TitleWatch?): Boolean = when {
    watch == null -> false
    watch.kind == "show" -> watch.leafCount > 0 && watch.viewedLeafCount == 0
    else -> watch.viewCount == 0 && watch.viewOffsetMs == null
}

/** Episodes left to watch on a show that has been started; 0 otherwise, when the card shows no count. */
fun unwatched(watch: TitleWatch?): Int =
    if (watch?.kind == "show" && watch.viewedLeafCount > 0) (watch.leafCount - watch.viewedLeafCount).coerceAtLeast(0) else 0

private fun libraryItem(title: LibraryTitle) = RailItem.Title(title, typeAndYear(title.type == "tv", title.year))

private fun typeAndYear(tv: Boolean, year: Int?) = listOfNotNull(if (tv) "TV" else "Movie", year?.toString()).joinToString(" · ")

// "S1 E5 · 31 min left" for an episode, "31 min left" for a film, else type and year.
private fun continueLine(title: LibraryTitle, episode: EpisodeRef?, offsetMs: Long?, durationMs: Long?): String {
    val left = if (offsetMs != null && durationMs != null && durationMs > offsetMs) "${(durationMs - offsetMs + 59_999) / 60_000} min left" else null
    val where = episode?.let { "S${it.seasonNumber} E${it.episodeNumber}" }
    return listOfNotNull(where, left).joinToString(" · ").ifEmpty { typeAndYear(title.type == "tv", title.year) }
}

private fun fraction(offsetMs: Long?, durationMs: Long?): Float? =
    if (offsetMs != null && durationMs != null && durationMs > 0 && offsetMs > 0) (offsetMs.toFloat() / durationMs).coerceIn(0f, 1f) else null

private fun MutableList<Rail>.addRail(key: String, label: String, items: List<RailItem>) {
    if (items.isNotEmpty()) add(Rail(key, label, items.distinctBy { it.key }))
}

private fun MutableList<Rail>.addTrakt(key: String, label: String, row: DiscoverRow?) {
    if (row == null || row.pending || row.failed) return
    addRail(key, label, row.results.map(RailItem::Found))
}
