// v2/TV/Backdrop/Browse — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=35-4135
// v2/TV/Backdrop/TitlePage — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=61-5422
// v2/TV/Backdrop/Episodes — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=54-5075
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.ui.unit.IntSize
import kotlin.math.ceil
import androidx.compose.ui.tooling.preview.Preview
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens

/** How much of the backdrop the page darkens, so its words stay readable over any art. */
enum class BackdropScrim {
    /** Home and Discover: the left half dark under the summary, the bottom under the rows. */
    Browse,

    /** A title page: nearly solid on the left 45%, fading out by 72%, and a heavier bottom. */
    TitlePage,

    /** A show's episode list: dark across the left 30%, still 75% at the right edge. */
    Episodes,
}

/**
 * The full-screen art behind a page: [image] fills the screen (the caller's poster or fanart, or nothing while it loads)
 * and the [scrim] gradients in `background` lie over it.
 */
@Composable
fun Backdrop(scrim: BackdropScrim, modifier: Modifier = Modifier, image: @Composable BoxScope.() -> Unit = {}) {
    val bg = Tokens.background
    Box(modifier.fillMaxSize().background(bg)) {
        image()
        when (scrim) {
            BackdropScrim.Browse -> {
                Box(Modifier.fillMaxSize().scrim(
                    Brush.horizontalGradient(0f to bg.copy(alpha = 0.95f), 0.55f to bg.copy(alpha = 0.55f), 1f to bg.copy(alpha = 0f)),
                    Brush.verticalGradient(0.45f to bg.copy(alpha = 0f), 1f to bg),
                ))
            }
            BackdropScrim.TitlePage -> {
                Box(Modifier.fillMaxSize().scrim(
                    Brush.horizontalGradient(0f to bg, 0.45f to bg.copy(alpha = 0.92f), 0.72f to bg.copy(alpha = 0.2f), 1f to bg.copy(alpha = 0f)),
                    Brush.verticalGradient(0.6f to bg.copy(alpha = 0f), 1f to bg.copy(alpha = 0.85f)),
                ))
            }
            BackdropScrim.Episodes -> {
                Box(Modifier.fillMaxSize().scrim(Brush.horizontalGradient(0.3f to bg.copy(alpha = 0.95f), 1f to bg.copy(alpha = 0.75f))))
            }
        }
    }
}

// The [brushes], drawn once into a picture a quarter of the size and stretched over the whole area. Shading full-screen
// gradients every frame cost the Google TV Streamer's GPU ~26 ms of each 16 ms frame; stretching one small picture costs
// a fraction of that, and a smooth gradient looks the same stretched.
private fun Modifier.scrim(vararg brushes: Brush): Modifier = drawWithCache {
    val small = IntSize(ceil(size.width / 4).toInt().coerceAtLeast(1), ceil(size.height / 4).toInt().coerceAtLeast(1))
    val picture = ImageBitmap(small.width, small.height)
    CanvasDrawScope().draw(this, layoutDirection, Canvas(picture), Size(small.width.toFloat(), small.height.toFloat())) {
        brushes.forEach { drawRect(it) }
    }
    val full = IntSize(ceil(size.width).toInt(), ceil(size.height).toInt())
    onDrawBehind { drawImage(picture, dstSize = full, filterQuality = FilterQuality.Low) }
}

@Preview(widthDp = 480, heightDp = 270)
@Composable
private fun BackdropPreview() = AppTheme {
    Backdrop(BackdropScrim.TitlePage) {
        Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Tokens.watchBar, Tokens.warning))))
    }
}
