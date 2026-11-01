package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// Focus motion shared by every TV component: 150 ms on the desktop's ease-out curve (DESIGN.md, Motion). Focus grows a
// control from its centre with a graphics layer, so nothing around it moves.

private val EaseOut = CubicBezierEasing(0.2f, 0f, 0f, 1f)

internal fun <T> focusSpec(): AnimationSpec<T> = tween(durationMillis = 150, easing = EaseOut)

/** 0 at rest, 1 when focused, eased between. */
@Composable
internal fun animateFocus(focused: Boolean): State<Float> = animateFloatAsState(if (focused) 1f else 0f, focusSpec(), label = "focus")

@Composable
internal fun animateFocusColor(focused: Boolean, rest: Color, focus: Color): State<Color> =
    animateColorAsState(if (focused) focus else rest, focusSpec(), label = "focus colour")

/** Grows the control to [scale] times its size as [progress] goes to 1, from its centre, without moving its neighbours. */
internal fun Modifier.focusGrow(progress: () -> Float, scale: Float = 1.1f): Modifier = graphicsLayer {
    val s = 1f + (scale - 1f) * progress()
    scaleX = s
    scaleY = s
}

/**
 * The focus ring: a [width] stroke drawn just outside the control's edge, fading in with [progress]. [radius] is the
 * control's corner; null makes it a pill.
 */
internal fun Modifier.outerRing(progress: () -> Float, color: Color, radius: Dp? = null, width: Dp = 3.dp): Modifier = drawWithContent {
    drawContent()
    val alpha = progress()
    if (alpha <= 0f) return@drawWithContent
    val w = width.toPx()
    val r = (radius?.toPx() ?: (size.height / 2f)) + w / 2f
    drawRoundRect(
        color = color.copy(alpha = color.alpha * alpha),
        topLeft = Offset(-w / 2f, -w / 2f),
        size = Size(size.width + w, size.height + w),
        cornerRadius = CornerRadius(r, r),
        style = Stroke(w),
    )
}
