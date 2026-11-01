package io.github.aahh.mediamanager2.tv.ui.title

import io.github.aahh.mediamanager2.tv.api.AddOptions
import io.github.aahh.mediamanager2.tv.api.Added
import io.github.aahh.mediamanager2.tv.api.ApiResult
import io.github.aahh.mediamanager2.tv.api.MovieChoices
import io.github.aahh.mediamanager2.tv.api.QualityProfile
import io.github.aahh.mediamanager2.tv.api.SeriesChoices

// The add dialog's rules, copied from the web's add sentence (src/client/title/AddControls.tsx). The TV keeps the web's
// defaults and lets the owner change only the quality profile.

/** The last add's profile when the service still has it, else its first. Needs at least one profile. */
private fun defaultProfile(options: AddOptions): Int =
    options.qualityProfiles.firstOrNull { it.id == options.lastChoice?.qualityProfileId }?.id ?: options.qualityProfiles.first().id

/** The last add's root folder when the service still has it, else its first. Needs at least one folder. */
private fun defaultFolder(options: AddOptions): String =
    options.rootFolders.firstOrNull { it.path == options.lastChoice?.rootFolderPath }?.path ?: options.rootFolders.first().path

fun defaultSeriesChoices(options: AddOptions): SeriesChoices = SeriesChoices(
    monitor = "all",
    monitorNewSeasons = true,
    qualityProfileId = defaultProfile(options),
    rootFolderPath = defaultFolder(options),
    seasonFolder = true,
    seriesType = "standard",
)

fun defaultMovieChoices(options: AddOptions): MovieChoices = MovieChoices(
    monitor = "movieOnly",
    minimumAvailability = "released",
    qualityProfileId = defaultProfile(options),
    rootFolderPath = defaultFolder(options),
)

fun withProfile(choices: SeriesChoices, profileId: Int): SeriesChoices = choices.copy(qualityProfileId = profileId)

fun withProfile(choices: MovieChoices, profileId: Int): MovieChoices = choices.copy(qualityProfileId = profileId)

/** The profile after [currentId], wrapping to the first; the first when [currentId] is not listed. */
fun nextProfile(options: AddOptions, currentId: Int): QualityProfile {
    val profiles = options.qualityProfiles
    val index = profiles.indexOfFirst { it.id == currentId }
    return profiles[(index + 1) % profiles.size]
}

fun addSentence(tv: Boolean, folder: String, profile: String): String =
    if (tv) {
        "Monitor all episodes. Save to $folder using profile $profile."
    } else {
        "Monitor just the movie once it’s available. Save to $folder using profile $profile."
    }

/** The web's words for a Sonarr or Radarr failure code, or [fallback] for any other. */
private fun failureMessage(serviceName: String, code: String?, fallback: String): String = when (code) {
    "not_configured" -> "$serviceName isn’t connected. Add it in Settings."
    "rejected" -> "$serviceName refused the API key. Check the key in Settings."
    "unreachable" -> "$serviceName didn’t answer. Check it’s running, then try again."
    "not_found" -> if (serviceName == "Sonarr") "Sonarr can’t find this show on TheTVDB." else "Radarr can’t find this movie on TMDB."
    else -> fallback
}

/** Why the dialog cannot offer an add yet ([serviceName] is `Sonarr` or `Radarr`), or null when it can. */
fun optionsProblem(serviceName: String, result: ApiResult<AddOptions>): String? {
    val kinds = if (serviceName == "Sonarr") "shows" else "movies"
    val loadFailed = "Couldn’t load $serviceName’s quality profiles and root folders."
    return when (result) {
        is ApiResult.Ok -> when {
            result.value.qualityProfiles.isEmpty() -> "$serviceName has no quality profile. Create one in $serviceName to add $kinds."
            result.value.rootFolders.isEmpty() -> "$serviceName has no root folder. Add one in $serviceName to add $kinds."
            else -> null
        }
        is ApiResult.Error -> failureMessage(serviceName, result.code, loadFailed)
        is ApiResult.Failed -> loadFailed
    }
}

/** Why an add did not go through, or null when it did (201). A 409 shows Sonarr or Radarr's own reason. */
fun addProblem(serviceName: String, result: ApiResult<Added?>): String? {
    val fallback = "$serviceName didn’t add it."
    return when (result) {
        is ApiResult.Ok -> if (result.status == 201 && result.value != null) null else fallback
        is ApiResult.Error -> if (result.status == 409) result.reason ?: fallback else failureMessage(serviceName, result.code, fallback)
        is ApiResult.Failed -> "Can’t reach Media Manager."
    }
}
