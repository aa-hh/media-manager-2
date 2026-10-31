package io.github.aahh.mediamanager2.tv.api

import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerializationException
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import okhttp3.Request

// Field names are copied from src/client/discover/model.ts (src/server/discover/rows.ts), src/client/Search.tsx
// (src/server/search.ts) and src/server/add.ts.

/** A Discover or search card from TMDB. `type` is `movie` or `tv`; [libraryId] is set when it is already in the library. */
@Serializable
data class DiscoverResult(
    val tmdbId: Int,
    val type: String,
    val title: String,
    val year: Int? = null,
    val date: String? = null,
    val posterUrl: String? = null,
    val backdropUrl: String? = null,
    val rating: Double? = null,
    val genres: List<String> = emptyList(),
    val overview: String? = null,
    val libraryId: Int? = null,
)

/** One Discover row. [pending] means it is still being built; [failed] only when the build failed and nothing is saved. */
@Serializable
data class DiscoverRow(
    val results: List<DiscoverResult> = emptyList(),
    val pending: Boolean = false,
    val failed: Boolean = false,
    val failure: String? = null,
    val providerId: Int? = null,
    val name: String? = null,
    val id: String? = null,
    val label: String? = null,
)

@Serializable
data class TrendingRows(val all: DiscoverRow = DiscoverRow(), val movie: DiscoverRow = DiscoverRow(), val tv: DiscoverRow = DiscoverRow())

@Serializable
data class UpcomingMovies(val days30: DiscoverRow? = null, val days90: DiscoverRow? = null)

/** `GET /api/discover/home`. Rows the chosen type hides are null. */
@Serializable
data class DiscoverHome(
    val trending: TrendingRows = TrendingRows(),
    val popularMovies: DiscoverRow? = null,
    val popularTv: DiscoverRow? = null,
    val upcomingMovies: UpcomingMovies? = null,
    val upcomingTv: DiscoverRow? = null,
    val services: List<DiscoverRow> = emptyList(),
    val extraRows: List<DiscoverRow> = emptyList(),
)

/** `GET /api/discover/:type`: one page of a grid. */
@Serializable
data class DiscoverPage(val page: Int, val totalPages: Int, val results: List<DiscoverResult> = emptyList(), val pending: Boolean = false)

/** A search hit from Sonarr or Radarr's lookup. `key` is stable across the streamed answers. */
@Serializable
data class SearchResult(
    val type: String,
    val service: Service,
    val key: String,
    val title: String,
    val year: Int? = null,
    val network: String? = null,
    val status: String? = null,
    val rating: Double? = null,
    val overview: String? = null,
    val posterUrl: String? = null,
    val inLibrary: Boolean = false,
    val libraryId: Int? = null,
    val files: Int? = null,
    val tvdbId: Int? = null,
    val tmdbId: Int? = null,
    val imdbId: String? = null,
)

/** `kind` is `ok`, `pending`, `skipped`, `not_configured`, `unreachable` or `rejected`. */
@Serializable
data class SearchOutcome(val kind: String, val count: Int = 0)

@Serializable
data class SearchServices(val sonarr: SearchOutcome, val radarr: SearchOutcome)

/** One line of `GET /api/search`; the last line has no service `pending`. */
@Serializable
data class SearchAnswer(val results: List<SearchResult> = emptyList(), val services: SearchServices) {
    val complete: Boolean get() = services.sonarr.kind != "pending" && services.radarr.kind != "pending"
}

@Serializable
data class QualityProfile(val id: Int, val name: String)

@Serializable
data class RootFolder(val path: String, val freeSpace: Long? = null)

@Serializable
data class LastChoice(val qualityProfileId: Int, val rootFolderPath: String)

/** `GET /api/add/options/:service`. */
@Serializable
data class AddOptions(val qualityProfiles: List<QualityProfile> = emptyList(), val rootFolders: List<RootFolder> = emptyList(), val lastChoice: LastChoice? = null)

/**
 * A show's add choices. `monitor` is `all`, `future`, `lastSeason`, `skip` (only the listed [seasons]) or `none`;
 * `seriesType` is `standard`, `daily` or `anime`.
 */
@Serializable
data class SeriesChoices(
    val monitor: String,
    val monitorNewSeasons: Boolean,
    val qualityProfileId: Int,
    val rootFolderPath: String,
    val seasonFolder: Boolean,
    val seriesType: String,
    val seasons: List<Int>? = null,
) {
    init {
        require(monitor in SERIES_MONITOR) { "unknown monitor $monitor" }
        require(seriesType in SERIES_TYPES) { "unknown series type $seriesType" }
        require((monitor == "skip") == (seasons != null)) { "seasons go only with skip" }
        require(seasons == null || seasons.size in 1..200 && seasons.toSet().size == seasons.size && seasons.all { it in 0..999 }) { "bad seasons" }
    }

    private companion object {
        val SERIES_MONITOR = setOf("all", "future", "lastSeason", "skip", "none")
        val SERIES_TYPES = setOf("standard", "daily", "anime")
    }
}

/** A film's add choices. `monitor` is `movieOnly`, `movieAndCollection` or `none`; `minimumAvailability` `announced`, `inCinemas` or `released`. */
@Serializable
data class MovieChoices(val monitor: String, val minimumAvailability: String, val qualityProfileId: Int, val rootFolderPath: String) {
    init {
        require(monitor in setOf("movieOnly", "movieAndCollection", "none")) { "unknown monitor $monitor" }
        require(minimumAvailability in setOf("announced", "inCinemas", "released")) { "unknown availability $minimumAvailability" }
    }
}

/** `POST /api/add` 201. A 409 `refused` carries Sonarr or Radarr's reason in [ApiResult.Error.reason]. */
@Serializable
data class Added(val libraryId: Int)

@Serializable
private data class AddSeriesBody(val service: String, val id: Int, val choices: SeriesChoices)

@Serializable
private data class AddMovieBody(val service: String, val id: Int, val choices: MovieChoices)

/** Discover, Search and Add. */
class BrowseApi(private val client: ServerClient) {
    /** `type` is `all`, `movie` or `tv`. */
    suspend fun discoverHome(type: String = "all"): ApiResult<DiscoverHome> {
        require(type in setOf("all", "movie", "tv")) { "unknown type $type" }
        return client.get(if (type == "all") "/api/discover/home" else "/api/discover/home?type=$type", DiscoverHome.serializer())
    }

    /** `type` is `movie` or `tv`; `sort` `popular`, `rating`, `newest` or `upcoming`; `page` 1–500. */
    suspend fun discover(type: String, sort: String = "popular", page: Int = 1): ApiResult<DiscoverPage> {
        require(type == "movie" || type == "tv") { "unknown type $type" }
        require(sort in setOf("popular", "rating", "newest", "upcoming")) { "unknown sort $sort" }
        require(page in 1..500) { "page out of range" }
        return client.get("/api/discover/$type?sort=$sort&page=$page", DiscoverPage.serializer())
    }

    /**
     * Searches Sonarr and Radarr. The server sends a line as soon as one service has results and a last one once both
     * have; [onAnswer] gets each (on a background thread). The result is the last answer, or Failed when the reply
     * ends while a service is still pending.
     */
    suspend fun search(query: String, onAnswer: (SearchAnswer) -> Unit = {}): ApiResult<SearchAnswer> {
        val term = query.trim().replace(WHITESPACE, " ")
        require(term.isNotEmpty() && term.length <= MAX_QUERY_LENGTH) { "query empty or longer than $MAX_QUERY_LENGTH" }
        val url = client.url("/api/search").newBuilder().addQueryParameter("q", term).build()
        return withContext(Dispatchers.IO) {
            try {
                client.http.newCall(Request.Builder().url(url).build()).execute().use { response ->
                    if (!response.isSuccessful) return@withContext ApiResult.Error(response.code, null)
                    val source = response.body.source()
                    var last: SearchAnswer? = null
                    while (true) {
                        val line = source.readUtf8Line() ?: break
                        if (line.isBlank()) continue
                        last = client.json.decodeFromString(SearchAnswer.serializer(), line).also(onAnswer)
                    }
                    if (last == null || !last.complete) ApiResult.Failed(IOException("search ended early")) else ApiResult.Ok(response.code, last)
                }
            } catch (error: IOException) {
                ApiResult.Failed(error)
            } catch (error: SerializationException) {
                ApiResult.Failed(IOException("unreadable search answer", error))
            } catch (error: IllegalArgumentException) {
                ApiResult.Failed(IOException("unreadable search answer", error))
            }
        }
    }

    /** `service` is `sonarr` or `radarr`. */
    suspend fun addOptions(service: Service): ApiResult<AddOptions> {
        require(service == "sonarr" || service == "radarr") { "unknown service $service" }
        return client.get("/api/add/options/$service", AddOptions.serializer())
    }

    /** Adds a show by its TVDB id. */
    suspend fun addSeries(tvdbId: Int, choices: SeriesChoices): ApiResult<Added?> =
        client.post("/api/add", client.json.encodeToString(AddSeriesBody("sonarr", tvdbId, choices)), Added.serializer())

    /** Adds a film by its TMDB id. */
    suspend fun addMovie(tmdbId: Int, choices: MovieChoices): ApiResult<Added?> =
        client.post("/api/add", client.json.encodeToString(AddMovieBody("radarr", tmdbId, choices)), Added.serializer())

    companion object {
        /** The limit `/api/search` checks (src/server/search.ts). */
        const val MAX_QUERY_LENGTH = 200
        private val WHITESPACE = Regex("\\s+")
    }
}
