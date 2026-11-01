// v2/TV/WatchMark/Played — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=12-1869
// v2/TV/WatchMark/UnwatchedCount — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=12-1872
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens

/** A played title: a white tick in a 24dp dark circle at the poster's top right. */
@Composable
fun WatchMarkPlayed(modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(24.dp)
            .background(Tokens.posterMark, CircleShape)
            .border(1.dp, Tokens.borderOnVideo, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(TvIcons.Check, contentDescription = "Played", modifier = Modifier.size(14.dp), tint = Tokens.foreground)
    }
}

/** A partly watched show: how many episodes are unwatched, in the same circle, growing sideways for two digits. */
@Composable
fun WatchMarkUnwatched(count: Int, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(12.dp)
    Box(
        modifier
            .height(24.dp)
            .defaultMinSize(minWidth = 24.dp)
            .background(Tokens.posterMark, shape)
            .border(1.dp, Tokens.borderOnVideo, shape)
            .padding(horizontal = 7.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(count.toString(), style = TvText.number(15), color = Tokens.foreground, maxLines = 1)
    }
}

@Preview(widthDp = 160, heightDp = 48, backgroundColor = 0xFF5C4A3B, showBackground = true)
@Composable
private fun WatchMarkPreview() = AppTheme {
    Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        WatchMarkPlayed()
        WatchMarkUnwatched(3)
        WatchMarkUnwatched(12)
    }
}
