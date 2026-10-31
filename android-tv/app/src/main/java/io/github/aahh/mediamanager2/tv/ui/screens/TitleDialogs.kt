package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.runtime.Composable
import io.github.aahh.mediamanager2.tv.api.LibraryTitle

/**
 * Hold OK on a card: the short action list in a small window (watched, remove from Continue watching, monitor).
 * FINAL frame: T03a C1. Stub until T13b builds it; the signature is the one it keeps.
 */
@Suppress("UNUSED_PARAMETER")
@Composable
fun TitleActionsDialog(title: LibraryTitle, onDismiss: () -> Unit) {
}

/**
 * Add to library: the agreed sentence dialog, Add focused.
 * FINAL frame: T03a C2. Stub until T18 builds it; the signature is the one it keeps.
 */
@Suppress("UNUSED_PARAMETER")
@Composable
fun AddDialog(service: String, externalId: Int, name: String, onAdded: (libraryId: Int) -> Unit, onDismiss: () -> Unit) {
}
