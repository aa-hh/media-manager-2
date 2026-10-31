package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.runtime.Composable
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.downloads.DownloadsFeed
import io.github.aahh.mediamanager2.tv.ui.Route

/**
 * A film's title page: backdrop, facts, Resume or Play, live download progress, automatic search and its outcomes.
 * FINAL frames: T03a B1, C3 (searching), C6 (grabbed); T03d C2 (nothing found), C3 (search failed). Stub until its task builds it; the signature is the one it keeps.
 */
@Suppress("UNUSED_PARAMETER")
@Composable
fun FilmScreen(movieId: Int, library: LibraryApi, downloads: DownloadsFeed?, onNavigate: (Route) -> Unit) {
    Placeholder("Film", "T03a B1, C3 (searching), C6 (grabbed); T03d C2 (nothing found), C3 (search failed)")
}
