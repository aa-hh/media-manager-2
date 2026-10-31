package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.runtime.Composable
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.downloads.DownloadsFeed
import io.github.aahh.mediamanager2.tv.ui.Route

/** TV shows only shows; Films only films. Both pages are otherwise the same. */
enum class LibraryKind { Shows, Films }

/**
 * TV and Films: a grid of the library's titles under the tabs All, Continue watching, Unwatched and Downloading, with
 * progress lines and live download progress.
 * FINAL frames: T03d A2 (TV), A3 (Films), C5 (nothing downloading); T03a A3, A4 (Continue watching). Stub until its task
 * builds it; the signature is the one it keeps.
 */
@Suppress("UNUSED_PARAMETER")
@Composable
fun LibraryScreen(kind: LibraryKind, library: LibraryApi, downloads: DownloadsFeed?, onNavigate: (Route) -> Unit) {
    Placeholder(if (kind == LibraryKind.Shows) "TV" else "Films", "T03d A2, A3, C5; T03a A3, A4")
}
