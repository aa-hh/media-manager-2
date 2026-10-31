package io.github.aahh.mediamanager2.tv.ui.signin

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.BoxWithConstraintsScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.R
import io.github.aahh.mediamanager2.tv.ui.Tokens

// Type sizes from the T03c frames, which are drawn at 960 × 540 dp.
internal val TitleStyle = TextStyle(color = Tokens.foreground, fontSize = 32.sp, fontWeight = FontWeight.Bold)
internal val BodyStyle = TextStyle(color = Tokens.mutedForeground, fontSize = 16.sp)
internal val SmallStyle = TextStyle(color = Tokens.subtleForeground, fontSize = 14.sp)

/**
 * What every T03c A and B frame shares: the planet, moved right by 200 of the frame's 960 dp, the desktop sign-in's
 * left-to-right scrim, and the app name top left.
 */
@Composable
internal fun SignInBackdrop(planet: PlanetState, content: @Composable BoxWithConstraintsScope.() -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize().background(Tokens.background)) {
        Planet(planet, Modifier.fillMaxSize().offset(x = maxWidth * (200f / 960f)))
        Box(
            Modifier.fillMaxSize().background(
                Brush.horizontalGradient(0f to Tokens.signInGround, 0.55f to Tokens.signInGround.copy(alpha = 0f)),
            ),
        )
        Row(
            Modifier.padding(start = 48.dp, top = 36.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Image(painterResource(R.drawable.logo), contentDescription = null, modifier = Modifier.size(28.dp))
            Text("media-manager-2", style = BodyStyle.copy(fontWeight = FontWeight.SemiBold))
        }
        content()
    }
}

/**
 * The frames' pill button. [filled] is the light-blue one; otherwise an outline. Focus grows it 1.1× with a ring, as the
 * frames draw it; at rest it is drawn at 80 %. A local copy until T13b builds the shared button.
 */
@Composable
internal fun SignInButton(label: String, filled: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val shape = RoundedCornerShape(44.dp)
    val look = when {
        filled && focused -> Modifier.background(Tokens.action, shape).border(3.dp, Tokens.ring, shape)
        filled -> Modifier.background(Tokens.action.copy(alpha = 0.8f), shape)
        focused -> Modifier.border(3.dp, Tokens.focusOnDark, shape)
        else -> Modifier.border(1.5.dp, Tokens.input.copy(alpha = 0.4f), shape)
    }
    Box(
        modifier
            .scale(if (focused) 1.1f else 1f)
            .then(look)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
    ) {
        Text(
            label,
            modifier = Modifier.alpha(if (focused) 1f else 0.8f),
            style = TextStyle(
                color = if (filled) Tokens.primaryForeground else Tokens.foreground,
                fontSize = if (filled) 16.sp else 15.sp,
                fontWeight = if (filled) FontWeight.SemiBold else FontWeight.Medium,
                lineHeight = 20.sp,
            ),
        )
    }
}
