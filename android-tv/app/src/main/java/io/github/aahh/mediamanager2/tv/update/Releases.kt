package io.github.aahh.mediamanager2.tv.update

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// The fields of GitHub's release list that the update check reads
// (GET /repos/aa-hh/media-manager-2/releases, https://docs.github.com/en/rest/releases/releases).
@Serializable
data class GitHubRelease(
    @SerialName("tag_name") val tagName: String,
    val draft: Boolean = false,
    val prerelease: Boolean = false,
    val assets: List<GitHubAsset> = emptyList(),
)

@Serializable
data class GitHubAsset(
    val name: String,
    @SerialName("browser_download_url") val downloadUrl: String,
)

data class AvailableUpdate(val versionCode: Int, val tag: String, val downloadUrl: String)

// The release workflow (T07) tags each build android-tv-v<versionCode> and attaches this asset.
const val UPDATE_ASSET_NAME = "media-manager-2-tv.apk"
private val RELEASE_TAG = Regex("^android-tv-v(\\d{1,9})$")

/**
 * The newest published release with the TV asset, when it is newer than [installedVersionCode]; else null. Drafts,
 * prereleases, other tags (the desktop app's) and releases without the asset never count.
 */
fun newestUpdate(releases: List<GitHubRelease>, installedVersionCode: Int): AvailableUpdate? = releases
    .asSequence()
    .filter { !it.draft && !it.prerelease }
    .mapNotNull { release ->
        val versionCode = RELEASE_TAG.matchEntire(release.tagName)?.groupValues?.get(1)?.toIntOrNull() ?: return@mapNotNull null
        val asset = release.assets.firstOrNull { it.name == UPDATE_ASSET_NAME } ?: return@mapNotNull null
        AvailableUpdate(versionCode, release.tagName, asset.downloadUrl)
    }
    .maxByOrNull { it.versionCode }
    ?.takeIf { it.versionCode > installedVersionCode }
