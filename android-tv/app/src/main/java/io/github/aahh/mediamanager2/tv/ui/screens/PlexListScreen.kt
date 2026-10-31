package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.runtime.Composable
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.ui.Route

/**
 * A Plex list: its name, Play all and Shuffle, then its items.
 * FINAL frames: T03d A4. Stub until its task builds it; the signature is the one it keeps.
 */
@Suppress("UNUSED_PARAMETER")
@Composable
fun PlexListScreen(id: String, title: String, library: LibraryApi, onNavigate: (Route) -> Unit) {
    Placeholder("$title", "T03d A4")
}
