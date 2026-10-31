package io.github.aahh.mediamanager2.tv.api

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class LibraryPlaybackTest {
    private val server = MockWebServer().apply { start() }
    private val origin = server.url("/").toString().removeSuffix("/")
    private val client = ServerClient(origin, ServerCookieJar(origin.toHttpUrl(), object : CookieStore {
        override fun load() = emptyList<String>()
        override fun save(cookies: List<String>) = Unit
    }))
    private val library = LibraryApi(client)
    private val playback = PlaybackApi(client, "14")

    @After
    fun stop() = server.shutdown()

    private fun reply(body: String, code: Int = 200) = server.enqueue(MockResponse().setResponseCode(code).setBody(body))

    // The Home rails read these fields from the titles reply (src/server/watchStatus.ts); renaming one turns this red.
    @Test
    fun theTitlesReplyFeedsTheHomeRails() = runTest {
        reply("""{"titles":[{"type":"tv","service":"sonarr","id":7,"title":"Slow Horses","year":2022,"added":null,"monitored":true,
            "status":"continuing","posterUrl":"/api/images/p.jpg","smallPosterUrl":null,"qualityProfile":"HD","sizeOnDisk":5,
            "tv":{"episodeFileCount":3,"episodeCount":4,"totalEpisodeCount":6,"seasonCount":1},"movie":null,
            "watch":{"kind":"show","ratingKey":"55","leafCount":6,"viewedLeafCount":2,"lastViewedAt":null}}],
            "services":{"sonarr":{"kind":"ok","count":1},"radarr":{"kind":"not_configured"}},
            "watch":{"kind":"ok","machineIdentifier":"abc","continueWatching":[{"service":"sonarr","id":7,"viewOffsetMs":1000,
            "durationMs":2000,"lastViewedAt":3,"episode":{"seasonNumber":1,"episodeNumber":2,"title":"Hello"}}],
            "recentlyAddedTv":[{"service":"sonarr","id":7,"addedAt":1700000000000}],"recentlyAddedFilms":[]}}""")
        val titles = (library.titles() as ApiResult.Ok).value
        assertEquals("/api/library/titles", server.takeRequest().path)
        assertEquals(TitleWatch("show", "55", leafCount = 6, viewedLeafCount = 2), titles.titles.single().watch)
        assertEquals(EpisodeRef(1, 2, "Hello"), titles.watch.continueWatching.single().episode)
        assertEquals(listOf(RecentlyAddedItem("sonarr", 7, 1_700_000_000_000)), titles.watch.recentlyAddedTv)
    }

    // Plex off or down is a kind, not a failure, so Home still shows the library; failing to decode it turns this red.
    @Test
    fun plexOffIsAKindNotAFailure() = runTest {
        reply("""{"titles":[],"services":{},"watch":{"kind":"off"}}""")
        reply("""{"kind":"unavailable"}""")
        reply("""{"id":3,"title":"Heat","watch":null}""")
        assertEquals(LibraryWatch("off"), (library.titles() as ApiResult.Ok).value.watch)
        assertEquals(Playlists("unavailable"), (library.playlists() as ApiResult.Ok).value)
        assertNull((library.movie(3) as ApiResult.Ok).value.watch)
    }

    // A show's page plays from `watch.episodes`, keyed by Sonarr episode id; a wrong key or shape turns this red.
    @Test
    fun aShowsPageKnowsWhatToPlay() = runTest {
        reply("""{"id":7,"title":"Slow Horses","backdropUrl":"/api/images/b.jpg","rating":8.1,"genres":["Drama"],
            "seasons":[{"seasonNumber":1,"monitored":true,"posterUrl":null,"statistics":{"episodeFileCount":1,"episodeCount":1,
            "totalEpisodeCount":6,"sizeOnDisk":10,"nextAiring":null,"previousAiring":null}}],
            "episodes":[{"id":101,"seasonNumber":1,"episodeNumber":1,"title":"Failure's Contagious","airDate":"2022-04-01",
            "monitored":true,"hasFile":true,"overview":null,"runtime":50,"imageUrl":null,"file":{"id":9,"size":1234,"quality":"WEBDL-1080p"}}],
            "watch":{"kind":"ok","machineIdentifier":"abc","ratingKey":"55","leafCount":6,"viewedLeafCount":0,
            "nextEpisode":{"seasonNumber":1,"episodeNumber":1},"episodes":{"101":{"ratingKey":"56","mediaIndex":0,"partId":77,
            "versions":[],"viewOffsetMs":null,"durationMs":3000000,"viewCount":0,"lastViewedAt":null}}}}""")
        val show = (library.series(7) as ApiResult.Ok).value
        assertEquals("/api/library/series/7", server.takeRequest().path)
        assertEquals("56", show.watch!!.episodes["101"]!!.ratingKey)
        assertEquals(EpisodeRef(1, 1), show.watch?.nextEpisode)
        assertEquals(FileSummary(1234, "WEBDL-1080p"), show.episodes.single().file)
    }

    // A list's page reads its items, and a bad id never reaches the server; dropping the check turns this red.
    @Test
    fun aPlexListReadsItsItems() = runTest {
        reply("""{"kind":"ok","title":"Friday films","items":[{"service":"radarr","id":3,"episode":null}]}""")
        assertEquals(listOf(PlaylistItem("radarr", 3)), (library.playlist("900") as ApiResult.Ok).value.items)
        assertEquals("/api/library/playlists/900", server.takeRequest().path)
        try {
            library.playlist("../titles")
            fail("a bad list id was sent")
        } catch (expected: IllegalArgumentException) {
        }
        assertEquals("$origin/api/images/plex/playlist/900", library.playlistCollage("900").toString())
    }

    // The T23 routes take exactly these bodies; a different one is a 400 from the server, which turns this red.
    @Test
    fun watchedAndRemoveSendWhatTheServerTakes() = runTest {
        reply("", 204)
        reply("", 204)
        library.setWatched("radarr", 3, watched = true)
        val watched = server.takeRequest()
        assertEquals("/api/library/radarr/3/watched", watched.path)
        assertEquals("""{"watched":true}""", watched.body.readUtf8())
        library.removeFromContinueWatching("sonarr", 7)
        val removed = server.takeRequest()
        assertEquals("/api/library/sonarr/7/continue-watching/remove", removed.path)
        assertEquals("{}", removed.body.readUtf8())
    }

    // The start body needs partIndex and offsetSeconds even at 0 and must leave out the keys not used; sending a default
    // as missing, or a null key, is a 400 that turns this red. The identity and desktop headers bring back the addresses.
    @Test
    fun startSendsTheBodyAndHeadersTheServerChecks() = runTest {
        reply("""{"session":"s1","ratingKey":"56","partId":77,"mediaIndex":0,"startPositionSeconds":0,"durationMs":3000000,
            "decision":{"directPlay":true,"directStream":true,"directStreamAudio":true,"maxVideoBitrate":null},
            "playQueue":{"playQueueID":5,"playQueueSelectedItemID":9,"playQueueShuffled":false,"allowShuffle":true,
            "items":[{"playQueueItemID":9,"ratingKey":"56","type":"episode","title":"Failure's Contagious","grandparentTitle":"Slow Horses",
            "parentIndex":1,"index":1,"duration":3000000}]},
            "tracks":{"audio":[{"id":1,"index":0,"ffIndex":1,"codec":"eac3","language":"English","title":null,"selected":true,"default":true}],
            "subtitle":[{"id":2,"index":0,"ffIndex":2,"codec":"srt","language":"English","title":null,"selected":false,"default":false,
            "external":true,"key":"/library/streams/2","offsetMs":null}]},
            "markers":[{"type":"intro","startTimeOffset":1000,"endTimeOffset":60000}],"chapters":[],
            "file":{"width":1920,"height":1080,"videoCodec":"h264","bitrateKbps":8000,"dynamicRange":"sdr","dolbyVisionProfile":null},
            "qualitySteps":[{"index":4,"kbps":2000,"height":720}],
            "streamAddresses":["http://10.0.0.2:32400/library/parts/77/file.mkv?X-Plex-Token=t"],"directAddressCount":1,"machineIdentifier":"abc"}""")
        val started = playback.start(StartRequest(ratingKey = "56", directPlay = true, directStream = true, directStreamAudio = true,
            clientId = "client-0001", sessionIdentifier = "session-0001"))
        val request = server.takeRequest()
        assertEquals("/api/playback/start", request.path)
        assertEquals("android", request.getHeader("X-Media-Manager-Plex-Identity"))
        assertEquals("14", request.getHeader("X-Media-Manager-Platform-Version"))
        assertEquals("1", request.getHeader("X-Media-Manager-Desktop"))
        val body = Json.parseToJsonElement(request.body.readUtf8()).jsonObject
        assertEquals(setOf("ratingKey", "partIndex", "offsetSeconds", "directPlay", "directStream", "directStreamAudio", "clientId", "sessionIdentifier"), body.keys)
        val reply = (started as ApiResult.Ok).value!!
        assertEquals(1, reply.directAddressCount)
        assertEquals("intro", reply.markers.single().type)
        assertEquals(true, reply.tracks.subtitle.single().external)
        assertEquals(9L, reply.playQueue.items.single().playQueueItemID)
    }

    // A list start names the list and never a title; allowing both turns this red.
    @Test
    fun aListStartNamesOnlyTheList() = runTest {
        reply("""{"session":"s1","ratingKey":"56","decision":{"directPlay":false,"directStream":true,"directStreamAudio":true}}""")
        playback.start(StartRequest(playlistId = "900", shuffle = true, directPlay = false, directStream = true, directStreamAudio = true,
            clientId = "client-0001", sessionIdentifier = "session-0001"))
        val body = Json.parseToJsonElement(server.takeRequest().body.readUtf8()) as JsonObject
        assertTrue("playlistId" in body && "shuffle" in body && "ratingKey" !in body)
        for (bad in listOf({ StartRequest(ratingKey = "1", playlistId = "2", directPlay = true, directStream = true, directStreamAudio = true, clientId = "c", sessionIdentifier = "s") },
            { StartRequest(ratingKey = "1", shuffle = true, directPlay = true, directStream = true, directStreamAudio = true, clientId = "c", sessionIdentifier = "s") })) {
            try {
                bad()
                fail("an invalid start was built")
            } catch (expected: IllegalArgumentException) {
            }
        }
    }

    // Plex counts progress from the timeline report's query; a missing or misnamed value is a 400 that turns this red.
    @Test
    fun theTimelineReportCarriesEveryValue() = runTest {
        reply("""{"ok":true,"terminationCode":null,"terminationText":null}""")
        val result = playback.timeline("56", "playing", 1000, 3000000, 900, "client-0001", "session-0001", playQueueItemID = 9, continuing = true)
        val url = server.takeRequest().requestUrl!!
        assertEquals("/api/playback/timeline", url.encodedPath)
        assertEquals(
            mapOf("ratingKey" to "56", "state" to "playing", "time" to "1000", "duration" to "3000000", "playbackTime" to "900",
                "clientId" to "client-0001", "sessionIdentifier" to "session-0001", "playQueueItemID" to "9", "continuing" to "1"),
            url.queryParameterNames.associateWith { url.queryParameter(it) },
        )
        assertEquals(TimelineReply(ok = true), (result as ApiResult.Ok).value)
    }

    // The server takes only a dotted number as the Android release; sending "14 Beta" would be a 400 on every call.
    @Test
    fun thePlatformVersionIsWhatTheServerTakes() {
        assertEquals("14", PlaybackApi.platformVersion("14"))
        assertEquals("12.1", PlaybackApi.platformVersion("12.1"))
        assertEquals("15", PlaybackApi.platformVersion("15 Beta 2"))
        assertEquals("9", PlaybackApi.platformVersion("Tiramisu"))
    }
}
