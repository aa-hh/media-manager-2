package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import io.github.aahh.mediamanager2.tv.ui.Fonts

// The text styles the FINAL TV frames use, by size/line height in sp (the frames are drawn at 960 × 540, one px per dp).

private fun ui(weight: FontWeight, size: Int, line: Int? = null, tracking: Double = 0.0) = TextStyle(
    fontFamily = Fonts.ui,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = line?.sp ?: TextUnit.Unspecified,
    letterSpacing = tracking.sp,
)

internal object TvText {
    val label = ui(FontWeight.SemiBold, 16, 20, 0.1)
    val labelMedium = ui(FontWeight.Medium, 16, 20, 0.1)
    val outlineLabel = ui(FontWeight.Medium, 15, 20, 0.1)
    val nav = ui(FontWeight.Medium, 16, 24, 0.15)
    val cardTitle = ui(FontWeight.Medium, 16, 24, 0.15)
    val cardSubtitle = ui(FontWeight.Normal, 12, 16, 0.2)
    val panelTitle = ui(FontWeight.Bold, 18, 22)
    val actionHeading = ui(FontWeight.Bold, 16, 20)
    val menuDetail = ui(FontWeight.Normal, 12, 15)
    val overline = ui(FontWeight.Normal, 14, 16, 0.25)
    val hero = ui(FontWeight.Bold, 36, 40)
    val pageTitle = ui(FontWeight.Bold, 40, 44)
    val dialogTitle = ui(FontWeight.Bold, 28, 36)
    val body = ui(FontWeight.Normal, 16, 24, 0.25)
    val pageBody = ui(FontWeight.Normal, 15, 24)
    val fieldLabel = ui(FontWeight.SemiBold, 15, 20, 0.1)
    val fieldInput = ui(FontWeight.Normal, 18, 24, 0.15)
    val supporting = ui(FontWeight.Normal, 14, 16, 0.2)
    val episodeTitle = ui(FontWeight.SemiBold, 17, 21)
    val episodeLine = ui(FontWeight.Normal, 13, 16)
    val episodeStatus = ui(FontWeight.Medium, 13, 16)
    val listOverline = ui(FontWeight.SemiBold, 13, 16, 0.1)
    val listTitle = ui(FontWeight.Medium, 16, 24, 0.15)
    val listSubtitle = ui(FontWeight.Normal, 13, 16, 0.2)
    val badge = ui(FontWeight.Medium, 12, 16, 0.1)
    val time = ui(FontWeight.Medium, 16, 20)

    /** Barlow Semi Condensed 600, for counts and percentages. */
    fun number(size: Int) = TextStyle(fontFamily = Fonts.data, fontWeight = FontWeight.SemiBold, fontSize = size.sp, lineHeight = 16.sp)
}
