package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.runtime.Composable
import io.github.aahh.mediamanager2.tv.api.BrowseApi
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.ui.Route

/**
 * Home, where the app opens: Plex rails, then Trakt rails; the top backdrop follows the focused card.
 * FINAL frames: T03d A1, T03a A6 (rails scrolled), T03a A2 and T03d C6 (the side menu, in Navigation.kt). Stub until its task builds it; the signature is the one it keeps.
 */
@Suppress("UNUSED_PARAMETER")
@Composable
fun HomeScreen(library: LibraryApi, browse: BrowseApi, onNavigate: (Route) -> Unit) {
    Placeholder("Home", "T03d A1, T03a A6 (rails scrolled), T03a A2 and T03d C6 (the side menu, in Navigation.kt)")
}
