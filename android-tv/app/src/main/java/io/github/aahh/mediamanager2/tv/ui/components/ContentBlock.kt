// v2/TV/ContentBlock/Page — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=53-4499
// v2/TV/ContentBlock/Dialog — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=35-4297
// v2/TV/ContentBlock/Summary — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=53-4358
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens

enum class ContentBlockSize {
    /** A title page's heading: 40/700 title, 15 facts line and overview. */
    Page,

    /** A dialog's heading: 28/700 title and a 16 sentence. */
    Dialog,
}

/**
 * A heading block: the title in `foreground`, an optional [subtitle] (the facts line, `muted-foreground` at 60%) 4 under
 * it, and an optional [description] (`muted-foreground` at 80%, at most [descriptionLines]) 16 under those.
 */
@Composable
fun ContentBlock(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    description: String? = null,
    size: ContentBlockSize = ContentBlockSize.Page,
    descriptionLines: Int = 2,
) {
    val page = size == ContentBlockSize.Page
    Column(modifier, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = if (page) TvText.pageTitle else TvText.dialogTitle, color = Tokens.foreground, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) {
                Text(subtitle, style = TvText.pageBody, color = Tokens.mutedForeground.copy(alpha = 0.6f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        if (description != null) {
            Text(
                description,
                style = if (page) TvText.pageBody else TvText.body,
                color = Tokens.mutedForeground.copy(alpha = 0.8f),
                maxLines = descriptionLines,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/**
 * The focused card's summary at the top of Home and Discover (T03a A1, T03d A1): the overline ("Series · 2026 · 2
 * seasons", 14), the title 36/700 4 under it and a two-line summary 20 under that, 484 wide.
 */
@Composable
fun TitleSummary(overline: String, title: String, summary: String?, modifier: Modifier = Modifier) {
    Column(modifier.width(484.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(overline, style = TvText.overline, color = Tokens.mutedForeground, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(title, style = TvText.hero, color = Tokens.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (summary != null) Text(summary, style = TvText.body, color = Tokens.mutedForeground, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Preview(widthDp = 600, heightDp = 420, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun ContentBlockPreview() = AppTheme {
    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(32.dp)) {
        TitleSummary(
            "Series · 2026 · 2 seasons",
            "The Quiet Year",
            "A lighthouse keeper and her estranged brother spend one winter on a closed island. Season 2 arrives Friday.",
        )
        ContentBlock(
            "Night Harbour",
            modifier = Modifier.width(520.dp),
            subtitle = "Movie · 2025 · 1 h 52 min · Thriller · 2160p Dolby Vision",
            description = "A harbour pilot finds a ship that should not exist and has to decide who to tell.",
        )
    }
}
