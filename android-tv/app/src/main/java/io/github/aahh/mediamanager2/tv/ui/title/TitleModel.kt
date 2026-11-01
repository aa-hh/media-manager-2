package io.github.aahh.mediamanager2.tv.ui.title

import io.github.aahh.mediamanager2.tv.api.EpisodeDetail
import io.github.aahh.mediamanager2.tv.api.MovieDetail
import io.github.aahh.mediamanager2.tv.api.MovieWatch
import io.github.aahh.mediamanager2.tv.api.Playable
import io.github.aahh.mediamanager2.tv.api.Season
import io.github.aahh.mediamanager2.tv.api.SeriesDetail
import io.github.aahh.mediamanager2.tv.api.SeriesWatch
import io.github.aahh.mediamanager2.tv.downloads.SubjectProgress
import io.github.aahh.mediamanager2.tv.ui.PlayerRoute
import io.github.aahh.mediamanager2.tv.ui.components.EpisodeStatus
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

// What the show and film pages say and play, ported from the web's src/client/library/watch.ts and
// src/client/title/playLine.ts. No Compose here, so the tests run on the JVM.

/** "28 min", "1 h 15 min", "2 h"; never less than a minute. */
fun minutesText(ms: Long): String {
    val total = maxOf(1L, Math.round(ms / 60_000.0))
    val hours = total / 60
    val minutes = total % 60
    if (hours == 0L) return "$minutes min"
    return if (minutes == 0L) "$hours h" else "$hours h $minutes min"
}

/** A saved position as Plex's apps print it: "21:00", "1:05:09". */
fun clockText(ms: Long): String {
    val seconds = Math.floorDiv(ms, 1000L)
    fun pad(value: Long) = value.toString().padStart(2, '0')
    val hours = seconds / 3600
    val rest = "${pad((seconds % 3600) / 60)}:${pad(seconds % 60)}"
    return if (hours == 0L) rest.replaceFirst(Regex("^0"), "") else "$hours:$rest"
}

fun stoppedPartway(offsetMs: Long?, durationMs: Long?): Boolean =
    offsetMs != null && offsetMs > 0 && durationMs != null && durationMs > 0

/** An episode Plex can play: Sonarr has its file and Plex matched it. */
fun playableEpisode(episode: EpisodeDetail, watch: SeriesWatch?): Playable? {
    if (watch == null || watch.kind != "ok" || !episode.hasFile) return null
    return watch.episodes[episode.id.toString()]
}

/**
 * The episode the page plays: Plex's next episode when it has one (null when that one is not playable), else the
 * earliest playable episode, specials last. Null when Plex is off or did not match the show.
 */
fun nextEpisode(episodes: List<EpisodeDetail>, watch: SeriesWatch?): EpisodeDetail? {
    if (watch == null || watch.kind != "ok") return null
    val inPlex = episodes.filter { playableEpisode(it, watch) != null }
    val target = watch.nextEpisode
    if (target != null) return inPlex.find { it.seasonNumber == target.seasonNumber && it.episodeNumber == target.episodeNumber }
    return inPlex.sortedWith(compareBy({ it.seasonNumber == 0 }, { it.seasonNumber }, { it.episodeNumber })).firstOrNull()
}

/** The Play button's words and the two lines under it; [resume] when Plex should resume the item. */
data class PlayLine(val label: String, val line1: String, val line2: String?, val resume: Boolean)

private fun durationOf(durationMs: Long?, runtimeMinutes: Int?): Long? =
    durationMs ?: runtimeMinutes?.takeIf { it > 0 }?.let { it * 60_000L }

// The saved position and "31 min left of 52 min", when stopped partway.
private fun resumed(offsetMs: Long?, durationMs: Long?, runtimeMinutes: Int?): Pair<Long, String>? {
    if (!stoppedPartway(offsetMs, durationMs)) return null
    val at = offsetMs!!
    val total = durationOf(durationMs, runtimeMinutes)!!
    return at to "${minutesText(total - at)} left of ${minutesText(total)}"
}

/** "Resume S2 E4" / "Stopped at 21:00 · S2 E4 · Woe's Hollow" / "31 min left of 52 min", or "Play S3 E5" with the episode and its length. */
fun seriesPlayLine(episode: EpisodeDetail, playable: Playable): PlayLine {
    val code = "S${episode.seasonNumber} E${episode.episodeNumber}"
    val resume = resumed(playable.viewOffsetMs, playable.durationMs, episode.runtime)
    if (resume != null) return PlayLine("Resume $code", "Stopped at ${clockText(resume.first)} · $code · ${episode.title}", resume.second, true)
    val total = durationOf(playable.durationMs, episode.runtime)
    return PlayLine("Play $code", "$code · ${episode.title}", total?.let(::minutesText), false)
}

/** "Play" / "2 h 46 min · plays 2160p WEB-DL", or "Resume" / "Stopped at 1:05:09" / "1 h 15 min left of 2 h 46 min". */
fun moviePlayLine(playable: MovieWatch, runtimeMinutes: Int?, quality: String?): PlayLine {
    val resume = resumed(playable.viewOffsetMs, playable.durationMs, runtimeMinutes)
    if (resume != null) return PlayLine("Resume", "Stopped at ${clockText(resume.first)}", resume.second, true)
    val total = durationOf(playable.durationMs, runtimeMinutes)
    return PlayLine("Play", listOfNotNull(total?.let(::minutesText), quality?.let { "plays $it" }).joinToString(" · "), null, false)
}

data class SeasonTab(val seasonNumber: Int, val label: String)

/** One tab per season in number order, Specials (season 0) last. */
fun seasonTabs(seasons: List<Season>): List<SeasonTab> =
    seasons.sortedWith(compareBy({ it.seasonNumber == 0 }, { it.seasonNumber }))
        .map { SeasonTab(it.seasonNumber, if (it.seasonNumber == 0) "Specials" else "Season ${it.seasonNumber}") }

/** The tab the page opens on: the next episode's season, else the first. */
fun initialSeason(tabs: List<SeasonTab>, next: EpisodeDetail?): Int =
    next?.let { episode -> tabs.indexOfFirst { it.seasonNumber == episode.seasonNumber } }?.takeIf { it >= 0 } ?: 0

private val DAY = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.UK)

private fun airDate(text: String?): LocalDate? = text?.let { runCatching { LocalDate.parse(it) }.getOrNull() }

/** "12 Sep 2026 · 52 min", either part left out when unknown. */
fun episodeLine(episode: EpisodeDetail): String = listOfNotNull(
    airDate(episode.airDate)?.format(DAY),
    episode.runtime?.takeIf { it > 0 }?.let { minutesText(it * 60_000L) },
).joinToString(" · ")

/** The row's status: downloading, then watched, then on disk, then not out yet, else missing. */
fun episodeStatus(episode: EpisodeDetail, playable: Playable?, live: SubjectProgress?, today: LocalDate): EpisodeStatus {
    if (live != null) return EpisodeStatus.Downloading(live.percent ?: 0)
    if (playable != null && playable.viewCount > 0 && !stoppedPartway(playable.viewOffsetMs, playable.durationMs)) return EpisodeStatus.Ready("Watched")
    if (episode.hasFile) return EpisodeStatus.Ready(episode.file?.quality ?: "On disk")
    val aired = airDate(episode.airDate)
    if (aired == null || aired.isAfter(today)) return EpisodeStatus.Upcoming(aired?.format(DAY) ?: "Not out yet")
    return EpisodeStatus.Missing
}

/** How far into the episode Plex stopped, when it stopped partway. */
fun episodeWatchProgress(playable: Playable?): Float? {
    if (playable == null || !stoppedPartway(playable.viewOffsetMs, playable.durationMs)) return null
    return playable.viewOffsetMs!!.toFloat() / playable.durationMs!!
}

private fun facts(vararg parts: String?): String = parts.filterNot { it.isNullOrBlank() }.joinToString(" · ")

private fun genres(genres: List<String>): String = genres.take(2).joinToString(", ")

/** "Series · 2024 · 2 seasons · Drama, Mystery · TV-MA · Apple TV+", unknown parts left out. */
fun showFacts(detail: SeriesDetail): String {
    val seasons = detail.seasons.count { it.seasonNumber > 0 }
    val seasonsText = when (seasons) {
        0 -> null
        1 -> "1 season"
        else -> "$seasons seasons"
    }
    return facts("Series", detail.year?.toString(), seasonsText, genres(detail.genres), detail.certification, detail.network)
}

/** "Movie · 2025 · 2 h 46 min · Sci-Fi · 2160p WEB-DL", unknown parts left out. */
fun filmFacts(detail: MovieDetail): String = facts(
    "Movie",
    detail.year?.toString(),
    detail.runtime?.takeIf { it > 0 }?.let { minutesText(it * 60_000L) },
    genres(detail.genres),
    detail.file?.quality,
)

/** Every episode Plex knows of is watched. */
fun titleWatched(detail: SeriesDetail): Boolean {
    val watch = detail.watch ?: return false
    return watch.kind == "ok" && watch.leafCount > 0 && watch.viewedLeafCount >= watch.leafCount
}

/** Plex has played the film at least once. */
fun titleWatched(detail: MovieDetail): Boolean {
    val watch = detail.watch ?: return false
    return watch.kind == "ok" && watch.viewCount > 0
}

fun playerRouteFor(service: String, id: Int, ratingKey: String, partway: Boolean): PlayerRoute =
    PlayerRoute(service = service, id = id, ratingKey = ratingKey, resume = partway)
