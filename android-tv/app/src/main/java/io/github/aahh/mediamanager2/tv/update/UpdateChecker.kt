package io.github.aahh.mediamanager2.tv.update

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request

sealed interface UpdateState {
    data object Unknown : UpdateState
    data object UpToDate : UpdateState
    data class Available(val update: AvailableUpdate) : UpdateState
    /** GitHub could not be asked or gave an answer we cannot read; the app carries on and asks again next launch. */
    data object Failed : UpdateState
}

/**
 * Asks GitHub for the newest TV release at launch. Debug builds (versionCode 1, `.debug` suffix) never ask. Uses its own
 * client with no cookie jar, so our session cookie never goes to GitHub.
 */
class UpdateChecker(
    private val client: OkHttpClient,
    private val installedVersionCode: Int,
    private val debugBuild: Boolean,
    private val releasesUrl: String = RELEASES_URL,
) {
    private val json = Json { ignoreUnknownKeys = true }
    private val mutableState = MutableStateFlow<UpdateState>(UpdateState.Unknown)
    val state: StateFlow<UpdateState> = mutableState.asStateFlow()

    suspend fun checkNow(): UpdateState {
        if (debugBuild) return UpdateState.UpToDate.also { mutableState.value = it }
        val result = withContext(Dispatchers.IO) {
            runCatching {
                val request = Request.Builder()
                    .url(releasesUrl)
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", "2022-11-28")
                    .build()
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) error("GitHub answered ${response.code}")
                    json.decodeFromString<List<GitHubRelease>>(response.body.string())
                }
            }
        }
        val state = result.fold(
            onSuccess = { releases -> newestUpdate(releases, installedVersionCode)?.let { UpdateState.Available(it) } ?: UpdateState.UpToDate },
            onFailure = { UpdateState.Failed },
        )
        mutableState.value = state
        return state
    }

    companion object {
        const val RELEASES_URL = "https://api.github.com/repos/aa-hh/media-manager-2/releases?per_page=30"
    }
}
