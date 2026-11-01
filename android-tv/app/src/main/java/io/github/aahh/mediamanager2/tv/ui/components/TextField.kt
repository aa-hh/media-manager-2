// v2/TV/TextField/Outlined — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=33-4054
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens

/**
 * The outlined text field (server address, search, the Plex list name): the [label] 6 above a 48-high box (radius 12, 16
 * in), then optional [supporting] text 6 under it. At rest the box has a 1.5dp `input` edge; focus makes it a 3dp white
 * edge and brings the label to `foreground`. [isError] turns the supporting line `destructive`. Typing goes to the
 * system keyboard; focus does not grow the field, so the keyboard and the page stay put.
 */
@Composable
fun TvTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    supporting: String? = null,
    isError: Boolean = false,
    enabled: Boolean = true,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    focusRequester: FocusRequester? = null,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val progress by animateFocus(focused)
    val labelColor by animateFocusColor(focused, Tokens.mutedForeground, Tokens.foreground)
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, style = TvText.fieldLabel, color = labelColor, maxLines = 1)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier
                .fillMaxWidth()
                .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier),
            enabled = enabled,
            singleLine = true,
            textStyle = TvText.fieldInput.copy(color = Tokens.foreground),
            cursorBrush = SolidColor(Tokens.foreground),
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            interactionSource = interaction,
            decorationBox = { inner ->
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .border(
                            width = (1.5f + 1.5f * progress).dp,
                            color = lerp(Tokens.input, Tokens.focusOnDark, progress),
                            shape = RoundedCornerShape(12.dp),
                        )
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    if (value.isEmpty() && placeholder != null) {
                        Text(placeholder, style = TvText.fieldInput, color = Tokens.subtleForeground, maxLines = 1)
                    }
                    inner()
                }
            },
        )
        if (supporting != null) {
            Text(supporting, style = TvText.supporting, color = if (isError) Tokens.destructive else Tokens.mutedForeground)
        }
    }
}

@Preview(widthDp = 480, heightDp = 260, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun TextFieldPreview() = AppTheme {
    val focus = remember { FocusRequester() }
    var address by remember { mutableStateOf("192.168.1.20:8080") }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Column(Modifier.padding(24.dp).width(420.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        TvTextField(address, { address = it }, "Server address", supporting = "The address you open Media Manager at.", focusRequester = focus)
        TvTextField("media.local", {}, "Server address", supporting = "Can’t reach Media Manager at that address.", isError = true)
    }
}
