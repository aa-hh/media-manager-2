package io.github.aahh.mediamanager2.tv.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import io.github.aahh.mediamanager2.tv.api.AuthApi
import io.github.aahh.mediamanager2.tv.api.LinkOutcome
import io.github.aahh.mediamanager2.tv.api.LinkSignIn
import io.github.aahh.mediamanager2.tv.api.ServerClient
import io.github.aahh.mediamanager2.tv.api.deviceName
import io.github.aahh.mediamanager2.tv.ui.Tokens
import io.github.aahh.mediamanager2.tv.ui.signin.BodyStyle
import io.github.aahh.mediamanager2.tv.ui.signin.LinkProblem
import io.github.aahh.mediamanager2.tv.ui.signin.PlanetState
import io.github.aahh.mediamanager2.tv.ui.signin.SignInBackdrop
import io.github.aahh.mediamanager2.tv.ui.signin.SignInButton
import io.github.aahh.mediamanager2.tv.ui.signin.SmallStyle
import io.github.aahh.mediamanager2.tv.ui.signin.TitleStyle
import io.github.aahh.mediamanager2.tv.ui.signin.linkProblemFor
import kotlinx.coroutines.delay

/** How long B5 shows before Home opens (T03c B notes). */
private const val SIGNED_IN_HOLD_MS = 1_500L

/**
 * Sign in with a Plex link code: the code to enter at plex.tv/link, then a short hand-off once signed in. Leaving the
 * screen cancels the attempt, and `LinkSignIn` tells the server. Back, and B4's Change server address, call
 * [onChangeAddress]. FINAL frames: T03c B1–B6.
 */
@Composable
fun LinkCodeScreen(client: ServerClient, onSignedIn: () -> Unit, onChangeAddress: () -> Unit) {
    val context = LocalContext.current
    val name = remember { deviceName(context) }
    var code by remember { mutableStateOf<String?>(null) }
    var problem by remember { mutableStateOf<LinkProblem?>(null) }
    var signedIn by remember { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }
    val primary = remember { FocusRequester() }

    LaunchedEffect(attempt) {
        code = null
        problem = null
        when (val outcome = LinkSignIn(AuthApi(client), client).signIn(name) { code = it.code }) {
            LinkOutcome.SignedIn -> {
                signedIn = true
                delay(SIGNED_IN_HOLD_MS)
                onSignedIn()
            }
            LinkOutcome.Expired -> problem = LinkProblem.Expired
            is LinkOutcome.Refused -> problem = linkProblemFor(outcome)
        }
    }
    LaunchedEffect(attempt, problem) { runCatching { primary.requestFocus() } }
    BackHandler(enabled = !signedIn) { onChangeAddress() }

    val planet = when {
        signedIn -> PlanetState.Success
        problem != null -> PlanetState.Idle
        else -> PlanetState.Checking
    }
    SignInBackdrop(planet) {
        val shown = problem
        when {
            signedIn -> SignedIn(name)
            shown == LinkProblem.SetupRequired -> SetupRequired(
                origin = client.origin,
                tryAgain = Modifier.focusRequester(primary),
                onTryAgain = { attempt += 1 },
                onChangeAddress = onChangeAddress,
            )
            else -> {
                Column(Modifier.padding(start = 48.dp, top = 104.dp).width(445.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text("Sign in with Plex", style = TitleStyle)
                    Steps()
                    Spacer(Modifier.height(8.dp))
                    SignInButton(
                        if (shown == LinkProblem.PlexUnreachable) "Try again" else "Get a new code",
                        filled = shown != null,
                        modifier = Modifier.focusRequester(primary),
                    ) { attempt += 1 }
                }
                CodePanel(code, shown)
            }
        }
    }
}

@Composable
private fun Steps() {
    val style = TextStyle(color = Tokens.foreground, fontSize = 18.sp)
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        val steps = listOf(
            buildAnnotatedString {
                append("On your phone or computer, go to ")
                withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append("plex.tv/link") }
            },
            buildAnnotatedString { append("Sign in with the Plex account that owns this server.") },
            buildAnnotatedString { append("Type the code shown here.") },
        )
        steps.forEachIndexed { index, step ->
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Text("${index + 1}", style = style.copy(color = Tokens.action, fontWeight = FontWeight.Bold))
                Text(step, style = style, modifier = Modifier.width(420.dp))
            }
        }
    }
}

// B1 and B2 show the code; B3 says why the account was refused; B6 says Plex could not be reached.
@Composable
private fun CodePanel(code: String?, problem: LinkProblem?) {
    val shape = RoundedCornerShape(16.dp)
    Box(
        Modifier
            .padding(start = 520.dp, top = 80.dp)
            .size(392.dp, 300.dp)
            .background(Tokens.card, shape)
            .border(1.dp, Tokens.border, shape)
            .padding(horizontal = 40.dp, vertical = 36.dp),
        contentAlignment = Alignment.Center,
    ) {
        when (problem) {
            LinkProblem.NotOwner -> Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text("That Plex account isn’t the owner", style = TitleStyle.copy(fontSize = 24.sp))
                Text(
                    "Only the account that set up media-manager-2 can sign in a TV. On plex.tv, switch to the owner’s account, then get a new code.",
                    style = BodyStyle,
                )
            }
            LinkProblem.PlexUnreachable -> Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Status("Can’t reach Plex right now.", Tokens.destructive, pulsing = false)
                Text(
                    "Plex didn’t answer, or asked us to wait. Try again in a minute.",
                    style = SmallStyle.copy(textAlign = TextAlign.Center),
                    modifier = Modifier.width(300.dp),
                )
            }
            else -> Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                val expired = problem == LinkProblem.Expired
                Text("Your code", style = BodyStyle.copy(fontWeight = FontWeight.SemiBold))
                Text(
                    code.orEmpty(),
                    style = TextStyle(
                        color = if (expired) Tokens.faintForeground else Tokens.foreground,
                        fontSize = 96.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 17.28.sp,
                    ),
                    modifier = Modifier.alpha(if (code == null) 0f else 1f),
                )
                if (expired) {
                    Status("This code has expired.", Tokens.destructive, pulsing = false)
                    Text("Codes last 10 minutes. Get a new one to try again.", style = SmallStyle)
                } else if (code != null) {
                    Status("Waiting for you to type it…", Tokens.foreground, pulsing = true)
                    Text("The code works for 10 minutes.", style = SmallStyle)
                }
            }
        }
    }
}

@Composable
private fun Status(text: String, color: Color, pulsing: Boolean) {
    val dot = if (pulsing) Tokens.action else color
    val pulse = rememberInfiniteTransition(label = "waiting").animateFloat(
        initialValue = 1f,
        targetValue = 0.35f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "dot",
    )
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(10.dp).alpha(if (pulsing) pulse.value else 1f).background(dot, CircleShape))
        Text(text, style = BodyStyle.copy(color = color))
    }
}

// B4: the server has no owner yet (`setup_required`).
@Composable
private fun SetupRequired(origin: String, tryAgain: Modifier, onTryAgain: () -> Unit, onChangeAddress: () -> Unit) {
    Column(Modifier.padding(start = 48.dp, top = 104.dp).width(560.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Finish setup in a browser first.", style = TitleStyle)
        Text(
            "This server has no owner yet. On a computer, open $origin, sign in with Plex and finish setting up. Then come back to this TV.",
            style = BodyStyle.copy(fontSize = 18.sp),
        )
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            SignInButton("Try again", filled = true, modifier = tryAgain, onClick = onTryAgain)
            SignInButton("Change server address", filled = false, onClick = onChangeAddress)
        }
    }
}

private val CHECK = PathParser().parsePathString(
    "M28 4.66667C15.12 4.66667 4.66667 15.12 4.66667 28C4.66667 40.88 15.12 51.3333 28 51.3333C40.88 51.3333 51.3333 40.88 51.3333 28C51.3333 15.12 40.88 4.66667 28 4.66667ZM23.3333 39.6667L14 30.3333L17.2667 27.0667L23.3333 33.1333L38.7333 17.7333L42 21L23.3333 39.6667Z",
).toPath()

// B5: nothing here takes focus; Home opens after SIGNED_IN_HOLD_MS.
@Composable
private fun SignedIn(deviceName: String) {
    Column(Modifier.padding(start = 48.dp, top = 173.dp).width(445.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Canvas(Modifier.size(56.dp)) { scale(size.width / 56f, pivot = Offset.Zero) { drawPath(CHECK, Tokens.action) } }
        Text("You’re signed in", style = TitleStyle)
        Text("Opening Home…", style = BodyStyle.copy(fontSize = 18.sp))
        Text(
            "This TV is listed in Settings on the web as “$deviceName”, where you can sign it out.",
            style = SmallStyle,
        )
    }
}
