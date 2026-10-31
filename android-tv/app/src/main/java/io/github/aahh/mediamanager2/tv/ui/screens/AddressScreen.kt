package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.api.normaliseAddress
import io.github.aahh.mediamanager2.tv.ui.Tokens

/**
 * The server address, on first launch and after Log out ([prefill] is then the old address and focus starts on
 * Continue). tv-material has no text field, so it is a `BasicTextField` with the URI keyboard. Only https is accepted.
 * FINAL frames: T03c A1–A8. Stub until T14 builds it (checking the server, the planet, the error states); the signature is
 * the one it keeps. [onConnected] gets the normalised https origin.
 */
@Composable
fun AddressScreen(prefill: String?, onConnected: (origin: String) -> Unit) {
    var text by rememberSaveable { mutableStateOf(prefill.orEmpty()) }
    var refused by remember { mutableStateOf(false) }
    val field = remember { FocusRequester() }
    val connect = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { if (prefill.isNullOrEmpty()) field.requestFocus() else connect.requestFocus() } }
    Placeholder("Connect to your server", "T03c A1–A8") {
        BasicTextField(
            value = text,
            onValueChange = {
                text = it
                refused = false
            },
            singleLine = true,
            textStyle = TextStyle(color = Tokens.foreground, fontSize = 20.sp),
            cursorBrush = SolidColor(Tokens.foreground),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go),
            modifier = Modifier
                .focusRequester(field)
                .fillMaxWidth(0.5f)
                .background(Tokens.inlineControl, RoundedCornerShape(12.dp))
                .padding(horizontal = 16.dp, vertical = 12.dp),
        )
        if (refused) Text("Enter an https:// address.", color = Tokens.destructive)
        StubButton("Continue", Modifier.focusRequester(connect)) {
            val origin = normaliseAddress(text)
            if (origin == null) refused = true else onConnected(origin)
        }
    }
}
