package io.github.aahh.mediamanager2.tv.api

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import okhttp3.Cookie
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

private class MemoryCookieStore : CookieStore {
    var saved: List<String> = emptyList()
    override fun load() = saved
    override fun save(cookies: List<String>) {
        saved = cookies
    }
}

class ServerClientTest {
    private val server = MockWebServer().apply { start() }
    private val origin = server.url("/").toString().removeSuffix("/")
    private val store = MemoryCookieStore()

    @After
    fun stop() = server.shutdown()

    private fun newClient(clock: () -> Long = System::currentTimeMillis) =
        ServerClient(origin, ServerCookieJar(origin.toHttpUrl(), store, clock), allowHttp = true)

    // The session cookie and sign-in go only over https: building a client for an http server, or following a redirect
    // from https down to http, turns this red.
    @Test
    fun onlyAnHttpsServerIsUsed() {
        try {
            ServerClient("http://media.example.com", ServerCookieJar("http://media.example.com".toHttpUrl(), store, System::currentTimeMillis))
            fail("an http server address was accepted")
        } catch (expected: IllegalArgumentException) {
        }
        val client = ServerClient("https://media.example.com", ServerCookieJar("https://media.example.com".toHttpUrl(), store, System::currentTimeMillis))
        assertFalse(client.http.followSslRedirects)
    }

    // requireBrowserPost refuses a write without these three headers; dropping any of them, or sending them on a GET,
    // turns this red.
    @Test
    fun writesCarryTheBrowserHeadersAndReadsDoNot() = runTest {
        server.enqueue(MockResponse().setBody("""{"expiresAt":1,"serverNow":0,"mediaServer":"plex"}"""))
        server.enqueue(MockResponse().setResponseCode(201).setBody("""{"reference":"ABC234"}"""))
        val auth = AuthApi(newClient())

        auth.session()
        val read = server.takeRequest()
        assertNull(read.getHeader("Origin"))
        assertNull(read.getHeader("X-Requested-With"))

        val sent = auth.sendLog("1.0.7", "line one")
        val write = server.takeRequest()
        assertEquals(origin, write.getHeader("Origin"))
        assertEquals("media-manager-2", write.getHeader("X-Requested-With"))
        assertTrue(write.getHeader("Content-Type")!!.startsWith("application/json"))
        assertEquals("""{"appVersion":"1.0.7","log":"line one"}""", write.body.readUtf8())
        assertEquals(ApiResult.Ok(201, DeviceLogReference("ABC234")), sent)
    }

    // The session cookie is kept in the store, so the TV is still signed in after a restart; keeping it only in memory
    // turns this red.
    @Test
    fun theSessionCookieSurvivesARestart() = runTest {
        server.enqueue(MockResponse().setBody("""{"expiresAt":2}""").addHeader("Set-Cookie", "mm_session=abc123; Max-Age=7776000; Path=/; HttpOnly; SameSite=Lax"))
        AuthApi(newClient()).linkComplete()
        server.takeRequest()

        server.enqueue(MockResponse().setBody("""{"expiresAt":1,"serverNow":0,"mediaServer":"plex"}"""))
        AuthApi(newClient()).session()
        assertEquals("mm_session=abc123", server.takeRequest().getHeader("Cookie"))
    }

    // A cookie from any other host is never kept, so ours never mixes with another site's; accepting it turns this red.
    @Test
    fun cookiesFromOtherHostsAreIgnored() {
        val jar = ServerCookieJar(origin.toHttpUrl(), store)
        val elsewhere = "https://plex.tv/".toHttpUrl()
        jar.saveFromResponse(elsewhere, listOf(Cookie.parse(elsewhere, "mm_session=stolen; Max-Age=60")!!))
        assertTrue(store.saved.isEmpty())
        assertTrue(jar.loadForRequest(origin.toHttpUrl()).isEmpty())
        assertTrue(jar.loadForRequest(elsewhere).isEmpty())
    }

    // The server clears the cookie with Max-Age 0 on log out, and the TV forgets it locally too; keeping a cleared
    // cookie turns this red.
    @Test
    fun logOutForgetsTheCookie() = runTest {
        store.saved = listOf(Cookie.parse(origin.toHttpUrl(), "mm_session=abc123; Max-Age=7776000; Path=/")!!.toString())
        server.enqueue(MockResponse().setResponseCode(204).addHeader("Set-Cookie", "mm_session=; Max-Age=0; Path=/"))
        val client = newClient()
        assertEquals(ApiResult.Ok<Unit?>(204, null), AuthApi(client).logout())
        assertEquals("mm_session=abc123", server.takeRequest().getHeader("Cookie"))
        assertTrue(store.saved.isEmpty())
        assertTrue(client.cookies.loadForRequest(origin.toHttpUrl()).isEmpty())
    }

    // A 401 from a private route means the session ended and the TV must show sign-in; ignoring it turns this red.
    @Test
    fun a401FromThePrivateApiSignsOut() = runTest {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"unauthorized"}"""))
        val client = newClient()
        assertFalse(client.signedOut.value)
        assertEquals(ApiResult.Error(401, "unauthorized"), AuthApi(client).session())
        assertTrue(client.signedOut.value)
    }

    // The screens show the server's error code (rate_limited, setup_required…); losing it turns this red.
    @Test
    fun errorsKeepTheServersCode() = runTest {
        server.enqueue(MockResponse().setResponseCode(429).addHeader("Retry-After", "30").setBody("""{"error":"rate_limited"}"""))
        server.enqueue(MockResponse().setResponseCode(502).setBody("<html>Bad gateway</html>"))
        val auth = AuthApi(newClient())
        assertEquals(ApiResult.Error(429, "rate_limited"), auth.linkStart("Lounge TV"))
        assertEquals(ApiResult.Error(502, null), auth.linkStart("Lounge TV"))
    }

    // The code screen asks until the code is entered, then the TV is signed in; stopping after the first "pending" turns this red.
    @Test
    fun linkSignInWaitsWhilePendingThenSignsIn() = runTest {
        server.enqueue(MockResponse().setResponseCode(201).setBody("""{"code":"K7Q2","expiresAt":10000}"""))
        server.enqueue(MockResponse().setResponseCode(202).setBody("""{"status":"pending"}"""))
        server.enqueue(MockResponse().setResponseCode(503).setBody("""{"error":"plex_unavailable"}"""))
        server.enqueue(MockResponse().setBody("""{"expiresAt":99}""").addHeader("Set-Cookie", "mm_session=abc123; Max-Age=7776000; Path=/"))
        val client = newClient(clock = { 0L })
        val pauses = mutableListOf<Long>()
        var shown: LinkCode? = null

        val outcome = LinkSignIn(AuthApi(client), client, now = { 0L }, pause = { pauses += it }).signIn("Lounge TV") { shown = it }

        assertEquals(LinkOutcome.SignedIn, outcome)
        assertEquals(LinkCode("K7Q2", 10000), shown)
        assertEquals(listOf(2_000L, 2_000L, 2_000L), pauses)
        assertEquals("""{"deviceName":"Lounge TV"}""", server.takeRequest().body.readUtf8())
        repeat(3) { assertEquals("/auth/link/complete", server.takeRequest().path) }
        assertEquals(1, store.saved.size)
    }

    // A code nobody enters runs out when the server says so; asking forever turns this red.
    @Test
    fun linkSignInStopsWhenTheServerSaysTheCodeRanOut() = runTest {
        server.enqueue(MockResponse().setResponseCode(201).setBody("""{"code":"K7Q2","expiresAt":5000}"""))
        server.enqueue(MockResponse().setResponseCode(202).setBody("""{"status":"pending"}"""))
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"flow_expired"}"""))
        val client = newClient()

        val outcome = LinkSignIn(AuthApi(client), client, now = { 0L }, pause = {}).signIn("Lounge TV") {}

        assertEquals(LinkOutcome.Expired, outcome)
        assertEquals(3, server.requestCount)
    }

    // The server prunes a run-out attempt when another sign-in starts, so a late ask gets invalid_flow; showing that as
    // a refusal instead of offering a new code turns this red.
    @Test
    fun aPrunedAttemptCountsAsRunOut() = runTest {
        server.enqueue(MockResponse().setResponseCode(201).setBody("""{"code":"K7Q2","expiresAt":5000}"""))
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"invalid_flow"}"""))
        val client = newClient()
        assertEquals(LinkOutcome.Expired, LinkSignIn(AuthApi(client), client, now = { 0L }, pause = {}).signIn("Lounge TV") {})
    }

    // A TV clock far ahead of the server's must not end sign-in before the first ask; comparing the TV clock with the
    // server's expiresAt turns this red. The local cap still stops a server that never answers flow_expired.
    @Test
    fun aSkewedTvClockDoesNotEndSignInEarly() = runTest {
        server.enqueue(MockResponse().setResponseCode(201).setBody("""{"code":"K7Q2","expiresAt":1000}"""))
        server.enqueue(MockResponse().setResponseCode(202).setBody("""{"status":"pending"}"""))
        server.enqueue(MockResponse().setBody("""{"expiresAt":99}""").addHeader("Set-Cookie", "mm_session=abc123; Max-Age=7776000; Path=/"))
        val client = newClient()
        val tenMinutesFast = 1000L + 600_000L
        assertEquals(LinkOutcome.SignedIn, LinkSignIn(AuthApi(client), client, now = { tenMinutesFast }, pause = {}).signIn("Lounge TV") {})

        server.enqueue(MockResponse().setResponseCode(201).setBody("""{"code":"K7Q3","expiresAt":1000}"""))
        repeat(3) { server.enqueue(MockResponse().setResponseCode(202).setBody("""{"status":"pending"}""")) }
        var clock = 0L
        val capped = LinkSignIn(AuthApi(client), client, now = { clock }, pause = { clock += LinkSignIn.MAX_WAIT_MS / 3 })
        assertEquals(LinkOutcome.Expired, capped.signIn("Lounge TV") {})
        assertEquals(7, server.requestCount)
    }

    // Back on the code screen drops the attempt on the server; leaving it running turns this red.
    @Test
    fun cancellingSignInCancelsTheAttempt() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(201).setBody("""{"code":"K7Q2","expiresAt":10000}"""))
        server.enqueue(MockResponse().setResponseCode(204))
        val client = newClient()
        val codeShown = CompletableDeferred<Unit>()
        val job = launch {
            LinkSignIn(AuthApi(client), client, now = { 0L }, pause = { awaitCancellation() }).signIn("Lounge TV") { codeShown.complete(Unit) }
        }
        codeShown.await()
        job.cancel()
        job.join()
        assertEquals("/auth/link/start", server.takeRequest().path)
        assertEquals("/auth/cancel", server.takeRequest().path)
    }

    // A refusal while waiting (owner_only) ends sign-in with the server's code; retrying it turns this red.
    @Test
    fun aRefusalWhileWaitingEndsSignIn() = runTest {
        server.enqueue(MockResponse().setResponseCode(201).setBody("""{"code":"K7Q2","expiresAt":10000}"""))
        server.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"owner_only"}"""))
        val client = newClient()
        val outcome = LinkSignIn(AuthApi(client), client, now = { 0L }, pause = {}).signIn("Lounge TV") {}
        assertEquals(LinkOutcome.Refused(403, "owner_only"), outcome)
    }
}
