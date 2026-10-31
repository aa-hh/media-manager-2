package io.github.aahh.mediamanager2.tv.downloads

import io.github.aahh.mediamanager2.tv.api.ApiResult
import java.io.Closeable
import java.io.IOException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

private class FakeStream : EventStream {
    val listeners = mutableListOf<EventStream.Listener>()
    var closes = 0
    val current get() = listeners.last()
    override fun open(listener: EventStream.Listener): Closeable {
        listeners += listener
        return Closeable { closes += 1 }
    }
}

/** Each read waits until the test answers it. */
private class FakeSource : SnapshotSource {
    val pending = mutableListOf<CompletableDeferred<ApiResult<Snapshot>>>()
    override suspend fun read(): ApiResult<Snapshot> = CompletableDeferred<ApiResult<Snapshot>>().also { pending += it }.await()
    fun answer(index: Int, snapshot: Snapshot) = pending[index].complete(ApiResult.Ok(200, snapshot))
}

private fun snapshotNamed(name: String) = Snapshot(torrents = listOf(Torrent(hash = name, name = name)))
private const val TORRENTS_EVENT = """{"changed":[{"hash":"late","name":"late","extra":1}],"gone":[]}"""

class DownloadsFeedTest {
    private class Setup(scope: TestScope) {
        val stream = FakeStream()
        val source = FakeSource()
        val feed = DownloadsFeed(stream, source, scope.backgroundScope)
    }

    // A stream with no replay: reading the snapshot before the stream opens, or storing a read that an event overtook,
    // loses that event. Dropping the second read turns this red.
    @Test
    fun anEventDuringTheReadMakesItReadAgain() = runTest {
        val setup = Setup(this)
        setup.feed.acquire()
        runCurrent()
        assertEquals("no read before the stream opens", 0, setup.source.pending.size)
        setup.stream.current.opened()
        runCurrent()
        setup.stream.current.event("torrents", TORRENTS_EVENT)
        runCurrent()
        setup.source.answer(0, snapshotNamed("first"))
        runCurrent()
        assertEquals(2, setup.source.pending.size)
        setup.source.answer(1, snapshotNamed("second"))
        runCurrent()
        assertEquals(DownloadsState.Ready(snapshotNamed("second"), live = true), setup.feed.state.value)

        setup.stream.current.event("torrents", TORRENTS_EVENT)
        setup.stream.current.event("torrents", "not json")
        runCurrent()
        val ready = setup.feed.state.value as DownloadsState.Ready
        assertEquals(listOf("second", "late"), ready.snapshot.torrents.map { it.hash })
        assertEquals("an event after the read needs no new read", 2, setup.source.pending.size)
    }

    // The stream never reopens itself: without the re-read and the growing wait the TV shows stale progress forever,
    // and without the cap it waits ever longer. A wrong delay, or a delay that never resets once open, turns this red.
    @Test
    fun aClosedStreamReadsAgainAndReopensAfterAGrowingWait() = runTest {
        val setup = Setup(this)
        val watched = mutableListOf<String?>()
        backgroundScope.launch { setup.feed.watchChanges.collect { watched += it } }
        setup.feed.acquire()
        setup.stream.current.opened()
        runCurrent()
        setup.source.answer(0, snapshotNamed("first"))
        runCurrent()

        setup.stream.current.closed()
        runCurrent()
        assertEquals(DownloadsState.Ready(snapshotNamed("first"), live = false), setup.feed.state.value)
        setup.source.answer(1, snapshotNamed("again"))
        runCurrent()
        advanceTimeBy(1_999)
        runCurrent()
        assertEquals(1, setup.stream.listeners.size)
        advanceTimeBy(2)
        runCurrent()
        assertEquals(2, setup.stream.listeners.size)

        setup.stream.current.closed()
        runCurrent()
        setup.source.pending.last().complete(ApiResult.Failed(IOException("offline")))
        runCurrent()
        advanceTimeBy(3_999)
        runCurrent()
        assertEquals(2, setup.stream.listeners.size)
        advanceTimeBy(2)
        runCurrent()
        assertEquals(3, setup.stream.listeners.size)
        assertEquals("a failed read keeps what was shown", DownloadsState.Ready(snapshotNamed("again"), live = false), setup.feed.state.value)

        setup.stream.current.opened()
        runCurrent()
        assertEquals("after a reopen any title may have changed", listOf<String?>(null), watched)
        setup.stream.current.event("watch", """{"ratingKey":"42"}""")
        runCurrent()
        assertEquals(listOf(null, "42"), watched)
        setup.source.pending.last().complete(ApiResult.Ok(200, snapshotNamed("third")))
        runCurrent()
        setup.stream.current.closed()
        runCurrent()
        setup.source.pending.last().complete(ApiResult.Ok(200, snapshotNamed("third")))
        runCurrent()
        advanceTimeBy(2_001)
        runCurrent()
        assertEquals("an open stream resets the wait to 2 s", 4, setup.stream.listeners.size)
    }

    // A reload under way when the stream closes makes the close's own read stale; treating stale as "stop" leaves the
    // stream closed for good and the TV never live again. Skipping the reopen on a stale read turns this red.
    @Test
    fun aStreamThatClosesDuringAReloadStillReopens() = runTest {
        val setup = Setup(this)
        setup.feed.acquire()
        setup.stream.current.opened()
        runCurrent()
        setup.source.answer(0, snapshotNamed("first"))
        runCurrent()
        setup.stream.current.closed()
        runCurrent()
        backgroundScope.launch { setup.feed.reload() }
        runCurrent()
        setup.source.answer(1, snapshotNamed("stale"))
        setup.source.answer(2, snapshotNamed("reloaded"))
        runCurrent()
        advanceTimeBy(2_001)
        runCurrent()
        assertEquals(2, setup.stream.listeners.size)
        assertEquals(DownloadsState.Ready(snapshotNamed("reloaded"), live = false), setup.feed.state.value)
    }

    // Reopening with an expired session would retry forever; ignoring the 401 turns this red.
    @Test
    fun anExpiredSessionStopsTheReopening() = runTest {
        val setup = Setup(this)
        setup.feed.acquire()
        setup.stream.current.closed()
        runCurrent()
        setup.source.pending[0].complete(ApiResult.Error(401, "unauthorized"))
        runCurrent()
        advanceTimeBy(120_000)
        runCurrent()
        assertEquals(1, setup.stream.listeners.size)
        assertEquals(DownloadsState.Loading, setup.feed.state.value)
    }

    // The server allows 20 streams in all, so a screen that no longer needs the feed must close it; a late callback from
    // the closed stream must not read or reopen. Leaking the stream, or obeying the old callback, turns this red.
    @Test
    fun theLastReleaseClosesTheStreamAndIgnoresItsLateCallbacks() = runTest {
        val setup = Setup(this)
        setup.feed.acquire()
        setup.feed.acquire()
        setup.feed.release()
        assertEquals(0, setup.stream.closes)
        setup.feed.release()
        assertEquals(1, setup.stream.closes)
        val old = setup.stream.current
        old.opened()
        old.closed()
        runCurrent()
        advanceTimeBy(60_000)
        runCurrent()
        assertEquals(0, setup.source.pending.size)
        assertEquals(1, setup.stream.listeners.size)

        setup.feed.acquire()
        assertEquals(2, setup.stream.listeners.size)
        old.opened()
        runCurrent()
        assertEquals("the old stream's open is not the new one's", 0, setup.source.pending.size)
    }
}
