package io.github.aahh.mediamanager2.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import io.github.aahh.mediamanager2.tv.ui.AppNavigation
import io.github.aahh.mediamanager2.tv.ui.AppSession
import io.github.aahh.mediamanager2.tv.ui.AppTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val session = AppSession(applicationContext)
        setContent {
            AppTheme {
                AppNavigation(session, onLeave = ::finish)
            }
        }
    }
}
