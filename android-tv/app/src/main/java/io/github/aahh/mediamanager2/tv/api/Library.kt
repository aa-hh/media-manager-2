package io.github.aahh.mediamanager2.tv.api

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

// Field names are copied from src/client/library/api.ts and src/server/watchStatus.ts (the server's source of truth).
// Only the fields the TV screens use are here; unknown fields are ignored, so the server can add more. A TypeScript
// union of `{kind: …}` shapes is one class with every field nullable, read by `kind`.

/** `sonarr` (a show) or `radarr` (a film). */
typealias Service = String

/** Plex watch marks on a library card; null when unmatched or Plex is off. `kind` is `movie` or `show`. */
@Serializable
data class TitleWatch(
    val kind: String,
    val ratingKey: String,
    val viewOffsetMs: Long? = null,
    val durationMs: Long? = null,
    val viewCount: Int = 0,
    val leafCount: Int = 0,
    val viewedLeafCount: Int = 0,
    val lastViewedAt: Long? = null,
)

@Serializable
data class TvCounts(val episodeFileCount: Int, val episodeCount: Int, val totalEpisodeCount: Int, val seasonCount: Int)

@Serializable
data class MovieFlags(val hasFile: Boolean, val isAvailable: Boolean)

/** One card of `GET /api/library/titles`. `type` is `tv` or `movie`. */
@Serializable
data class LibraryTitle(
    val type: String,
    val service: Service,
    val id: Int,
    val title: String,
    val year: Int? = null,
    val added: String? = null,
    val monitored: Boolean = false,
    val posterUrl: String? = null,
    val smallPosterUrl: String? = null,
    val tv: TvCounts? = null,
    val movie: MovieFlags? = null,
    val watch: TitleWatch? = null,
)

@Serializable
data class EpisodeRef(val seasonNumber: Int, val episodeNumber: Int, val title: String? = null)

@Serializable
data class ContinueWatchingItem(
    val service: Service,
    val id: Int,
    val viewOffsetMs: Long? = null,
    val durationMs: Long? = null,
    val lastViewedAt: Long? = null,
    val episode: EpisodeRef? = null,
)

/** A Home "Recently added" card: newest first; a show ranks by its newest episode. */
@Serializable
data class RecentlyAddedItem(val service: Service, val id: Int, val addedAt: Long)

/** `kind` is `ok`, `unavailable` or `off`; the lists are empty unless `ok`. */
@Serializable
data class LibraryWatch(
    val kind: String,
    val machineIdentifier: String? = null,
    val continueWatching: List<ContinueWatchingItem> = emptyList(),
    val recentlyAddedTv: List<RecentlyAddedItem> = emptyList(),
    val recentlyAddedFilms: List<RecentlyAddedItem> = emptyList(),
)

/** `GET /api/library/titles`. */
@Serializable
data class LibraryTitles(val titles: List<LibraryTitle>, val watch: LibraryWatch)

/** A Plex item to play, from a title's detail reply. */
@Serializable
data class Playable(
    val ratingKey: String,
    val mediaIndex: Int = 0,
    val partId: Long = 0,
    val viewOffsetMs: Long? = null,
    val durationMs: Long? = null,
    val viewCount: Int = 0,
    val lastViewedAt: Long? = null,
)

/** A show's Plex marks: `kind` `ok`, `unavailable` or `off`; the whole value is null when Plex has no match. `episodes` is keyed by Sonarr episode id. */
@Serializable
data class SeriesWatch(
    val kind: String,
    val machineIdentifier: String? = null,
    val ratingKey: String? = null,
    val leafCount: Int = 0,
    val viewedLeafCount: Int = 0,
    val nextEpisode: EpisodeRef? = null,
    val episodes: Map<String, Playable> = emptyMap(),
)

/** A film's Plex item: `kind` `ok` (with the [Playable] fields), `unavailable` or `off`; null when Plex has no match. */
@Serializable
data class MovieWatch(
    val kind: String,
    val machineIdentifier: String? = null,
    val ratingKey: String? = null,
    val mediaIndex: Int = 0,
    val partId: Long = 0,
    val viewOffsetMs: Long? = null,
    val durationMs: Long? = null,
    val viewCount: Int = 0,
    val lastViewedAt: Long? = null,
)

@Serializable
data class FileSummary(val size: Long = 0, val quality: String? = null)

@Serializable
data class EpisodeDetail(
    val id: Int,
    val seasonNumber: Int,
    val episodeNumber: Int,
    val title: String,
    val airDate: String? = null,
    val monitored: Boolean = false,
    val hasFile: Boolean = false,
    val overview: String? = null,
    val runtime: Int? = null,
    val imageUrl: String? = null,
    val file: FileSummary? = null,
)

@Serializable
data class SeasonStatistics(val episodeFileCount: Int = 0, val episodeCount: Int = 0, val totalEpisodeCount: Int = 0, val sizeOnDisk: Long = 0)

@Serializable
data class Season(val seasonNumber: Int, val monitored: Boolean = false, val posterUrl: String? = null, val statistics: SeasonStatistics = SeasonStatistics())

/** A title's ids on IMDb, TheTVDB and TMDB. */
@Serializable
data class TitleLinks(val imdbId: String? = null, val tvdbId: Int? = null, val tmdbId: Int? = null)

/** `GET /api/library/series/:id`. */
@Serializable
data class SeriesDetail(
    val id: Int,
    val title: String,
    val year: Int? = null,
    val status: String? = null,
    val overview: String? = null,
    val network: String? = null,
    val posterUrl: String? = null,
    val backdropUrl: String? = null,
    val rating: Double? = null,
    val certification: String? = null,
    val genres: List<String> = emptyList(),
    val runtime: Int? = null,
    val monitored: Boolean = false,
    val seasons: List<Season> = emptyList(),
    val episodes: List<EpisodeDetail> = emptyList(),
    val watch: SeriesWatch? = null,
    val links: TitleLinks? = null,
)

/** `GET /api/library/movie/:id`. */
@Serializable
data class MovieDetail(
    val id: Int,
    val title: String,
    val year: Int? = null,
    val status: String? = null,
    val overview: String? = null,
    val posterUrl: String? = null,
    val backdropUrl: String? = null,
    val rating: Double? = null,
    val certification: String? = null,
    val genres: List<String> = emptyList(),
    val runtime: Int? = null,
    val monitored: Boolean = false,
    val hasFile: Boolean = false,
    val isAvailable: Boolean = false,
    val sizeOnDisk: Long = 0,
    val file: FileSummary? = null,
    val watch: MovieWatch? = null,
)

/** One of the signed-in Plex user's video lists. */
@Serializable
data class Playlist(val id: String, val title: String, val smart: Boolean = false, val itemCount: Int = 0)

/** `GET /api/library/playlists`: `kind` `ok`, `off` or `unavailable`. */
@Serializable
data class Playlists(val kind: String, val playlists: List<Playlist> = emptyList())

@Serializable
data class PlaylistItem(val service: Service, val id: Int, val episode: EpisodeRef? = null)

/** `GET /api/library/playlists/:id`: `kind` `ok`, `off` or `unavailable`; 404 `not_found` for an unknown list. */
@Serializable
data class PlaylistItems(val kind: String, val title: String? = null, val items: List<PlaylistItem> = emptyList())

@Serializable
private data class WatchedBody(val watched: Boolean)

// The title bodies `POST /api/library/monitor` takes (`parseTarget` in src/server/library.ts): exactly these keys, so the
// defaults must be sent. The season and episode bodies come with the title pages that need them.
@Serializable
private data class MonitorSeries(val seriesId: Int, val monitored: Boolean, val service: String = "sonarr", val kind: String = "series")

@Serializable
private data class MonitorMovie(val movieId: Int, val monitored: Boolean, val service: String = "radarr", val kind: String = "movie")

/** The library routes the TV's Home, TV, Films, title pages and list pages read. */
class LibraryApi(private val client: ServerClient) {
    suspend fun titles(): ApiResult<LibraryTitles> = client.get("/api/library/titles", LibraryTitles.serializer())

    suspend fun series(id: Int): ApiResult<SeriesDetail> = client.get("/api/library/series/$id", SeriesDetail.serializer())

    suspend fun movie(id: Int): ApiResult<MovieDetail> = client.get("/api/library/movie/$id", MovieDetail.serializer())

    /** A show not in the library, looked up by its TMDB id; its `links.tvdbId` is what adding it needs. */
    suspend fun previewShowByTmdb(tmdbId: Int): ApiResult<SeriesDetail> {
        require(tmdbId > 0) { "not a TMDB id" }
        return client.get("/api/library/preview/sonarr/tmdb/$tmdbId", SeriesDetail.serializer())
    }

    suspend fun playlists(): ApiResult<Playlists> = client.get("/api/library/playlists", Playlists.serializer())

    suspend fun playlist(id: String): ApiResult<PlaylistItems> {
        require(PLAYLIST_ID.matches(id)) { "not a Plex list id" }
        return client.get("/api/library/playlists/$id", PlaylistItems.serializer())
    }

    /** The list's collage, for the image loader; 404 when it has none. */
    fun playlistCollage(id: String) = client.url("/api/images/plex/playlist/$id")

    /** Mark watched or unwatched in Plex (T23). 204 on success. */
    suspend fun setWatched(service: Service, id: Int, watched: Boolean): ApiResult<Unit?> =
        client.post<Unit>("/api/library/${checked(service)}/$id/watched", client.json.encodeToString(WatchedBody(watched)), null)

    /** Remove from Continue Watching (T23). 204, or 404 `not_found` when it is not in the row. */
    suspend fun removeFromContinueWatching(service: Service, id: Int): ApiResult<Unit?> =
        client.post<Unit>("/api/library/${checked(service)}/$id/continue-watching/remove", "{}", null)

    /** Monitor or stop monitoring a whole show or film, by its Sonarr or Radarr id. 204 on success. */
    suspend fun monitor(service: Service, id: Int, monitored: Boolean): ApiResult<Unit?> {
        val body = when (checked(service)) {
            "sonarr" -> client.json.encodeToString(MonitorSeries(id, monitored))
            else -> client.json.encodeToString(MonitorMovie(id, monitored))
        }
        return client.post<Unit>("/api/library/monitor", body, null)
    }

    private fun checked(service: Service) = service.also { require(it == "sonarr" || it == "radarr") { "unknown service $it" } }

    private companion object {
        val PLAYLIST_ID = Regex("^\\d{1,12}$")
    }
}
