package io.github.aahh.mediamanager2.tv.update

import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ReleasesTest {
    private fun release(tag: String, draft: Boolean = false, prerelease: Boolean = false, asset: String? = UPDATE_ASSET_NAME) =
        GitHubRelease(tag, draft, prerelease, listOfNotNull(asset?.let { GitHubAsset(it, "https://github.example/$tag/$it") }))

    // Picking the first or the latest-dated release instead of the highest versionCode turns this red.
    @Test
    fun theHighestPublishedTvReleaseWins() {
        val update = newestUpdate(listOf(release("android-tv-v7"), release("android-tv-v12"), release("android-tv-v9")), installedVersionCode = 5)
        assertEquals(AvailableUpdate(12, "android-tv-v12", "https://github.example/android-tv-v12/media-manager-2-tv.apk"), update)
    }

    // Counting a draft, a prerelease, another app's tag, a suffixed tag or a release without the APK turns this red.
    @Test
    fun draftsPrereleasesOtherTagsAndMissingAssetsNeverCount() {
        val releases = listOf(
            release("android-tv-v20", draft = true),
            release("android-tv-v19", prerelease = true),
            release("android-tv-v18", asset = "notes.txt"),
            release("desktop-v30"),
            release("android-tv-v17-beta"),
            release("android-tv-v6"),
        )
        assertEquals(6, newestUpdate(releases, installedVersionCode = 5)?.versionCode)
    }

    // Offering the installed version or an older one turns this red.
    @Test
    fun anEqualOrOlderReleaseIsNoUpdate() {
        assertNull(newestUpdate(listOf(release("android-tv-v5")), installedVersionCode = 5))
        assertNull(newestUpdate(listOf(release("android-tv-v4")), installedVersionCode = 5))
        assertNull(newestUpdate(emptyList(), installedVersionCode = 5))
    }
}

class UpdateCheckerTest {
    private val server = MockWebServer()

    @After
    fun stop() = server.shutdown()

    private fun checker(debugBuild: Boolean = false) =
        UpdateChecker(OkHttpClient(), installedVersionCode = 3, debugBuild = debugBuild, releasesUrl = server.url("/releases").toString())

    // Failing on GitHub's other fields, dropping the GitHub Accept header, or sending our cookie turns this red.
    @Test
    fun aNewerReleaseIsAvailableAndUnknownFieldsAreIgnored() = runTest {
        server.enqueue(MockResponse().setBody(
            """[{"tag_name":"android-tv-v4","draft":false,"prerelease":false,"html_url":"x","assets":[{"name":"media-manager-2-tv.apk","browser_download_url":"https://github.example/a.apk","size":1}]}]""",
        ))
        val state = checker().checkNow()
        assertEquals(UpdateState.Available(AvailableUpdate(4, "android-tv-v4", "https://github.example/a.apk")), state)
        val request = server.takeRequest()
        assertEquals("application/vnd.github+json", request.getHeader("Accept"))
        assertNull(request.getHeader("Cookie"))
    }

    // Reporting an error answer or unreadable JSON as up to date turns this red.
    @Test
    fun aFailedAnswerIsFailedNotUpToDate() = runTest {
        server.enqueue(MockResponse().setResponseCode(503))
        assertEquals(UpdateState.Failed, checker().checkNow())
        server.enqueue(MockResponse().setBody("not json"))
        assertEquals(UpdateState.Failed, checker().checkNow())
    }

    // Letting a debug build ask GitHub turns this red.
    @Test
    fun aDebugBuildNeverAsks() = runTest {
        assertEquals(UpdateState.UpToDate, checker(debugBuild = true).checkNow())
        assertEquals(0, server.requestCount)
    }
}
