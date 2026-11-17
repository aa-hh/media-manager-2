package io.github.aahh.mediamanager2.tv

import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import io.github.aahh.mediamanager2.tv.ui.AppNavigation
import io.github.aahh.mediamanager2.tv.ui.AppSession
import io.github.aahh.mediamanager2.tv.ui.AppTheme

class MainActivity : ComponentActivity() {
    private var holdBack: (() -> Boolean)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val session = AppSession(applicationContext)
        setContent {
            AppTheme {
                AppNavigation(session, onLeave = ::finish, onHoldBack = { holdBack = it })
            }
        }
    }

    // Android calls this once per held Back and cancels the release when it returns true.
    override fun onKeyLongPress(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && holdBack?.invoke() == true) return true
        return super.onKeyLongPress(keyCode, event)
    }
}
