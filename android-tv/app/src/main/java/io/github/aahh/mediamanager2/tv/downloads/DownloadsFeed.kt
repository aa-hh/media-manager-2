package io.github.aahh.mediamanager2.tv.downloads

import io.github.aahh.mediamanager2.tv.api.ApiResult
import io.github.aahh.mediamanager2.tv.api.ServerClient
import java.io.Closeable
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import okhttp3.Request
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources

/** The server's `/api/events` stream. Each [open] is one connection; after [Listener.closed] it never reopens itself. */
fun interface EventStream {
    interface Listener {
        fun opened()
        fun event(type: String, data: String)
        fun closed()
    }

    fun open(listener: Listener): Closeable
}

/** `GET /api/downloads`. */
fun interface SnapshotSource {
    suspend fun read(): ApiResult<Snapshot>
}

sealed interface DownloadsState {
    data object Loading : DownloadsState
    data object Failed : DownloadsState
    /** [live] is true only while the stream is open and [snapshot] was read after it opened. */
    data class Ready(val snapshot: Snapshot, val live: Boolean) : DownloadsState
}

enum class LoadResult { Stored, Unauthorized, Failed, Stale }

@Serializable
private data class WatchEvent(val ratingKey: String)

/**
 * The downloads snapshot kept current by the live event stream: a port of the web's `useDownloads`. The stream has no
 * replay, so every (re)connect reads the snapshot again, and a read that saw an event while in flight runs again, since
 * the snapshot may predate the event. A closed stream reopens after 2 s, doubling up to 30 s; a 401 stops it.
 *
 * The stream is open only while someone [acquire]s the feed (a title page, Up Next), and closes on the last [release].
 * Every call and all state changes run on [scope], which must be confined to one thread (the main dispatcher).
 * [watchChanges] carries the Plex ratingKey of each `watch` event, or null after a reopen, when any title may have changed.
 */
class DownloadsFeed(
    private val stream: EventStream,
    private val source: SnapshotSource,
    private val scope: CoroutineScope,
) {
    private val json = Json { ignoreUnknownKeys = true }
    private val mutableState = MutableStateFlow<DownloadsState>(DownloadsState.Loading)
    val state: StateFlow<DownloadsState> = mutableState.asStateFlow()
    private val mutableWatch = MutableSharedFlow<String?>(extraBufferCapacity = 64)
    val watchChanges: SharedFlow<String?> = mutableWatch.asSharedFlow()

    private var users = 0
    private var connection: Closeable? = null
    // Callbacks from a connection that has since closed are dropped; each connection gets its own id.
    private var connectionId = 0
    private var reopenJob: Job? = null
    private var reopenDelay = FIRST_REOPEN_MS
    private var version = 0
    private var open = false
    private var openedBefore = false
    private var eventDuringLoad = false

    fun acquire() {
        users += 1
        if (users == 1) connect()
    }

    fun release() {
        check(users > 0) { "release without acquire" }
        users -= 1
        if (users > 0) return
        reopenJob?.cancel()
        dropConnection()
        open = false
        version += 1
        setLive(false)
    }

    /** Reads the snapshot again, as after an action that changes a download. */
    suspend fun reload(): LoadResult = load()

    private fun connect() {
        val id = ++connectionId
        connection = stream.open(object : EventStream.Listener {
            override fun opened() = onStream(id) { streamOpened() }
            override fun event(type: String, data: String) = onStream(id) { streamEvent(type, data) }
            override fun closed() = onStream(id) { streamClosed() }
        })
    }

    private fun onStream(id: Int, block: () -> Unit) {
        scope.launch { if (id == connectionId && users > 0) block() }
    }

    private fun dropConnection() {
        connectionId += 1
        connection?.close()
        connection = null
    }

    private fun streamOpened() {
        if (openedBefore) mutableWatch.tryEmit(null)
        openedBefore = true
        open = true
        reopenDelay = FIRST_REOPEN_MS
        scope.launch { load() }
    }

    private fun streamEvent(type: String, data: String) {
        if (type == "watch") {
            parse { json.decodeFromString(WatchEvent.serializer(), data) }?.let { mutableWatch.tryEmit(it.ratingKey) }
            return
        }
        val event = parse {
            when (type) {
                "torrents" -> LiveEvent.Torrents(json.decodeFromString(TorrentsEvent.serializer(), data))
                "queue" -> LiveEvent.Queue(json.decodeFromString(QueueEvent.serializer(), data))
                "grab" -> LiveEvent.GrabChanged(json.decodeFromString(Grab.serializer(), data))
                "problem" -> LiveEvent.ProblemChanged(json.decodeFromString(Problem.serializer(), data))
                else -> null
            }
        } ?: return
        eventDuringLoad = true
        val current = mutableState.value
        if (current is DownloadsState.Ready) mutableState.value = current.copy(snapshot = applyEvent(current.snapshot, event))
    }

    private fun streamClosed() {
        dropConnection()
        open = false
        setLive(false)
        // Reading the snapshot finds an expired session (the client then reports it signed out); otherwise the stream
        // reopens after a growing wait, as after a proxy's 502 mid-deploy or the server's stream limit.
        scope.launch {
            val result = load()
            if (users == 0 || connection != null || result == LoadResult.Unauthorized || result == LoadResult.Stale) return@launch
            val wait = reopenDelay
            reopenDelay = minOf(reopenDelay * 2, MAX_REOPEN_MS)
            reopenJob = scope.launch {
                delay(wait)
                if (users > 0 && connection == null) connect()
            }
        }
    }

    private suspend fun load(): LoadResult {
        val mine = ++version
        eventDuringLoad = false
        val result = source.read()
        if (mine != version) return LoadResult.Stale
        when (result) {
            is ApiResult.Ok -> mutableState.value = DownloadsState.Ready(result.value, open)
            is ApiResult.Error -> {
                if (result.status == 401) return LoadResult.Unauthorized
                return failed()
            }
            is ApiResult.Failed -> return failed()
        }
        return if (eventDuringLoad) load() else LoadResult.Stored
    }

    private fun failed(): LoadResult {
        if (mutableState.value !is DownloadsState.Ready) mutableState.value = DownloadsState.Failed
        return LoadResult.Failed
    }

    private fun setLive(live: Boolean) {
        val current = mutableState.value
        if (current is DownloadsState.Ready && current.live != live) mutableState.value = current.copy(live = live)
    }

    // An unreadable event changes nothing.
    private inline fun <T> parse(block: () -> T): T? = try {
        block()
    } catch (error: SerializationException) {
        null
    } catch (error: IllegalArgumentException) {
        null
    }

    companion object {
        const val FIRST_REOPEN_MS = 2_000L
        const val MAX_REOPEN_MS = 30_000L

        fun forServer(client: ServerClient, scope: CoroutineScope) =
            DownloadsFeed(ServerEventStream(client), { client.get("/api/downloads", Snapshot.serializer()) }, scope)
    }
}

/**
 * [EventStream] over OkHttp's SSE client, sharing [client]'s session cookie. The server sends a keepalive every 25 s,
 * so a read that waits a minute means the connection is gone.
 */
class ServerEventStream(private val client: ServerClient) : EventStream {
    private val factory = EventSources.createFactory(client.http.newBuilder().readTimeout(60, TimeUnit.SECONDS).build())

    override fun open(listener: EventStream.Listener): Closeable {
        val request = Request.Builder().url(client.url("/api/events")).header("Accept", "text/event-stream").build()
        val source = factory.newEventSource(request, object : EventSourceListener() {
            override fun onOpen(eventSource: EventSource, response: Response) = listener.opened()
            override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) = listener.event(type ?: "message", data)
            override fun onClosed(eventSource: EventSource) = listener.closed()
            override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) = listener.closed()
        })
        return Closeable { source.cancel() }
    }
}
