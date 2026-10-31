package io.github.aahh.mediamanager2.tv.downloads

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

// Cases ported from tests/production.test.mjs (the web's downloads model and title-page progress), so the TV and the
// web say the same thing about a download.
class DownloadsModelTest {
    private val hash = "CD".repeat(20)
    private fun torrent(
        hash: String = this.hash,
        completedBytes: Long = 400,
        downRate: Long = 0,
        started: Boolean = true,
        active: Boolean = true,
        complete: Boolean = false,
        message: String = "",
        seedersConnected: Int = 2,
        goneAt: Long? = null,
    ) = Torrent(hash, "Movie.2024.1080p", 1000, completedBytes, downRate, 0, started, active, complete, message, 0, seedersConnected, "tracker.example", 0, goneAt)

    private fun item(
        service: String = "radarr",
        queueId: Long = 5,
        downloadId: String? = hash,
        movieId: Int? = 7,
        episodeId: Int? = null,
        label: String = "Movie (2024)",
        status: String = "downloading",
        trackedState: String = "downloading",
        statusMessages: List<StatusMessage> = emptyList(),
    ) = QueueItem(service, queueId, downloadId, movieId, episodeId, null, "Movie.2024.1080p", label, status, "ok", trackedState, statusMessages)

    private fun problem(
        id: Long = 1,
        kind: String = "stalled",
        subject: ProblemSubject = ProblemSubject("torrent", null, hash),
        hash: String? = this.hash,
        state: String = "handling",
    ) = Problem(id, kind, subject, hash, state, "No seeders.")

    private fun statusOf(torrent: Torrent, queue: List<QueueItem> = listOf(item()), problems: List<Problem> = emptyList()) =
        buildRows(Snapshot(listOf(torrent), queue, emptyList(), problems))[0].status

    // Reading the wrong state first shows a blocked or stalled download as fine, or a fine one as at risk.
    @Test
    fun aTorrentRowSaysTheMostUrgentThingAboutItsDownload() {
        val blockedItem = item(trackedState = "importBlocked", statusMessages = listOf(StatusMessage("x", listOf("No matching movie."))))
        val cases = listOf(
            Triple(statusOf(torrent(), problems = listOf(problem())), "stalled", "risk"),
            Triple(statusOf(torrent(message = "Tracker: timeout")), "error", "risk"),
            Triple(statusOf(torrent(complete = true), listOf(blockedItem)), "import blocked", "risk"),
            Triple(statusOf(torrent(complete = true), listOf(item(trackedState = "importing"))), "importing", "normal"),
            Triple(statusOf(torrent(complete = true), listOf(item(trackedState = "importPending"))), "waiting to import", "normal"),
            Triple(statusOf(torrent(complete = true), emptyList()), "seeding", "normal"),
            Triple(statusOf(torrent(started = false)), "paused", "normal"),
            Triple(statusOf(torrent(active = false)), "queued", "normal"),
            Triple(statusOf(torrent(downRate = 2000)), "downloading", "normal"),
            Triple(statusOf(torrent(seedersConnected = 0)), "waiting for peers", "risk"),
        )
        cases.forEachIndexed { index, (status, word, tone) -> assertEquals("case $index", word to tone, status.word to status.tone) }
        assertEquals("No matching movie.", statusOf(torrent(complete = true), listOf(blockedItem)).detail)
    }

    // Losing the join shows a download twice, drops a problem, or shows a resolved one.
    @Test
    fun queueItemsAndProblemsJoinTheirDownloadAndTheRestGetRowsOfTheirOwn() {
        val delayed = item(queueId = 6, downloadId = null, movieId = 8, label = "Other (2025)", status = "delay")
        val rows = buildRows(Snapshot(
            torrents = listOf(torrent(), torrent(hash = "EF".repeat(20), goneAt = 1)),
            queue = listOf(item(), delayed),
            grabs = listOf(Grab(hash, "radarr", movieId = 7, byHand = true)),
            problems = listOf(
                problem(id = 2, kind = "import_failed", subject = ProblemSubject("movie", "radarr", "7"), hash = null, state = "needs_you"),
                problem(id = 3, kind = "missing", subject = ProblemSubject("movie", "radarr", "8"), hash = null),
                problem(id = 4, kind = "tracker_down", subject = ProblemSubject("tracker", null, "tracker.example"), hash = null),
                problem(id = 5, state = "resolved"),
            ),
        ))
        assertEquals(
            listOf(
                Triple("torrent:$hash", "Movie (2024)", listOf(2L)),
                Triple("queue:radarr:6", "Other (2025)", listOf(3L)),
                Triple("problem:4", "tracker.example", listOf(4L)),
            ),
            rows.map { Triple(it.key, it.label, it.problems.map { open -> open.id }) },
        )
        assertEquals(5L, rows[0].queueItem?.queueId)
        assertEquals(40, rows[0].progress)
        assertEquals("delayed", rows[1].status.word)
        assertNull(rows[1].progress)
        assertNull(rows[2].queueItem)
    }

    // Applying an event to the wrong service, or keeping a resolved problem, leaves the screen out of date.
    @Test
    fun liveEventsUpdateOnlyWhatTheyName() {
        val snapshot = Snapshot(listOf(torrent()), listOf(item(), item(service = "sonarr", queueId = 9)), emptyList(), listOf(problem()))
        assertEquals(emptyList<Torrent>(), applyEvent(snapshot, LiveEvent.Torrents(TorrentsEvent(gone = listOf(hash)))).torrents)
        assertEquals(listOf(9L), applyEvent(snapshot, LiveEvent.Queue(QueueEvent("radarr"))).queue.map { it.queueId })
        assertEquals(emptyList<Problem>(), applyEvent(snapshot, LiveEvent.ProblemChanged(problem(state = "resolved"))).problems)
        val changed = torrent(completedBytes = 900)
        assertEquals(listOf(changed), applyEvent(snapshot, LiveEvent.Torrents(TorrentsEvent(changed = listOf(changed)))).torrents)
        val imported = Grab(hash, "radarr", movieId = 7, importedAt = 1)
        assertEquals("a grab seeding in rTorrent stays", listOf(imported), applyEvent(snapshot, LiveEvent.GrabChanged(imported)).grabs)
        val gone = applyEvent(snapshot.copy(grabs = listOf(imported)), LiveEvent.Torrents(TorrentsEvent(gone = listOf(hash))))
        assertEquals("an imported grab goes with its torrent", emptyList<Grab>(), gone.grabs)
        assertSame(snapshot.problems, applyEvent(snapshot, LiveEvent.Queue(QueueEvent("radarr"))).problems)
    }

    // Mapping only the first episode of a grab, or keeping imported grabs, turns this red.
    @Test
    fun aGrabGivesEachOfItsEpisodesTheTorrentRowWordAndPercent() {
        val showHash = "EF".repeat(20)
        val downloading = torrent(hash = showHash, downRate = 2000, seedersConnected = 3)
        val grab = Grab(showHash, "sonarr", episodeIds = listOf(11, 12), seriesId = 5)
        fun progressFor(snapshot: Snapshot) = subjectProgress(snapshot, buildRows(snapshot))

        val live = progressFor(Snapshot(torrents = listOf(downloading), grabs = listOf(grab)))
        for (id in listOf(11, 12)) assertEquals(SubjectProgress("downloading", "normal", 40, 2000), live["episode:$id"])
        assertEquals("an imported grab is not live", 0, progressFor(Snapshot(torrents = listOf(downloading), grabs = listOf(grab.copy(importedAt = 1)))).size)
        val delayed = progressFor(Snapshot(queue = listOf(item(service = "sonarr", queueId = 3, downloadId = null, movieId = null, episodeId = 13, status = "delay"))))["episode:13"]
        assertEquals("delayed" to null, delayed?.word to delayed?.percent)
    }

    // Printing sizes, speeds or times differently from the web turns this red.
    @Test
    fun numbersReadAsOnTheWeb() {
        assertEquals("950 B", formatBytes(950))
        assertEquals("1.5 MB", formatBytes(1_500_000))
        assertEquals("120 GB", formatBytes(120_000_000_000))
        assertEquals("2.0 KB/s", formatSpeed(2000))
        assertEquals("1m", formatDuration(1.0))
        assertEquals("1h 30m", formatDuration(90 * 60_000.0))
        assertEquals("2d 1h", formatDuration(49 * 3_600_000.0))
    }
}
