package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.api.ApiResult
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.api.MovieDetail
import io.github.aahh.mediamanager2.tv.downloads.DownloadsFeed
import io.github.aahh.mediamanager2.tv.downloads.DownloadsState
import io.github.aahh.mediamanager2.tv.downloads.buildRows
import io.github.aahh.mediamanager2.tv.downloads.subjectProgress
import io.github.aahh.mediamanager2.tv.ui.Route
import io.github.aahh.mediamanager2.tv.ui.Tokens
import io.github.aahh.mediamanager2.tv.ui.browse.EmptyRails
import io.github.aahh.mediamanager2.tv.ui.components.Backdrop
import io.github.aahh.mediamanager2.tv.ui.components.BackdropScrim
import io.github.aahh.mediamanager2.tv.ui.components.ButtonKind
import io.github.aahh.mediamanager2.tv.ui.components.ContentBlock
import io.github.aahh.mediamanager2.tv.ui.components.ProgressBar
import io.github.aahh.mediamanager2.tv.ui.components.ServerImage
import io.github.aahh.mediamanager2.tv.ui.components.TvButton
import io.github.aahh.mediamanager2.tv.ui.components.TvIcons
import io.github.aahh.mediamanager2.tv.ui.components.TvText
import io.github.aahh.mediamanager2.tv.ui.title.filmFacts
import io.github.aahh.mediamanager2.tv.ui.title.moviePlayLine
import io.github.aahh.mediamanager2.tv.ui.title.playerRouteFor
import io.github.aahh.mediamanager2.tv.ui.title.titleWatched
import kotlinx.coroutines.launch

/**
 * A film's title page: backdrop, facts, Resume or Play, Mark as watched, Monitor and live download progress.
 * FINAL frames: T03a B1, C3 (searching), C6 (grabbed); T03d C2 (nothing found), C3 (search failed).
 * The searching, grabbed, nothing-found and search-failed states are the T18 follow-up.
 */
@Composable
fun FilmScreen(movieId: Int, library: LibraryApi, downloads: DownloadsFeed?, onNavigate: (Route) -> Unit) {
    var detail by remember { mutableStateOf<MovieDetail?>(null) }
    var failed by remember { mutableStateOf(false) }
    var reads by remember { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf<String?>(null) }
    var problem by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(reads) {
        when (val result = library.movie(movieId)) {
            is ApiResult.Ok -> {
                detail = result.value
                failed = false
            }
            is ApiResult.Error, is ApiResult.Failed -> failed = detail == null
        }
    }
    if (downloads != null) {
        DisposableEffect(downloads) {
            downloads.acquire()
            onDispose { downloads.release() }
        }
        LaunchedEffect(downloads) { downloads.watchChanges.collect { reads += 1 } }
    }
    val snapshot = (downloads?.state?.collectAsState()?.value as? DownloadsState.Ready)?.snapshot
    val progress = remember(snapshot) { snapshot?.let { subjectProgress(it, buildRows(it)) } ?: emptyMap() }

    if (failed) {
        EmptyRails("Couldn’t load this film", "Media Manager didn’t answer. Try again in a minute.", action = "Try again", onAction = { reads += 1 })
        return
    }
    val shown = detail
    if (shown == null) {
        Box(Modifier.fillMaxSize().background(Tokens.background))
        return
    }

    val watch = shown.watch?.takeIf { it.kind == "ok" }
    val ratingKey = watch?.ratingKey
    val playLine = if (watch != null && ratingKey != null) moviePlayLine(watch, shown.runtime, shown.file?.quality) else null
    val watched = titleWatched(shown)
    val live = progress["movie:$movieId"]
    val playFocus = remember { FocusRequester() }
    val outlineFocus = remember { FocusRequester() }

    fun runAction(action: String, error: String, call: suspend () -> ApiResult<Unit?>) {
        if (busy != null) return
        busy = action
        problem = null
        scope.launch {
            val result = call()
            busy = null
            when (result) {
                is ApiResult.Ok -> reads += 1
                is ApiResult.Error -> problem = error
                is ApiResult.Failed -> problem = "Can’t reach Media Manager."
            }
        }
    }

    LaunchedEffect(detail != null) { runCatching { (if (playLine != null) playFocus else outlineFocus).requestFocus() } }

    Box(Modifier.fillMaxSize()) {
        Backdrop(BackdropScrim.TitlePage) { ServerImage(shown.backdropUrl, Modifier.fillMaxSize()) }
        Column(Modifier.padding(start = 48.dp, top = 196.dp)) {
            ContentBlock(shown.title, subtitle = filmFacts(shown), description = shown.overview, modifier = Modifier.width(520.dp), descriptionLines = 3)
            Spacer(Modifier.height(36.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (playLine != null && ratingKey != null) {
                    TvButton(
                        playLine.label,
                        onClick = { onNavigate(playerRouteFor("radarr", movieId, ratingKey, playLine.resume)) },
                        modifier = Modifier.focusRequester(playFocus),
                        icon = TvIcons.PlayArrow,
                    )
                }
                val watchedLabel = if (watched) "Mark as unwatched" else "Mark as watched"
                TvButton(
                    if (busy == "watched") "$watchedLabel…" else watchedLabel,
                    onClick = { runAction("watched", "Plex didn’t answer.") { library.setWatched("radarr", movieId, !watched) } },
                    modifier = if (playLine == null) Modifier.focusRequester(outlineFocus) else Modifier,
                    kind = ButtonKind.Outline,
                    icon = TvIcons.Check,
                )
                val monitorLabel = if (shown.monitored) "Stop monitoring" else "Monitor"
                TvButton(
                    if (busy == "monitor") "$monitorLabel…" else monitorLabel,
                    onClick = { runAction("monitor", "Radarr didn’t answer.") { library.monitor("radarr", movieId, !shown.monitored) } },
                    kind = ButtonKind.Outline,
                    icon = if (shown.monitored) TvIcons.Bookmark else TvIcons.BookmarkBorder,
                )
            }
            if (playLine != null) {
                Spacer(Modifier.height(12.dp))
                Text(playLine.line1, style = TvText.pageBody, color = Tokens.mutedForeground)
                playLine.line2?.let { Text(it, style = TvText.pageBody, color = Tokens.mutedForeground) }
            }
            if (live != null) {
                val percent = live.percent ?: 0
                Spacer(Modifier.height(12.dp))
                Text("${live.word.replaceFirstChar { it.uppercase() }} $percent%", style = TvText.episodeStatus, color = Tokens.live)
                Spacer(Modifier.height(6.dp))
                ProgressBar(percent / 100f, Modifier.width(240.dp), color = Tokens.live)
            }
            problem?.let { Text(it, style = TvText.pageBody, color = Tokens.destructive) }
        }
    }
}
