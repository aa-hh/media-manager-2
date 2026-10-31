package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.runtime.Composable
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.downloads.DownloadsFeed
import io.github.aahh.mediamanager2.tv.ui.Route

/**
 * A show's title page: season tabs and the episode list, with per-season download progress.
 * FINAL frames: T03a B2, B3 (downloading). Stub until its task builds it; the signature is the one it keeps.
 */
@Suppress("UNUSED_PARAMETER")
@Composable
fun ShowScreen(seriesId: Int, library: LibraryApi, downloads: DownloadsFeed?, onNavigate: (Route) -> Unit) {
    Placeholder("Show", "T03a B2, B3 (downloading)")
}
