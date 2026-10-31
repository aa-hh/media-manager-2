package io.github.aahh.mediamanager2.tv.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Typography
import androidx.tv.material3.darkColorScheme
import io.github.aahh.mediamanager2.tv.R

/**
 * Every dark colour token from `src/client/globals.css` (`:root[data-theme="dark"]`), under the same names in camelCase,
 * so the TV and the desktop share one palette. The TV is dark only. Copied, not generated: a token changed on the
 * desktop is changed here too.
 */
object Tokens {
    val background = Color(0xFF0C0F14)
    val card = Color(0xFF12161C)
    val cardForeground = Color(0xFFEBEEF3)
    val popover = Color(0xFF1E2430)
    val popoverForeground = Color(0xFFEBEEF3)
    val muted = Color(0xFF171C24)
    val secondary = Color(0xFF171C24)
    val secondaryForeground = Color(0xFFEBEEF3)
    val accent = Color(0xFF191E26)
    val accentForeground = Color(0xFFEBEEF3)
    val surfaceHover = Color(0x0AFFFFFF)
    val surfacePressed = Color(0x1AFFFFFF)
    val selected = Color(0x12FFFFFF)
    val foreground = Color(0xFFEBEEF3)
    val mutedForeground = Color(0xFFAAB3C1)
    val subtleForeground = Color(0xFF959EAC)
    val faintForeground = Color(0xFF4B5361)
    val border = Color(0xFF262C36)
    val input = Color(0xFF6A7486)
    val primary = Color(0xFFEBEEF3)
    val primaryHover = Color(0xFFCDD4DE)
    val primaryPressed = Color(0xFFFFFFFF)
    val primaryForeground = Color(0xFF0C0F14)
    val action = Color(0xFF9ECAE1)
    val actionHover = Color(0xFFB3D7EA)
    val actionPressed = Color(0xFF8BBFDB)
    val actionForeground = Color(0xFF07080B)
    val plex = Color(0xFFE5A00D)
    val plexHover = Color(0xFFF3AA0E)
    val plexPressed = Color(0xFFD19209)
    val plexForeground = Color(0xFF111111)
    val jellyfin = Color(0xFF00A4DC)
    val jellyfinHover = Color(0xFF1AB3E8)
    val jellyfinPressed = Color(0xFF0093C6)
    val jellyfinForeground = Color(0xFF07080B)
    val foregroundOnDark = Color(0xFFECE9E1)
    val mutedForegroundOnDark = Color(0xFFB8B9B6)
    val destructiveOnDark = Color(0xFFF2A097)
    val cardOnDark = Color(0x0DFFFFFF)
    val inputOnDark = Color(0x59FFFFFF)
    val surfaceOnVideo = Color(0xD9111111)
    val surfaceHoverOnVideo = Color(0x14FFFFFF)
    val surfacePressedOnVideo = Color(0x1FFFFFFF)
    val borderOnVideo = Color(0x1FFFFFFF)
    val kbdOnVideo = Color(0x26FFFFFF)
    val markOnVideo = Color(0xB3FFFFFF)
    val best = Color(0xFFC6F135)
    val bestSoft = Color(0xFF1A2211)
    val bestForeground = Color(0xFF0C0F14)
    val live = Color(0xFFC6F135)
    val watchBar = Color(0xFF75BAD1)
    val posterMark = Color(0x9E111111)
    val destructive = Color(0xFFF07F76)
    val destructiveHover = Color(0xFFF4978F)
    val destructivePressed = Color(0xFFE2665D)
    val destructiveSoft = Color(0xFF2D1719)
    val destructiveForeground = Color(0xFF0C0F14)
    val warning = Color(0xFFE3A447)
    val warningSoft = Color(0xFF2A2113)
    val warningForeground = Color(0xFF0C0F14)
    val ring = Color(0xFFEBEEF3)
    val focusOnDark = Color(0xFFFFFFFF)
    val bar = Color(0xFF242B38)
    val barForeground = Color(0xFFF2F4F7)
    val barMutedForeground = Color(0xFFB2BAC7)
    val scrim = Color(0xA3000000)
    val shadow = Color(0x99000000)
    val edgeHighlight = Color(0x14FFFFFF)
    val control = Color(0x00FFFFFF)
    val inlineControl = Color(0xFF1A2230)
    val inlineControlHover = Color(0xFF222D3E)
    val inlineControlBorder = Color(0xFF61738F)
    val inlineControlBorderHover = Color(0xFF7184A1)
    val inlineControlForeground = Color(0xFFB9C9E2)
    val statusQueued = Color(0xFFF28B3B)
    val statusDownloading = Color(0xFF5CBF48)
    val statusImporting = Color(0xFFA584EC)
    val statusStalled = Color(0xFFF2827A)
    val statusBlocked = Color(0xFFE0433A)
}

private val colorScheme = darkColorScheme(
    primary = Tokens.primary,
    onPrimary = Tokens.primaryForeground,
    secondary = Tokens.secondary,
    onSecondary = Tokens.secondaryForeground,
    tertiary = Tokens.action,
    onTertiary = Tokens.actionForeground,
    background = Tokens.background,
    onBackground = Tokens.foreground,
    surface = Tokens.card,
    onSurface = Tokens.cardForeground,
    surfaceVariant = Tokens.popover,
    onSurfaceVariant = Tokens.mutedForeground,
    error = Tokens.destructive,
    onError = Tokens.destructiveForeground,
    border = Tokens.ring,
    borderVariant = Tokens.border,
    scrim = Tokens.scrim,
)

/**
 * The desktop's two typefaces (`src/client/globals.css`): Schibsted Grotesk for the interface, Barlow Semi Condensed for
 * numbers and data. Schibsted is the variable file, so each weight is an instance of its weight axis.
 */
object Fonts {
    val ui = FontFamily(
        Font(R.font.schibsted_grotesk, FontWeight.Normal),
        Font(R.font.schibsted_grotesk, FontWeight.Medium),
        Font(R.font.schibsted_grotesk, FontWeight.SemiBold),
        Font(R.font.schibsted_grotesk, FontWeight.Bold),
    )
    val data = FontFamily(Font(R.font.barlow_semi_condensed_semibold, FontWeight.SemiBold))
}

private val typography = Typography().let { base ->
    base.copy(
        displayLarge = base.displayLarge.copy(fontFamily = Fonts.ui),
        displayMedium = base.displayMedium.copy(fontFamily = Fonts.ui),
        displaySmall = base.displaySmall.copy(fontFamily = Fonts.ui),
        headlineLarge = base.headlineLarge.copy(fontFamily = Fonts.ui),
        headlineMedium = base.headlineMedium.copy(fontFamily = Fonts.ui),
        headlineSmall = base.headlineSmall.copy(fontFamily = Fonts.ui),
        titleLarge = base.titleLarge.copy(fontFamily = Fonts.ui),
        titleMedium = base.titleMedium.copy(fontFamily = Fonts.ui),
        titleSmall = base.titleSmall.copy(fontFamily = Fonts.ui),
        bodyLarge = base.bodyLarge.copy(fontFamily = Fonts.ui),
        bodyMedium = base.bodyMedium.copy(fontFamily = Fonts.ui),
        bodySmall = base.bodySmall.copy(fontFamily = Fonts.ui),
        labelLarge = base.labelLarge.copy(fontFamily = Fonts.ui),
        labelMedium = base.labelMedium.copy(fontFamily = Fonts.ui),
        labelSmall = base.labelSmall.copy(fontFamily = Fonts.ui),
    )
}

@Composable
fun AppTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colorScheme, typography = typography, content = content)
}
