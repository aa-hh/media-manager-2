package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.ui.Tokens
import io.github.aahh.mediamanager2.tv.ui.signin.ADDRESS_HINT
import io.github.aahh.mediamanager2.tv.ui.signin.AddressInput
import io.github.aahh.mediamanager2.tv.ui.signin.AddressProblem
import io.github.aahh.mediamanager2.tv.ui.signin.BodyStyle
import io.github.aahh.mediamanager2.tv.ui.signin.PlanetState
import io.github.aahh.mediamanager2.tv.ui.signin.SignInBackdrop
import io.github.aahh.mediamanager2.tv.ui.signin.SignInButton
import io.github.aahh.mediamanager2.tv.ui.signin.TitleStyle
import io.github.aahh.mediamanager2.tv.ui.signin.addressCheckClient
import io.github.aahh.mediamanager2.tv.ui.signin.checkServer
import io.github.aahh.mediamanager2.tv.ui.signin.hostOf
import io.github.aahh.mediamanager2.tv.ui.signin.readAddress
import io.github.aahh.mediamanager2.tv.ui.signin.switchToHttps
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * The server address, on first launch and after Log out ([prefill] is then the old address and focus starts on
 * Connect, A6). tv-material has no text field, so it is a `BasicTextField` with the URI keyboard. Connect adds https://
 * to a bare address, refuses http:// (A8) and asks the server's `/auth/status` before going on (A3; Back stops it).
 * FINAL frames: T03c A1–A8. [onConnected] gets the normalised https origin.
 */
@Composable
fun AddressScreen(prefill: String?, onConnected: (origin: String) -> Unit) {
    var text by rememberSaveable { mutableStateOf(prefill.orEmpty()) }
    var problem by remember { mutableStateOf<AddressProblem?>(null) }
    var checking by remember { mutableStateOf<Job?>(null) }
    val scope = rememberCoroutineScope()
    val http = remember { addressCheckClient() }
    val field = remember { FocusRequester() }
    val button = remember { FocusRequester() }
    val fieldInteraction = remember { MutableInteractionSource() }
    val fieldFocused by fieldInteraction.collectIsFocusedAsState()

    LaunchedEffect(Unit) { runCatching { if (prefill.isNullOrEmpty()) field.requestFocus() else button.requestFocus() } }
    // A4, A7 and A8 put focus on the button; A5 and a bad address put it back in the field.
    LaunchedEffect(problem) {
        val shown = problem ?: return@LaunchedEffect
        val onButton = shown is AddressProblem.Unreachable || shown is AddressProblem.Untrusted || shown is AddressProblem.Http
        runCatching { if (onButton) button.requestFocus() else field.requestFocus() }
    }
    BackHandler(enabled = checking != null) {
        checking?.cancel()
        checking = null
    }

    fun connect(input: String) {
        if (checking != null) return
        when (val read = readAddress(input)) {
            AddressInput.Http -> problem = AddressProblem.Http
            AddressInput.Invalid -> problem = AddressProblem.Invalid
            is AddressInput.Ok -> {
                text = read.origin
                problem = null
                checking = scope.launch {
                    val found = checkServer(http, read.origin)
                    checking = null
                    if (found == null) onConnected(read.origin) else problem = found
                }
            }
        }
    }

    SignInBackdrop(if (checking != null) PlanetState.Checking else PlanetState.Idle) {
        val shown = problem
        Column(Modifier.padding(start = 48.dp, top = 104.dp).width(480.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Connect to your server", style = TitleStyle)
            Text("Type the address you use for media-manager-2 in a browser.", style = BodyStyle)
            Column(Modifier.width(440.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    "Server address",
                    style = TextStyle(color = Tokens.foreground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, lineHeight = 20.sp),
                )
                val shape = RoundedCornerShape(12.dp)
                val (borderWidth, borderColor) = when {
                    fieldFocused -> 3.dp to Tokens.focusOnDark
                    shown != null -> 2.dp to Tokens.destructive
                    else -> 1.5.dp to Tokens.fieldBorder
                }
                BasicTextField(
                    value = text,
                    onValueChange = {
                        text = it
                        problem = null
                    },
                    readOnly = checking != null,
                    singleLine = true,
                    textStyle = TextStyle(color = Tokens.foreground, fontSize = 18.sp, lineHeight = 24.sp),
                    cursorBrush = SolidColor(Tokens.foreground),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go),
                    keyboardActions = KeyboardActions(onGo = { connect(text) }),
                    interactionSource = fieldInteraction,
                    modifier = Modifier
                        .focusRequester(field)
                        .fillMaxWidth()
                        .border(borderWidth, borderColor, shape)
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                )
                val origin = readAddress(text).let { it as? AddressInput.Ok }?.origin
                val (hint, hintColor) = when {
                    checking != null && origin != null -> "Checking the server at ${hostOf(origin)}…" to Tokens.mutedForeground
                    shown != null -> shown.message to Tokens.destructive
                    else -> ADDRESS_HINT to Tokens.mutedForeground
                }
                Text(hint, style = TextStyle(color = hintColor, fontSize = 14.sp, lineHeight = 16.sp))
            }
            Spacer(Modifier.height(12.dp))
            val label = when {
                checking != null -> "Connecting…"
                shown is AddressProblem.Http -> "Switch to https://"
                shown is AddressProblem.Unreachable || shown is AddressProblem.Untrusted -> "Try again"
                else -> "Connect"
            }
            SignInButton(label, filled = true, modifier = Modifier.focusRequester(button)) {
                if (shown is AddressProblem.Http) connect(switchToHttps(text)) else connect(text)
            }
        }
    }
}
