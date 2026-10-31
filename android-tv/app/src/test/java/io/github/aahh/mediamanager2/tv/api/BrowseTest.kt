package io.github.aahh.mediamanager2.tv.api

import kotlinx.coroutines.test.runTest
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class BrowseTest {
    private val server = MockWebServer().apply { start() }
    private val origin = server.url("/").toString().removeSuffix("/")
    private val browse = BrowseApi(ServerClient(origin, ServerCookieJar(origin.toHttpUrl(), object : CookieStore {
        override fun load() = emptyList<String>()
        override fun save(cookies: List<String>) = Unit
    }), allowHttp = true))

    @After
    fun stop() = server.shutdown()

    private fun reply(body: String, code: Int = 200) = server.enqueue(MockResponse().setResponseCode(code).setBody(body))

    private fun expectRefused(block: () -> Unit) {
        try {
            block()
            fail("an invalid value was accepted")
        } catch (expected: IllegalArgumentException) {
        }
    }

    // Discover's rows come back with these names (src/server/discover/routes.ts); renaming one turns this red.
    @Test
    fun discoverHomeReadsEveryRow() = runTest {
        val card = """{"tmdbId":1,"type":"movie","title":"Heat","year":1995,"date":"1995-12-15","posterUrl":null,"backdropUrl":null,
            "rating":8.3,"genres":["Crime"],"overview":null,"libraryId":3}"""
        reply("""{"trending":{"all":{"results":[$card],"pending":false,"failed":false,"failure":null},
            "movie":{"results":[],"pending":true,"failed":false,"failure":null},"tv":{"results":[],"pending":false,"failed":false,"failure":null}},
            "popularMovies":null,"popularTv":null,"upcomingMovies":{"days30":null,"days90":null},"upcomingTv":null,
            "services":[{"providerId":8,"name":"Netflix","results":[],"pending":false,"failed":true,"failure":"unreachable"}],
            "extraRows":[{"id":"trakt-anticipated","label":"Most anticipated","results":[],"pending":false,"failed":false,"failure":null}]}""")
        val home = (browse.discoverHome() as ApiResult.Ok).value
        assertEquals("/api/discover/home", server.takeRequest().path)
        assertEquals(3, home.trending.all.results.single().libraryId)
        assertTrue(home.trending.movie.pending)
        assertEquals("Netflix", home.services.single().name)
        assertEquals("Most anticipated", home.extraRows.single().label)
    }

    // A grid asks with the values the server checks; an unknown sort or page would be a 400 that turns this red.
    @Test
    fun aDiscoverGridAsksForOnePage() = runTest {
        reply("""{"page":2,"totalPages":9,"results":[],"pending":false}""")
        assertEquals(DiscoverPage(2, 9), (browse.discover("tv", "rating", 2) as ApiResult.Ok).value)
        assertEquals("/api/discover/tv?sort=rating&page=2", server.takeRequest().path)
        // A page still being built comes back pending with no page count (the web shows `totalPages ?? page`).
        reply("""{"page":1,"totalPages":null,"results":[],"pending":true}""")
        assertEquals(DiscoverPage(1, null, pending = true), (browse.discover("movie") as ApiResult.Ok).value)
        server.takeRequest()
        expectRefused { kotlinx.coroutines.runBlocking { browse.discover("all") } }
        expectRefused { kotlinx.coroutines.runBlocking { browse.discover("movie", "trending") } }
    }

    // Search answers line by line, first when one service has results, last when both have; reading only the first
    // line, or calling a half answer complete, turns this red.
    @Test
    fun searchReadsEachStreamedAnswer() = runTest {
        val hit = """{"type":"movie","service":"radarr","key":"radarr:1","title":"Heat","year":1995,"network":null,"status":null,
            "rating":8.3,"overview":null,"posterUrl":null,"inLibrary":true,"libraryId":3,"files":1,"tvdbId":null,"tmdbId":949,"imdbId":"tt0113277"}"""
            .lines().joinToString("") { it.trim() } // one answer per line, as the server streams it
        reply("""{"results":[$hit],"services":{"sonarr":{"kind":"pending"},"radarr":{"kind":"ok","count":1}}}""" + "\n" +
            """{"results":[$hit],"services":{"sonarr":{"kind":"ok","count":0},"radarr":{"kind":"ok","count":1}}}""" + "\n")
        val seen = mutableListOf<SearchAnswer>()
        val result = browse.search("  heat   1995 ") { seen += it }
        val url = server.takeRequest().requestUrl!!
        assertEquals("/api/search", url.encodedPath)
        assertEquals("heat 1995", url.queryParameter("q"))
        assertEquals(listOf(false, true), seen.map { it.complete })
        assertEquals(949, (result as ApiResult.Ok).value.results.single().tmdbId)
    }

    // A reply that stops while a service is still pending is a failure, not "no results"; accepting it turns this red.
    @Test
    fun aSearchThatStopsEarlyFails() = runTest {
        reply("""{"results":[],"services":{"sonarr":{"kind":"pending"},"radarr":{"kind":"ok","count":0}}}""" + "\n")
        assertTrue(browse.search("heat") is ApiResult.Failed)
        expectRefused { kotlinx.coroutines.runBlocking { browse.search("x".repeat(201)) } }
    }

    // The add bodies are checked key by key on the server (src/server/add.ts); an extra or missing key is a 400 and a
    // lost refusal reason leaves the screen with nothing to say, which turns this red.
    @Test
    fun addSendsExactlyTheChoicesAndKeepsTheRefusal() = runTest {
        reply("""{"qualityProfiles":[{"id":4,"name":"HD-1080p"}],"rootFolders":[{"path":"/tv","freeSpace":100}],"lastChoice":null}""")
        reply("""{"libraryId":12}""", 201)
        reply("""{"error":"refused","reason":"This movie has already been added","libraryId":3}""", 409)
        val options = (browse.addOptions("sonarr") as ApiResult.Ok).value
        assertEquals(listOf(RootFolder("/tv", 100)), options.rootFolders)
        server.takeRequest()

        val added = browse.addSeries(81189, SeriesChoices("all", true, 4, "/tv", true, "standard"))
        assertEquals(ApiResult.Ok(201, Added(12)), added)
        assertEquals(
            """{"service":"sonarr","id":81189,"choices":{"monitor":"all","monitorNewSeasons":true,"qualityProfileId":4,"rootFolderPath":"/tv","seasonFolder":true,"seriesType":"standard"}}""",
            server.takeRequest().body.readUtf8(),
        )

        val refused = browse.addMovie(949, MovieChoices("movieOnly", "released", 4, "/movies"))
        assertEquals(ApiResult.Error(409, "refused", "This movie has already been added"), refused)
    }

    // Choices the server would refuse are never built; dropping a check turns this red.
    @Test
    fun invalidChoicesAreNeverBuilt() {
        expectRefused { SeriesChoices("skip", false, 4, "/tv", true, "standard") }
        expectRefused { SeriesChoices("all", false, 4, "/tv", true, "standard", seasons = listOf(1)) }
        expectRefused { SeriesChoices("everything", false, 4, "/tv", true, "standard") }
        expectRefused { MovieChoices("movieOnly", "soon", 4, "/movies") }
        assertEquals(listOf(1, 2), SeriesChoices("skip", false, 4, "/tv", true, "anime", seasons = listOf(1, 2)).seasons)
    }
}
