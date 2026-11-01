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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import io.github.aahh.mediamanager2.tv.api.SeriesDetail
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
import io.github.aahh.mediamanager2.tv.ui.components.EpisodeRow
import io.github.aahh.mediamanager2.tv.ui.components.ServerImage
import io.github.aahh.mediamanager2.tv.ui.components.TabRow
import io.github.aahh.mediamanager2.tv.ui.components.TvButton
import io.github.aahh.mediamanager2.tv.ui.components.TvIcons
import io.github.aahh.mediamanager2.tv.ui.components.TvText
import io.github.aahh.mediamanager2.tv.ui.title.episodeLine
import io.github.aahh.mediamanager2.tv.ui.title.episodeStatus
import io.github.aahh.mediamanager2.tv.ui.title.episodeWatchProgress
import io.github.aahh.mediamanager2.tv.ui.title.initialSeason
import io.github.aahh.mediamanager2.tv.ui.title.nextEpisode
import io.github.aahh.mediamanager2.tv.ui.title.playableEpisode
import io.github.aahh.mediamanager2.tv.ui.title.playerRouteFor
import io.github.aahh.mediamanager2.tv.ui.title.seasonTabs
import io.github.aahh.mediamanager2.tv.ui.title.seriesPlayLine
import io.github.aahh.mediamanager2.tv.ui.title.showFacts
import io.github.aahh.mediamanager2.tv.ui.title.stoppedPartway
import io.github.aahh.mediamanager2.tv.ui.title.titleWatched
import java.time.LocalDate
import kotlinx.coroutines.launch

/**
 * A show's title page: details, Play or Resume, Mark as watched and Monitor on the left; season tabs and the episode list
 * on the right, with live download progress per episode. OK on an episode Plex can play plays it.
 * FINAL frames: T03a B2, B3 (downloading).
 */
@Composable
fun ShowScreen(seriesId: Int, library: LibraryApi, downloads: DownloadsFeed?, onNavigate: (Route) -> Unit) {
    var detail by remember { mutableStateOf<SeriesDetail?>(null) }
    var failed by remember { mutableStateOf(false) }
    var reads by remember { mutableIntStateOf(0) }
    var selectedSeason by remember { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf<String?>(null) }
    var problem by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(reads) {
        when (val result = library.series(seriesId)) {
            is ApiResult.Ok -> {
                val value = result.value
                if (detail == null) selectedSeason = initialSeason(seasonTabs(value.seasons), nextEpisode(value.episodes, value.watch))
                detail = value
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
        EmptyRails("Couldn’t load episodes", "Media Manager didn’t answer. Try again in a minute.", action = "Try again", onAction = { reads += 1 })
        return
    }
    val shown = detail
    if (shown == null) {
        Box(Modifier.fillMaxSize().background(Tokens.background))
        return
    }

    val tabs = seasonTabs(shown.seasons)
    val next = nextEpisode(shown.episodes, shown.watch)
    val nextPlayable = next?.let { playableEpisode(it, shown.watch) }
    val playLine = if (next != null && nextPlayable != null) seriesPlayLine(next, nextPlayable) else null
    val watched = titleWatched(shown)
    val season = tabs.getOrNull(selectedSeason)?.seasonNumber
    val episodes = shown.episodes.filter { it.seasonNumber == season }.sortedBy { it.episodeNumber }
    val today = LocalDate.now()
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
        Backdrop(BackdropScrim.Episodes) { ServerImage(shown.backdropUrl, Modifier.fillMaxSize()) }
        Row(Modifier.fillMaxSize()) {
            Column(Modifier.padding(start = 48.dp, top = 40.dp).width(300.dp)) {
                ContentBlock(shown.title, subtitle = showFacts(shown), description = shown.overview, descriptionLines = 3)
                Spacer(Modifier.height(24.dp))
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (playLine != null && nextPlayable != null) {
                        TvButton(
                            playLine.label,
                            onClick = { onNavigate(playerRouteFor("sonarr", seriesId, nextPlayable.ratingKey, playLine.resume)) },
                            modifier = Modifier.focusRequester(playFocus),
                            icon = TvIcons.PlayArrow,
                        )
                    }
                    val watchedLabel = if (watched) "Mark as unwatched" else "Mark as watched"
                    TvButton(
                        if (busy == "watched") "$watchedLabel…" else watchedLabel,
                        onClick = { runAction("watched", "Plex didn’t answer.") { library.setWatched("sonarr", seriesId, !watched) } },
                        modifier = if (playLine == null) Modifier.focusRequester(outlineFocus) else Modifier,
                        kind = ButtonKind.Outline,
                        icon = TvIcons.Check,
                    )
                    val monitorLabel = if (shown.monitored) "Stop monitoring" else "Monitor"
                    TvButton(
                        if (busy == "monitor") "$monitorLabel…" else monitorLabel,
                        onClick = { runAction("monitor", "Sonarr didn’t answer.") { library.monitor("sonarr", seriesId, !shown.monitored) } },
                        kind = ButtonKind.Outline,
                        icon = if (shown.monitored) TvIcons.Bookmark else TvIcons.BookmarkBorder,
                    )
                }
                if (playLine != null) {
                    Spacer(Modifier.height(12.dp))
                    Text(playLine.line1, style = TvText.pageBody, color = Tokens.mutedForeground)
                    playLine.line2?.let { Text(it, style = TvText.pageBody, color = Tokens.mutedForeground) }
                }
                problem?.let { Text(it, style = TvText.pageBody, color = Tokens.destructive) }
            }
            Column(Modifier.padding(start = 32.dp, top = 34.dp).width(520.dp)) {
                TabRow(tabs.map { it.label }, selectedSeason, onSelect = { selectedSeason = it })
                Spacer(Modifier.height(15.dp))
                LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(episodes, key = { it.id }) { episode ->
                        val playable = playableEpisode(episode, shown.watch)
                        EpisodeRow(
                            title = "${episode.episodeNumber}. ${episode.title}",
                            line = episodeLine(episode),
                            status = episodeStatus(episode, playable, progress["episode:${episode.id}"], today),
                            monitored = episode.monitored,
                            onClick = {
                                if (playable != null) {
                                    onNavigate(playerRouteFor("sonarr", seriesId, playable.ratingKey, stoppedPartway(playable.viewOffsetMs, playable.durationMs)))
                                }
                            },
                            watchProgress = episodeWatchProgress(playable),
                            still = { ServerImage(episode.imageUrl, Modifier.fillMaxSize()) },
                        )
                    }
                }
            }
        }
    }
}
