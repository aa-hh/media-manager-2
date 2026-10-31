// v2/TV/Dialog/Standard — https://www.figma.com/design/LOntH5HQXfvTnfapJoyoqZ/media-manager-2----Android-tv----screens?node-id=35-4136
package io.github.aahh.mediamanager2.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import io.github.aahh.mediamanager2.tv.ui.AppTheme
import io.github.aahh.mediamanager2.tv.ui.Tokens

/**
 * A centred pop-up (update prompt, Log out, install permission): 528 wide on `popover`, radius 16, 24 in, the heading
 * block 24 above the buttons, which sit in a row 12 apart. The page behind dims to the kit's scrim (black 38%). [content]
 * goes between the heading and the buttons (the update's download line). The caller puts focus on the button the frame
 * names and decides what Back does through [onDismiss].
 */
@Composable
fun TvDialog(
    title: String,
    onDismiss: () -> Unit,
    description: String? = null,
    content: @Composable ColumnScope.() -> Unit = {},
    actions: @Composable RowScope.() -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        DialogDim(0.38f)
        val shape = RoundedCornerShape(16.dp)
        Column(
            Modifier
                .width(528.dp)
                .shadow(6.dp, shape, ambientColor = Tokens.shadow, spotColor = Tokens.shadow)
                .background(Tokens.popover, shape)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            ContentBlock(title, description = description, size = ContentBlockSize.Dialog)
            content()
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), content = actions)
        }
    }
}

/** Sets how much the window behind this dialog dims, 0 to 1. Call it first inside a `Dialog`. */
@Composable
internal fun DialogDim(amount: Float) {
    val window = (LocalView.current.parent as? DialogWindowProvider)?.window
    SideEffect { window?.setDimAmount(amount) }
}

@Preview(widthDp = 600, heightDp = 260, backgroundColor = 0xFF0C0F14, showBackground = true)
@Composable
private fun DialogPreview() = AppTheme {
    // The window itself cannot be previewed, so this draws its panel the way the dialog does.
    val shape = RoundedCornerShape(16.dp)
    Column(
        Modifier.padding(24.dp).width(528.dp).background(Tokens.popover, shape).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        ContentBlock("Version 1.0.42 is ready", description = "It takes about a minute. Your settings stay as they are.", size = ContentBlockSize.Dialog)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TvButton("Update now", onClick = {})
            TvButton("Later", onClick = {}, kind = ButtonKind.Outline)
        }
    }
}
