package io.github.aahh.mediamanager2.tv.downloads

import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.roundToLong
import kotlinx.serialization.Serializable

// A port of src/client/downloads/model.ts (shapes, applyEvent, buildRows) and src/client/library/progress.ts
// (subjectProgress), so the TV says exactly what the web says about a download. Only the fields the TV shows are kept;
// unknown fields are ignored. Keep the two in step: a change to the web's rules belongs here too.

@Serializable
data class Torrent(
    val hash: String,
    val name: String = "",
    val sizeBytes: Long = 0,
    val completedBytes: Long = 0,
    val downRate: Long = 0,
    val upRate: Long = 0,
    val started: Boolean = false,
    val active: Boolean = false,
    val complete: Boolean = false,
    val message: String = "",
    val ratioThousandths: Long = 0,
    val seedersConnected: Int = 0,
    val trackerHost: String? = null,
    val seedingSeconds: Long = 0,
    val goneAt: Long? = null,
)

@Serializable
data class StatusMessage(val title: String = "", val messages: List<String> = emptyList())

@Serializable
data class QueueItem(
    val service: String,
    val queueId: Long,
    val downloadId: String? = null,
    val movieId: Int? = null,
    val episodeId: Int? = null,
    val seriesId: Int? = null,
    val title: String = "",
    val label: String = "",
    val status: String = "",
    val trackedStatus: String = "",
    val trackedState: String = "",
    val statusMessages: List<StatusMessage> = emptyList(),
    val errorMessage: String = "",
    val indexer: String = "",
    val quality: String = "",
    val estimatedCompletion: String? = null,
)

@Serializable
data class Grab(
    val hash: String,
    val service: String,
    val movieId: Int? = null,
    val episodeIds: List<Int> = emptyList(),
    val seriesId: Int? = null,
    val importedAt: Long? = null,
    val failedAt: Long? = null,
    val byHand: Boolean = false,
)

@Serializable
data class ProblemSubject(val type: String, val service: String? = null, val id: String)

/** `state` is `handling`, `needs_you` or `resolved`. */
@Serializable
data class Problem(val id: Long, val kind: String, val subject: ProblemSubject, val hash: String? = null, val state: String, val summary: String = "")

/** `GET /api/downloads`. */
@Serializable
data class Snapshot(
    val torrents: List<Torrent> = emptyList(),
    val queue: List<QueueItem> = emptyList(),
    val grabs: List<Grab> = emptyList(),
    val problems: List<Problem> = emptyList(),
)

@Serializable
data class TorrentsEvent(val changed: List<Torrent> = emptyList(), val gone: List<String> = emptyList())

@Serializable
data class QueueEvent(val service: String, val items: List<QueueItem> = emptyList())

/** A parsed live event; the stream's types are `torrents`, `queue`, `grab` and `problem`. */
sealed interface LiveEvent {
    data class Torrents(val value: TorrentsEvent) : LiveEvent
    data class Queue(val value: QueueEvent) : LiveEvent
    data class GrabChanged(val value: Grab) : LiveEvent
    data class ProblemChanged(val value: Problem) : LiveEvent
}

/** `tone` is `normal` or `risk`. */
data class Status(val word: String, val tone: String, val detail: String)

/** One download, as the web's Downloads row: [progress] is null while the release is not in rTorrent yet. */
data class Row(
    val key: String,
    val label: String,
    val progress: Int?,
    val timeLeft: String,
    val status: Status,
    val problems: List<Problem>,
    val queueItem: QueueItem?,
    val downRate: Long,
    val downloading: Boolean,
)

/** What a title page shows for an episode or film: the row's status word and tone, its percent and speed. */
data class SubjectProgress(val word: String, val tone: String, val percent: Int?, val downRate: Long)

private val UNITS = listOf("B", "KB", "MB", "GB", "TB")

fun formatBytes(bytes: Long): String {
    var value = bytes.toDouble()
    var unit = 0
    while (value >= 1000 && unit < UNITS.size - 1) {
        value /= 1000
        unit += 1
    }
    val number = if (value >= 100 || unit == 0) value.roundToLong().toString() else String.format(java.util.Locale.ROOT, "%.1f", value)
    return "$number ${UNITS[unit]}"
}

fun formatSpeed(bytesPerSecond: Long) = "${formatBytes(bytesPerSecond)}/s"

fun formatDuration(milliseconds: Double): String {
    val minutes = maxOf(0L, ceil(milliseconds / 60_000).toLong())
    if (minutes < 60) return "${minutes}m"
    val hours = minutes / 60
    if (hours < 48) return "${hours}h ${minutes % 60}m"
    return "${hours / 24}d ${hours % 24}h"
}

// Sonarr and Radarr name blocked imports in their status messages; the first line says why in their own words.
private fun queueReason(item: QueueItem) = item.statusMessages.flatMap { it.messages }.firstOrNull() ?: item.errorMessage

private fun labelFor(items: List<QueueItem>, fallback: String): String {
    val labels = items.map { it.label }.filter { it.isNotEmpty() }.distinct()
    return when (labels.size) {
        0 -> fallback
        1 -> labels[0]
        else -> "${labels[0]} and ${labels.size - 1} more"
    }
}

private fun torrentStatus(torrent: Torrent, items: List<QueueItem>, problems: List<Problem>): Status {
    if (problems.any { it.kind == "stalled" }) return Status("stalled", "risk", "${torrent.seedersConnected} seeders connected")
    if (torrent.message.isNotEmpty()) return Status("error", "risk", torrent.message)
    val blocked = items.firstOrNull {
        it.trackedState == "importBlocked" || it.trackedState == "failedPending" || (it.trackedStatus == "warning" && torrent.complete)
    }
    if (blocked != null) return Status("import blocked", "risk", queueReason(blocked))
    if (items.any { it.trackedState == "importing" }) return Status("importing", "normal", "into the library folder")
    if (torrent.complete) {
        if (items.any { it.trackedState == "importPending" }) return Status("waiting to import", "normal", "")
        return Status("seeding", "normal", if (torrent.upRate > 0) "${formatSpeed(torrent.upRate)} up" else "")
    }
    if (!torrent.started) return Status("paused", "normal", "")
    if (!torrent.active) return Status("queued", "normal", "in rTorrent's queue")
    if (torrent.downRate > 0) return Status("downloading", "normal", formatSpeed(torrent.downRate))
    return Status("waiting for peers", if (torrent.seedersConnected == 0) "risk" else "normal", "${torrent.seedersConnected} seeders connected")
}

private fun problemKeysFor(service: String, items: List<QueueItem>, grab: Grab?): Set<String> {
    val keys = mutableSetOf<String>()
    for (item in items) {
        item.movieId?.let { keys += "movie:$service:$it" }
        item.episodeId?.let { keys += "episode:$service:$it" }
    }
    grab?.movieId?.let { keys += "movie:$service:$it" }
    grab?.episodeIds?.forEach { keys += "episode:$service:$it" }
    return keys
}

private val CAMEL = Regex("([a-z])([A-Z])")

/**
 * One row per download: a torrent in rTorrent with what Sonarr or Radarr know of it, or a queue entry rTorrent doesn't
 * have yet. Each open problem joins the row it is about; problems about no download get a row of their own.
 */
fun buildRows(snapshot: Snapshot): List<Row> {
    val grabs = snapshot.grabs.associateBy { it.hash }
    val torrentHashes = snapshot.torrents.filter { it.goneAt == null }.map { it.hash }.toSet()
    val queueByHash = LinkedHashMap<String, MutableList<QueueItem>>()
    val queueWithoutTorrent = mutableListOf<List<QueueItem>>()
    val looseByDownload = LinkedHashMap<String, MutableList<QueueItem>>()
    for (item in snapshot.queue) {
        val download = item.downloadId
        when {
            download != null && download in torrentHashes -> queueByHash.getOrPut(download) { mutableListOf() } += item
            download != null -> looseByDownload.getOrPut("${item.service}:$download") { mutableListOf() } += item
            else -> queueWithoutTorrent += listOf(item)
        }
    }
    queueWithoutTorrent += looseByDownload.values

    val unclaimed = LinkedHashMap<Problem, String>()
    for (problem in snapshot.problems) {
        if (problem.state != "resolved") unclaimed[problem] = "${problem.subject.type}:${problem.subject.service ?: ""}:${problem.subject.id}"
    }
    fun claim(hash: String?, keys: Set<String>): List<Problem> {
        val found = mutableListOf<Problem>()
        val iterator = unclaimed.entries.iterator()
        while (iterator.hasNext()) {
            val (problem, subjectKey) = iterator.next()
            val byHash = hash != null && (problem.hash == hash || (problem.subject.type == "torrent" && problem.subject.id == hash))
            if (byHash || subjectKey in keys) {
                found += problem
                iterator.remove()
            }
        }
        return found
    }

    val rows = mutableListOf<Row>()
    for (torrent in snapshot.torrents) {
        if (torrent.goneAt != null) continue
        val items = queueByHash[torrent.hash].orEmpty()
        val grab = grabs[torrent.hash]
        val service = items.firstOrNull()?.service ?: grab?.service
        val problems = claim(torrent.hash, if (service == null) emptySet() else problemKeysFor(service, items, grab))
        val remaining = torrent.sizeBytes - torrent.completedBytes
        rows += Row(
            key = "torrent:${torrent.hash}",
            label = labelFor(items, torrent.name),
            progress = if (torrent.sizeBytes > 0) floor(torrent.completedBytes.toDouble() / torrent.sizeBytes * 100).toInt() else 0,
            timeLeft = when {
                torrent.complete -> ""
                torrent.downRate > 0 -> formatDuration(remaining.toDouble() / torrent.downRate * 1000)
                else -> "–"
            },
            status = torrentStatus(torrent, items, problems),
            problems = problems,
            queueItem = items.firstOrNull(),
            downRate = torrent.downRate,
            downloading = !torrent.complete && torrent.started,
        )
    }
    for (items in queueWithoutTorrent) {
        val item = items.first()
        val grab = item.downloadId?.let { grabs[it] }
        rows += Row(
            key = "queue:${item.service}:${item.queueId}",
            label = labelFor(items, item.title),
            progress = null,
            timeLeft = "",
            status = when {
                item.status == "delay" -> Status("delayed", "normal", "")
                item.trackedStatus == "warning" || item.trackedStatus == "error" ->
                    Status(if (item.status == "failed") "failed" else "warning", "risk", queueReason(item))
                else -> Status(item.status.replace(CAMEL, "$1 $2").lowercase(), "normal", "")
            },
            problems = claim(item.downloadId, problemKeysFor(item.service, items, grab)),
            queueItem = item,
            downRate = 0,
            downloading = false,
        )
    }
    for (problem in unclaimed.keys) {
        val subject = problem.subject
        val service = when (subject.service) {
            null -> ""
            "sonarr" -> "Sonarr "
            else -> "Radarr "
        }
        rows += Row(
            key = "problem:${problem.id}",
            label = if (subject.type == "dependency" || subject.type == "tracker") subject.id else "$service${subject.type} ${subject.id}",
            progress = null,
            timeLeft = "",
            status = Status(problem.kind.replace('_', ' '), "risk", ""),
            problems = listOf(problem),
            queueItem = null,
            downRate = 0,
            downloading = false,
        )
    }
    return rows
}

// The grabs worth keeping, as the server chooses them for /api/downloads: still downloading, or still seeding in rTorrent.
private fun stillWanted(grab: Grab, liveHashes: Set<String>) = (grab.importedAt == null && grab.failedAt == null) || grab.hash in liveHashes

private fun liveHashesOf(torrents: List<Torrent>) = torrents.filter { it.goneAt == null }.map { it.hash }.toSet()

fun applyEvent(snapshot: Snapshot, event: LiveEvent): Snapshot = when (event) {
    is LiveEvent.Torrents -> {
        val byHash = LinkedHashMap<String, Torrent>()
        snapshot.torrents.forEach { byHash[it.hash] = it }
        event.value.changed.forEach { byHash[it.hash] = it }
        event.value.gone.forEach { byHash.remove(it) }
        val torrents = byHash.values.toList()
        val liveHashes = liveHashesOf(torrents)
        snapshot.copy(torrents = torrents, grabs = snapshot.grabs.filter { stillWanted(it, liveHashes) })
    }
    is LiveEvent.Queue -> snapshot.copy(queue = snapshot.queue.filter { it.service != event.value.service } + event.value.items)
    is LiveEvent.GrabChanged -> {
        val others = snapshot.grabs.filter { it.hash != event.value.hash }
        snapshot.copy(grabs = if (stillWanted(event.value, liveHashesOf(snapshot.torrents))) others + event.value else others)
    }
    is LiveEvent.ProblemChanged -> {
        val others = snapshot.problems.filter { it.id != event.value.id }
        snapshot.copy(problems = if (event.value.state == "resolved") others else others + event.value)
    }
}

/** Progress keyed `episode:<id>` and `movie:<id>` (Sonarr and Radarr ids), from the queue and the open grabs. */
fun subjectProgress(snapshot: Snapshot, rows: List<Row>): Map<String, SubjectProgress> {
    val byKey = rows.associateBy { it.key }
    val result = LinkedHashMap<String, SubjectProgress>()
    fun set(key: String, row: Row) {
        result[key] = SubjectProgress(row.status.word, row.status.tone, row.progress, row.downRate)
    }
    for (item in snapshot.queue) {
        val row = item.downloadId?.let { byKey["torrent:$it"] }
            ?: byKey["queue:${item.service}:${item.queueId}"]
            ?: rows.firstOrNull { item.downloadId != null && it.queueItem?.service == item.service && it.queueItem.downloadId == item.downloadId }
            ?: continue
        item.episodeId?.let { set("episode:$it", row) }
        item.movieId?.let { set("movie:$it", row) }
    }
    for (grab in snapshot.grabs) {
        if (grab.importedAt != null || grab.failedAt != null) continue
        val row = byKey["torrent:${grab.hash}"] ?: continue
        grab.episodeIds.forEach { set("episode:$it", row) }
        grab.movieId?.let { set("movie:$it", row) }
    }
    return result
}
