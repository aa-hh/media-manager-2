package io.github.aahh.mediamanager2.tv.api

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

// Field names are copied from src/server/playback.ts (routes at createPlaybackRoutes, the start reply in start()).

/**
 * `POST /api/playback/start`. Name a title with [ratingKey], or a Plex list with [playlistId] (and [shuffle]), never
 * both. [clientId] and [sessionIdentifier] are 8–64 of `A-Za-z0-9_-`.
 */
@Serializable
data class StartRequest(
    val ratingKey: String? = null,
    val playlistId: String? = null,
    val shuffle: Boolean? = null,
    val mediaIndex: Int? = null,
    val partIndex: Int = 0,
    val offsetSeconds: Double = 0.0,
    val resume: Boolean? = null,
    val directPlay: Boolean,
    val directStream: Boolean,
    val directStreamAudio: Boolean,
    val maxVideoBitrate: Int? = null,
    val clientId: String,
    val sessionIdentifier: String,
) {
    init {
        require((ratingKey == null) != (playlistId == null)) { "name a title or a list, not both" }
        require(shuffle == null || playlistId != null) { "shuffle goes only with a list" }
    }
}

@Serializable
data class Decision(val directPlay: Boolean, val directStream: Boolean, val directStreamAudio: Boolean, val maxVideoBitrate: Int? = null)

@Serializable
data class QueueItem(
    val playQueueItemID: Long? = null,
    val ratingKey: String? = null,
    val type: String? = null,
    val title: String? = null,
    val grandparentTitle: String? = null,
    val parentIndex: Int? = null,
    val index: Int? = null,
    val duration: Long? = null,
)

@Serializable
data class PlayQueue(
    val playQueueID: Long? = null,
    val playQueueSelectedItemID: Long? = null,
    val playQueueSelectedItemOffset: Int? = null,
    val playQueueTotalCount: Int? = null,
    val playQueueVersion: Int? = null,
    val playQueueShuffled: Boolean = false,
    val items: List<QueueItem> = emptyList(),
)

/** An audio or subtitle track. `index` is what `/track` and the player use; `url` is set only for an external subtitle. */
@Serializable
data class Track(
    val id: Long? = null,
    val index: Int,
    val codec: String? = null,
    val language: String? = null,
    val title: String? = null,
    val selected: Boolean = false,
    val default: Boolean = false,
    val external: Boolean = false,
    val key: String? = null,
    val offsetMs: Long? = null,
    val url: String? = null,
)

@Serializable
data class Tracks(val audio: List<Track> = emptyList(), val subtitle: List<Track> = emptyList())

/** Plex's `intro` and `credits` markers, for Skip. */
@Serializable
data class Marker(val type: String? = null, val startTimeOffset: Long? = null, val endTimeOffset: Long? = null)

@Serializable
data class Chapter(val index: Int? = null, val title: String? = null, val startTimeOffset: Long? = null, val endTimeOffset: Long? = null)

@Serializable
data class MediaFile(
    val width: Int? = null,
    val height: Int? = null,
    val videoCodec: String? = null,
    val bitrateKbps: Int? = null,
    val dynamicRange: String? = null,
    val dolbyVisionProfile: Int? = null,
)

@Serializable
data class QualityStep(val index: Int, val kbps: Int, val height: Int)

/**
 * The start reply. With `X-Media-Manager-Desktop: 1` (always sent by [PlaybackApi.start]) it carries
 * [streamAddresses]: Plex addresses with a token in them, so they are never logged unscrubbed. The direct ones come
 * first ([directAddressCount]), then relays.
 */
@Serializable
data class StartReply(
    val session: String,
    val ratingKey: String,
    val partId: Long? = null,
    val mediaIndex: Int = 0,
    val startPositionSeconds: Double = 0.0,
    val durationMs: Long? = null,
    val decision: Decision,
    val playQueue: PlayQueue = PlayQueue(),
    val tracks: Tracks = Tracks(),
    val markers: List<Marker> = emptyList(),
    val chapters: List<Chapter> = emptyList(),
    val file: MediaFile = MediaFile(),
    val qualitySteps: List<QualityStep> = emptyList(),
    val streamAddresses: List<String> = emptyList(),
    val directAddressCount: Int = 0,
    val machineIdentifier: String? = null,
)

/** `GET /api/playback/timeline`. */
@Serializable
data class TimelineReply(val ok: Boolean = false, val terminationCode: Int? = null, val terminationText: String? = null)

/** `GET /api/playback/ping`: `ok`, or `gone` once Plex has ended the session. */
@Serializable
data class PingReply(val status: String)

@Serializable
data class PostplayItem(
    val ratingKey: String? = null,
    val type: String? = null,
    val title: String? = null,
    val grandparentTitle: String? = null,
    val parentIndex: Int? = null,
    val index: Int? = null,
    val duration: Long? = null,
    val viewOffset: Long? = null,
)

@Serializable
data class PostplayHub(val hubIdentifier: String? = null, val title: String? = null, val items: List<PostplayItem> = emptyList())

/** `GET /api/playback/postplay`: Plex's Up Next hubs. */
@Serializable
data class Postplay(val hubs: List<PostplayHub> = emptyList())

@Serializable
private data class StopBody(val session: String, val clientId: String)

@Serializable
private data class TrackBody(val partId: Long, val kind: String, val streamId: Long, val allParts: Boolean, val clientId: String)

@Serializable
private data class PlayedBody(val ratingKey: String, val played: Boolean, val clientId: String)

/**
 * `/api/playback/*` as the TV: every call names the Android Plex identity (T24), so Plex sees an Android TV and not the
 * desktop app. [androidRelease] is `Build.VERSION.RELEASE`.
 */
class PlaybackApi(private val client: ServerClient, androidRelease: String) {
    private val identity = mapOf(
        "X-Media-Manager-Plex-Identity" to "android",
        "X-Media-Manager-Platform-Version" to platformVersion(androidRelease),
    )

    suspend fun start(request: StartRequest): ApiResult<StartReply?> = client.post(
        "/api/playback/start",
        client.json.encodeToString(request),
        StartReply.serializer(),
        identity + ("X-Media-Manager-Desktop" to "1"),
    )

    /**
     * The progress report Plex shows in Continue Watching. `state` is `playing`, `paused`, `buffering` or `stopped`.
     * A reply with a [TimelineReply.terminationCode] means Plex ended the session (its owner stopped it).
     */
    suspend fun timeline(
        ratingKey: String,
        state: String,
        timeMs: Long,
        durationMs: Long,
        playbackTimeMs: Long,
        clientId: String,
        sessionIdentifier: String,
        playQueueItemID: Long? = null,
        continuing: Boolean = false,
    ): ApiResult<TimelineReply> {
        val query = listOfNotNull(
            "ratingKey" to ratingKey,
            "state" to state,
            "time" to timeMs.toString(),
            "duration" to durationMs.toString(),
            "playbackTime" to playbackTimeMs.toString(),
            "clientId" to clientId,
            "sessionIdentifier" to sessionIdentifier,
            playQueueItemID?.let { "playQueueItemID" to it.toString() },
            if (continuing) "continuing" to "1" else null,
        )
        return client.get(pathWith("/api/playback/timeline", *query.toTypedArray()), TimelineReply.serializer(), identity)
    }

    suspend fun ping(session: String, clientId: String): ApiResult<PingReply> =
        client.get(pathWith("/api/playback/ping", "session" to session, "clientId" to clientId), PingReply.serializer(), identity)

    suspend fun stop(session: String, clientId: String): ApiResult<Unit?> =
        client.post<Unit>("/api/playback/stop", client.json.encodeToString(StopBody(session, clientId)), null, identity)

    /** Choose an audio or subtitle track (`kind` `audio` or `subtitle`; `streamId` 0 turns subtitles off). */
    suspend fun track(partId: Long, kind: String, streamId: Long, allParts: Boolean, clientId: String): ApiResult<Unit?> =
        client.post<Unit>("/api/playback/track", client.json.encodeToString(TrackBody(partId, kind, streamId, allParts, clientId)), null, identity)

    suspend fun played(ratingKey: String, played: Boolean, clientId: String): ApiResult<Unit?> =
        client.post<Unit>("/api/playback/played", client.json.encodeToString(PlayedBody(ratingKey, played, clientId)), null, identity)

    suspend fun postplay(ratingKey: String, clientId: String): ApiResult<Postplay> =
        client.get(pathWith("/api/playback/postplay", "ratingKey" to ratingKey, "clientId" to clientId), Postplay.serializer(), identity)

    private fun pathWith(path: String, vararg query: Pair<String, String>): String {
        val url = client.url(path).newBuilder().apply { query.forEach { (name, value) -> addQueryParameter(name, value) } }.build()
        return url.encodedPath + "?" + url.encodedQuery
    }

    companion object {
        private val PLATFORM_VERSION = Regex("^\\d{1,3}(\\.\\d{1,3}){0,2}$")

        /** The server takes only `^\d{1,3}(\.\d{1,3}){0,2}$`; a release like "14 Beta" falls back to its leading number. */
        fun platformVersion(release: String): String =
            release.trim().takeIf { PLATFORM_VERSION.matches(it) }
                ?: Regex("^\\d{1,3}(\\.\\d{1,3}){0,2}").find(release.trim())?.value
                ?: "9"
    }
}
