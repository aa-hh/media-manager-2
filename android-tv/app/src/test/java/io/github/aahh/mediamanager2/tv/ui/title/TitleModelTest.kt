package io.github.aahh.mediamanager2.tv.ui.title

import io.github.aahh.mediamanager2.tv.api.EpisodeDetail
import io.github.aahh.mediamanager2.tv.api.EpisodeRef
import io.github.aahh.mediamanager2.tv.api.FileSummary
import io.github.aahh.mediamanager2.tv.api.MovieDetail
import io.github.aahh.mediamanager2.tv.api.MovieWatch
import io.github.aahh.mediamanager2.tv.api.Playable
import io.github.aahh.mediamanager2.tv.api.Season
import io.github.aahh.mediamanager2.tv.api.SeriesDetail
import io.github.aahh.mediamanager2.tv.api.SeriesWatch
import io.github.aahh.mediamanager2.tv.downloads.SubjectProgress
import io.github.aahh.mediamanager2.tv.ui.components.EpisodeStatus
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

private fun episode(id: Int, season: Int, number: Int, hasFile: Boolean = true, airDate: String? = null, runtime: Int? = null, quality: String? = null) =
    EpisodeDetail(
        id = id,
        seasonNumber = season,
        episodeNumber = number,
        title = "Woe's Hollow",
        airDate = airDate,
        hasFile = hasFile,
        runtime = runtime,
        file = if (hasFile) FileSummary(quality = quality) else null,
    )

private fun watchOf(vararg ids: Int, next: EpisodeRef? = null, kind: String = "ok") =
    SeriesWatch(kind = kind, nextEpisode = next, episodes = ids.associate { it.toString() to Playable(ratingKey = "r$it") })

class TitleModelTest {
    // Play follows the web's rule: Plex's next episode, else the earliest playable one with specials last. Dropping the
    // specials-last sort, or playing an episode without its file, turns this red.
    @Test
    fun nextEpisodeFollowsPlexThenTheEarliestPlayable() {
        val special = episode(3, 0, 1)
        val second = episode(2, 1, 2)
        val first = episode(1, 1, 1)
        val noFile = episode(4, 2, 1, hasFile = false)
        val episodes = listOf(special, second, first, noFile)

        assertEquals(second, nextEpisode(episodes, watchOf(1, 2, 3, 4, next = EpisodeRef(1, 2))))
        assertEquals(first, nextEpisode(episodes, watchOf(1, 2, 3, 4)))
        assertEquals("specials come last but still play", special, nextEpisode(episodes, watchOf(3)))
        assertNull("Plex's next episode has no file", nextEpisode(episodes, watchOf(1, 2, 3, 4, next = EpisodeRef(2, 1))))
        assertNull(nextEpisode(episodes, watchOf(1, 2, 3, kind = "off")))
        assertNull(nextEpisode(episodes, null))
    }

    // The header's words copy the web's play line. Losing the partway check, or the "left of" maths, turns this red.
    @Test
    fun playLinesSayResumeWhenPartwayAndPlayOtherwise() {
        val episode = episode(1, 2, 4, runtime = 48)
        assertEquals(
            PlayLine("Resume S2 E4", "Stopped at 21:00 · S2 E4 · Woe's Hollow", "31 min left of 52 min", resume = true),
            seriesPlayLine(episode, Playable(ratingKey = "r1", viewOffsetMs = 1_260_000, durationMs = 3_120_000)),
        )
        assertEquals(PlayLine("Play S2 E4", "S2 E4 · Woe's Hollow", "48 min", resume = false), seriesPlayLine(episode, Playable(ratingKey = "r1")))

        assertEquals(
            PlayLine("Resume", "Stopped at 1:05:09", "1 h 15 min left of 2 h 20 min", resume = true),
            moviePlayLine(MovieWatch(kind = "ok", ratingKey = "9", viewOffsetMs = 3_909_000, durationMs = 8_409_000), 166, "2160p WEB-DL"),
        )
        assertEquals(
            PlayLine("Play", "2 h 46 min · plays 2160p WEB-DL", null, resume = false),
            moviePlayLine(MovieWatch(kind = "ok", ratingKey = "9", durationMs = 9_960_000), 100, "2160p WEB-DL"),
        )
        assertEquals("2 h 46 min", moviePlayLine(MovieWatch(kind = "ok", ratingKey = "9"), 166, null).line1)
    }

    // An episode row says the one status that matters most. Reordering the checks in episodeStatus, or showing a queued
    // download (no percent yet) as anything but 0%, turns this red.
    @Test
    fun episodeStatusPrecedence() {
        val today = LocalDate.of(2026, 3, 10)
        val watched = Playable(ratingKey = "r", viewCount = 1)
        val onDisk = episode(1, 1, 1, quality = "1080p")
        val notOnDisk = { airDate: String? -> episode(1, 1, 1, hasFile = false, airDate = airDate) }
        val rows = listOf(
            Triple(onDisk, watched, SubjectProgress("downloading", "live", 42, 0)) to EpisodeStatus.Downloading(42),
            Triple(onDisk, null, SubjectProgress("queued", "muted", null, 0)) to EpisodeStatus.Downloading(0),
            Triple(onDisk, watched, null) to EpisodeStatus.Ready("Watched"),
            Triple(onDisk, Playable(ratingKey = "r", viewCount = 1, viewOffsetMs = 100, durationMs = 1_000), null) to EpisodeStatus.Ready("1080p"),
            Triple(episode(1, 1, 1), null, null) to EpisodeStatus.Ready("On disk"),
            Triple(notOnDisk("2026-03-20"), null, null) to EpisodeStatus.Upcoming("20 Mar 2026"),
            Triple(notOnDisk(null), null, null) to EpisodeStatus.Upcoming("Not out yet"),
            Triple(notOnDisk("2026-03-10"), null, null) to EpisodeStatus.Missing,
            Triple(notOnDisk("2026-03-01"), null, null) to EpisodeStatus.Missing,
        )
        for ((input, expected) in rows) {
            val (episode, playable, live) = input
            assertEquals(expected, episodeStatus(episode, playable, live, today))
        }
    }

    // The season tabs put Specials last and open on the next episode's season. Sorting season 0 first, or always opening
    // on the first tab, turns this red.
    @Test
    fun seasonTabsPutSpecialsLastAndOpenOnTheNextEpisode() {
        val tabs = seasonTabs(listOf(Season(2), Season(0), Season(1)))
        assertEquals(listOf("Season 1", "Season 2", "Specials"), tabs.map { it.label })
        assertEquals(1, initialSeason(tabs, episode(1, 2, 3)))
        assertEquals(0, initialSeason(tabs, null))
        assertEquals("a season with no tab", 0, initialSeason(tabs, episode(1, 7, 1)))
    }

    // The facts line under the title drops what the library does not know. Printing an empty part (a dangling " · "),
    // counting Specials as a season, or losing the singular, turns this red.
    @Test
    fun factsLinesDropMissingParts() {
        val show = SeriesDetail(
            id = 1,
            title = "Severance",
            year = 2022,
            certification = "TV-MA",
            network = "Apple TV+",
            genres = listOf("Drama", "Mystery", "Thriller"),
            seasons = listOf(Season(0), Season(1), Season(2)),
        )
        assertEquals("Series · 2022 · 2 seasons · Drama, Mystery · TV-MA · Apple TV+", showFacts(show))
        assertEquals("Series · 1 season", showFacts(SeriesDetail(id = 1, title = "X", seasons = listOf(Season(0), Season(1)))))

        val film = MovieDetail(id = 1, title = "Dune", year = 2021, runtime = 166, genres = listOf("Sci-Fi"), file = FileSummary(quality = "2160p WEB-DL"))
        assertEquals("Movie · 2021 · 2 h 46 min · Sci-Fi · 2160p WEB-DL", filmFacts(film))
        assertEquals("Movie", filmFacts(MovieDetail(id = 1, title = "Y", runtime = 0)))
    }
}
