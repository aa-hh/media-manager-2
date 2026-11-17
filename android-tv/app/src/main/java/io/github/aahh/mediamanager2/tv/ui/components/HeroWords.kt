// v2/TV/Hero words — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/?node-id=137-14621
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens

/**
 * The words at the top of TV Home, 340 × 148: a 300 × 64 box holding the title's [logo] (the slot fills the box) or,
 * without one, the plain [title] at 36/700 in up to two lines, the second growing up out of the box; then [facts] 12
 * under it, one line, 20 high; then [summary] 8 under that, two lines, or empty space. The plain title is always the
 * accessibility label. [rise] moves only the 300 × 64 box down by that many dp, for the page's swap animation.
 */
@Composable
fun HeroWords(
    title: String,
    facts: String,
    summary: String?,
    modifier: Modifier = Modifier,
    rise: () -> Float = { 0f },
    logo: (@Composable BoxScope.() -> Unit)? = null,
) {
    Column(modifier.size(340.dp, 148.dp)) {
        val box = Modifier.size(300.dp, 64.dp).graphicsLayer { translationY = rise().dp.toPx() }
        if (logo != null) {
            Box(box.semantics { contentDescription = title }, contentAlignment = Alignment.BottomStart, propagateMinConstraints = true) { logo() }
        } else {
            // The title is 340 wide, wider than its box, and sits on the box's bottom edge, so a second line grows upward.
            Layout(
                content = { Text(title, style = TvText.hero, color = Tokens.foreground, maxLines = 2, overflow = TextOverflow.Ellipsis) },
                modifier = box,
            ) { measurables, constraints ->
                val text = measurables.single().measure(Constraints(maxWidth = 340.dp.roundToPx()))
                layout(constraints.maxWidth, constraints.maxHeight) { text.place(0, constraints.maxHeight - text.height) }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text(facts, style = TvText.heroFacts, color = Tokens.mutedForeground, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.height(20.dp))
        Spacer(Modifier.height(8.dp))
        if (summary != null) {
            Text(summary, style = TvText.heroSummary, color = Tokens.foreground.copy(alpha = 0.8f), maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Preview(widthDp = 420, heightDp = 360, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun HeroWordsPreview() = AppTheme {
    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        HeroWords(
            "The Quiet Year",
            "2026 · 2 seasons · Drama",
            "A lighthouse keeper and her estranged brother spend one winter on a closed island. Season 2 arrives Friday.",
        )
        HeroWords("Night Harbour", "2025 · 1h 52m · Thriller", "A harbour pilot finds a ship that should not exist.") {
            // A stand-in for a title logo picture, drawn in code.
            Box(Modifier.align(Alignment.BottomStart).size(220.dp, 48.dp).background(Tokens.foreground, RoundedCornerShape(6.dp)), contentAlignment = Alignment.Center) {
                Text("NIGHT HARBOUR", style = TvText.panelTitle, color = Tokens.background)
            }
        }
    }
}
