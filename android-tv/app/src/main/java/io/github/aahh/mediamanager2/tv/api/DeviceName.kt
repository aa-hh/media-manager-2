package io.github.aahh.mediamanager2.tv.api

import android.content.Context
import android.os.Build
import android.provider.Settings

private val CONTROL = Regex("\\p{Cc}")

/** The name web Settings lists this TV under: the name set in Android's settings, else the model. */
fun deviceName(context: Context): String =
    cleanDeviceName(Settings.Global.getString(context.contentResolver, Settings.Global.DEVICE_NAME), Build.MODEL)

/** What `POST /auth/link/start` accepts: trimmed, no control characters, 1 to 64 characters. */
fun cleanDeviceName(settingsName: String?, model: String?): String {
    for (raw in listOf(settingsName, model)) {
        val text = raw?.replace(CONTROL, " ")?.trim().orEmpty()
        if (text.isEmpty()) continue
        val points = text.codePoints().limit(64).toArray()
        return String(points, 0, points.size).trim()
    }
    return "Android TV"
}
