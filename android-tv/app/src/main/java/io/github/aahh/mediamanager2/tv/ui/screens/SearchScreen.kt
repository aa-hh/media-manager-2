package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.runtime.Composable
import io.github.aahh.mediamanager2.tv.api.BrowseApi
import io.github.aahh.mediamanager2.tv.ui.Route

/**
 * Search: the field with the keyboard and voice, results from the library and from Sonarr and Radarr.
 * FINAL frames: T03a A5, T03d C4 (nothing found). Stub until its task builds it; the signature is the one it keeps.
 */
@Suppress("UNUSED_PARAMETER")
@Composable
fun SearchScreen(browse: BrowseApi, onNavigate: (Route) -> Unit) {
    Placeholder("Search", "T03a A5, T03d C4 (nothing found)")
}
