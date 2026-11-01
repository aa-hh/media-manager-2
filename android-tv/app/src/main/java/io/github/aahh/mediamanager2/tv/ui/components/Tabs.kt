// v2/TV/Tabs/Tab — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=53-4409
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens

/**
 * One tab: 32 high, a pill, 16 in, the label 16/500 in `muted-foreground`. The [selected] tab is 16/600 in `foreground`
 * with a 3dp bar under its label. Focus is the off-white fill with dark words that menu rows and the side menu share.
 */
@Composable
fun Tab(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val fill by animateFocusColor(focused, Tokens.control, Tokens.foregroundOnDark)
    val content by animateFocusColor(focused, if (selected) Tokens.foreground else Tokens.mutedForeground, Tokens.background)
    Column(modifier.semantics { this.selected = selected }, horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier
                .height(32.dp)
                .background(fill, RoundedCornerShape(16.dp))
                .clickable(interactionSource = interaction, indication = null, role = Role.Tab, onClick = onClick)
                .padding(horizontal = 16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(label, style = if (selected) TvText.label else TvText.labelMedium, color = content, maxLines = 1)
        }
        // The bar spans the label (the pill less its 16 sides); an unselected tab keeps the space so nothing shifts.
        Box(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(3.dp).background(if (selected) Tokens.foreground else Tokens.control, RoundedCornerShape(2.dp)))
    }
}

/** A row of [Tab]s 4 apart (the library filters, a show's seasons, the release qualities). */
@Composable
fun TabRow(labels: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        labels.forEachIndexed { index, label -> Tab(label, selected = index == selected, onClick = { onSelect(index) }) }
    }
}

@Preview(widthDp = 640, heightDp = 64, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun TabsPreview() = AppTheme {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Tab("All", selected = true, onClick = {})
        Tab("Continue watching", selected = false, onClick = {}, modifier = Modifier.focusRequester(focus))
        Tab("Unwatched", selected = false, onClick = {})
        Spacer(Modifier.width(8.dp))
    }
}
