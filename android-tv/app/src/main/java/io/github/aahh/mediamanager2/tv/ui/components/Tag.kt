// v2/TV/Tag/Downloading — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=53-4426
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Fonts
import io.github.aahh.mediamanager2.tv.ui.Tokens

/**
 * "Downloading 64%" on a poster: words 12/500 and the percentage in data 14/600, on the dark on-video surface, radius 10,
 * 8 in from the poster's left and top.
 */
@Composable
fun DownloadingTag(percent: Int, modifier: Modifier = Modifier) {
    val text = buildAnnotatedString {
        append("Downloading ")
        withStyle(SpanStyle(fontFamily = Fonts.data, fontWeight = TvText.number(14).fontWeight, fontSize = TvText.number(14).fontSize)) {
            append("${percent.coerceIn(0, 100)}%")
        }
    }
    Text(
        text,
        modifier = modifier.background(Tokens.surfaceOnVideo, RoundedCornerShape(10.dp)).padding(horizontal = 8.dp, vertical = 2.dp),
        style = TvText.badge,
        color = Tokens.foreground,
        maxLines = 1,
    )
}

@Preview(widthDp = 160, heightDp = 40, backgroundColor = 0xFF553B5C, showBackground = true)
@Composable
private fun DownloadingTagPreview() = AppTheme {
    DownloadingTag(64, Modifier.padding(8.dp))
}
