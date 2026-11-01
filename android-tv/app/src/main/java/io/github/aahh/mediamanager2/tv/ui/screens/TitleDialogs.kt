package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.api.AddOptions
import io.github.aahh.mediamanager2.tv.api.ApiResult
import io.github.aahh.mediamanager2.tv.api.BrowseApi
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.api.LibraryTitle
import io.github.aahh.mediamanager2.tv.ui.Tokens
import io.github.aahh.mediamanager2.tv.ui.components.ButtonKind
import io.github.aahh.mediamanager2.tv.ui.components.TvButton
import io.github.aahh.mediamanager2.tv.ui.components.TvDialog
import io.github.aahh.mediamanager2.tv.ui.components.TvText
import io.github.aahh.mediamanager2.tv.ui.title.addProblem
import io.github.aahh.mediamanager2.tv.ui.title.addSentence
import io.github.aahh.mediamanager2.tv.ui.title.defaultMovieChoices
import io.github.aahh.mediamanager2.tv.ui.title.defaultSeriesChoices
import io.github.aahh.mediamanager2.tv.ui.title.nextProfile
import io.github.aahh.mediamanager2.tv.ui.title.optionsProblem
import io.github.aahh.mediamanager2.tv.ui.title.withProfile
import kotlinx.coroutines.async
import kotlinx.coroutines.launch

/**
 * Hold OK on a card: the short action list in a small window (watched, remove from Continue watching, monitor).
 * FINAL frame: T03a C1. Stub until T13b builds it; the signature is the one it keeps.
 */
@Suppress("UNUSED_PARAMETER")
@Composable
fun TitleActionsDialog(title: LibraryTitle, onDismiss: () -> Unit) {
}

/**
 * Add to library: the agreed sentence dialog, Add focused. It adds with the web's defaults; the only choice on the TV is
 * the quality profile, stepped by its button when the service has more than one. A Trakt show card has no TVDB id, so
 * a show without [tvdbId] is looked up by [tmdbId] first. Add is blocked while one is in flight (an add starts real
 * searches), and so are Cancel and Back.
 * FINAL frame: T03a C2.
 */
@Composable
fun AddDialog(
    library: LibraryApi,
    browse: BrowseApi,
    service: String,
    tmdbId: Int,
    tvdbId: Int?,
    name: String,
    onAdded: (libraryId: Int) -> Unit,
    onDismiss: () -> Unit,
) {
    val tv = service == "sonarr"
    val serviceName = if (tv) "Sonarr" else "Radarr"
    val scope = rememberCoroutineScope()
    var options by remember { mutableStateOf<AddOptions?>(null) }
    var showId by remember { mutableStateOf(tvdbId) }
    var profileId by remember { mutableStateOf(0) }
    var loadProblem by remember { mutableStateOf<String?>(null) }
    var addError by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val lookup = async {
            if (tv && tvdbId == null) (library.previewShowByTmdb(tmdbId) as? ApiResult.Ok)?.value?.links?.tvdbId else tvdbId
        }
        val read = browse.addOptions(service)
        val id = lookup.await()
        val problem = if (tv && id == null) "Couldn’t find this show on TheTVDB." else optionsProblem(serviceName, read)
        if (problem != null || read !is ApiResult.Ok) {
            loadProblem = problem
        } else {
            showId = id
            profileId = defaultMovieChoices(read.value).qualityProfileId
            options = read.value
        }
    }

    val ready = options
    val description = when {
        loadProblem != null -> loadProblem
        ready == null -> "Loading…"
        else -> addSentence(
            tv,
            if (tv) defaultSeriesChoices(ready).rootFolderPath else defaultMovieChoices(ready).rootFolderPath,
            ready.qualityProfiles.first { it.id == profileId }.name,
        )
    }
    val add = remember { FocusRequester() }
    val cancel = remember { FocusRequester() }
    TvDialog(
        title = "Add $name to the library?",
        onDismiss = { if (!busy) onDismiss() },
        description = description,
        content = { addError?.let { Text(it, style = TvText.body, color = Tokens.destructive) } },
    ) {
        // Asked from inside the dialog, which composes in its own window after the page.
        LaunchedEffect(loadProblem != null) { runCatching { (if (loadProblem != null) cancel else add).requestFocus() } }
        if (loadProblem == null) {
            TvButton(
                if (busy) "Adding…" else "Add",
                onClick = {
                    if (!busy && ready != null) {
                        busy = true
                        addError = null
                        scope.launch {
                            val result = if (tv) {
                                browse.addSeries(showId!!, withProfile(defaultSeriesChoices(ready), profileId))
                            } else {
                                browse.addMovie(tmdbId, withProfile(defaultMovieChoices(ready), profileId))
                            }
                            val added = (result as? ApiResult.Ok)?.value
                            if (added != null) {
                                onAdded(added.libraryId)
                            } else {
                                addError = addProblem(serviceName, result)
                                busy = false
                            }
                        }
                    }
                },
                modifier = Modifier.focusRequester(add),
            )
        }
        if (ready != null && ready.qualityProfiles.size > 1) {
            TvButton(
                "Profile: ${ready.qualityProfiles.first { it.id == profileId }.name}",
                onClick = { if (!busy) profileId = nextProfile(ready, profileId).id },
                kind = ButtonKind.Outline,
            )
        }
        TvButton("Cancel", onClick = { if (!busy) onDismiss() }, modifier = Modifier.focusRequester(cancel), kind = ButtonKind.Outline)
    }
}
