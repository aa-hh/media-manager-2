package io.github.aahh.mediamanager2.tv.ui.title

import io.github.aahh.mediamanager2.tv.api.AddOptions
import io.github.aahh.mediamanager2.tv.api.Added
import io.github.aahh.mediamanager2.tv.api.ApiResult
import io.github.aahh.mediamanager2.tv.api.LastChoice
import io.github.aahh.mediamanager2.tv.api.QualityProfile
import io.github.aahh.mediamanager2.tv.api.RootFolder
import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

private val hd = QualityProfile(1, "HD-1080p")
private val uhd = QualityProfile(2, "Ultra-HD")
private val options = AddOptions(listOf(hd, uhd), listOf(RootFolder("/tv"), RootFolder("/tv2")))

class AddModelTest {
    // The add keeps the last add's profile and folder only while the service still lists them; ignoring lastChoice, or
    // sending a profile or folder the service no longer has, turns this red.
    @Test
    fun defaultsTakeTheLastChoiceWhenStillListed() {
        val remembered = options.copy(lastChoice = LastChoice(2, "/tv2"))
        assertEquals(2, defaultSeriesChoices(remembered).qualityProfileId)
        assertEquals("/tv2", defaultMovieChoices(remembered).rootFolderPath)
        val stale = options.copy(lastChoice = LastChoice(9, "/gone"))
        assertEquals(1, defaultSeriesChoices(stale).qualityProfileId)
        assertEquals("/tv", defaultMovieChoices(stale).rootFolderPath)
        assertEquals("all", defaultSeriesChoices(options).monitor)
        assertEquals("movieOnly", defaultMovieChoices(options).monitor)
    }

    // OK on the profile button steps through every profile and back to the first; stopping at the last turns this red.
    @Test
    fun nextProfileWraps() {
        assertEquals(uhd, nextProfile(options, 1))
        assertEquals(hd, nextProfile(options, 2))
    }

    // Each failure code gets the web's words, and a 409 shows Sonarr or Radarr's own reason; swapping a code's words,
    // or hiding the reason behind the fallback, turns this red.
    @Test
    fun problemsAreWordedPerCode() {
        assertNull(optionsProblem("Sonarr", ApiResult.Ok(200, options)))
        assertEquals("Sonarr has no quality profile. Create one in Sonarr to add shows.", optionsProblem("Sonarr", ApiResult.Ok(200, options.copy(qualityProfiles = emptyList()))))
        assertEquals("Radarr has no root folder. Add one in Radarr to add movies.", optionsProblem("Radarr", ApiResult.Ok(200, options.copy(rootFolders = emptyList()))))
        assertEquals("Sonarr isn’t connected. Add it in Settings.", optionsProblem("Sonarr", ApiResult.Error(503, "not_configured")))
        assertEquals("Couldn’t load Sonarr’s quality profiles and root folders.", optionsProblem("Sonarr", ApiResult.Failed(IOException())))

        assertNull(addProblem("Radarr", ApiResult.Ok(201, Added(5))))
        assertEquals("Already in Radarr.", addProblem("Radarr", ApiResult.Error(409, "refused", "Already in Radarr.")))
        assertEquals("Radarr didn’t add it.", addProblem("Radarr", ApiResult.Error(409, "refused")))
        assertEquals("Sonarr refused the API key. Check the key in Settings.", addProblem("Sonarr", ApiResult.Error(502, "rejected")))
        assertEquals("Sonarr didn’t answer. Check it’s running, then try again.", addProblem("Sonarr", ApiResult.Error(502, "unreachable")))
        assertEquals("Can’t reach Media Manager.", addProblem("Sonarr", ApiResult.Failed(IOException())))
    }
}
