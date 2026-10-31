package io.github.aahh.mediamanager2.tv.update

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File

sealed interface InstallResult {
    /** Android's "Install unknown apps" page for this app is open; the owner allows it and presses Update now again. */
    data object NeedsPermission : InstallResult
    /** Handed to Android, which checks the signature and asks the owner to confirm. */
    data object Handed : InstallResult
    data object Failed : InstallResult
}

/**
 * Downloads a release's APK to the cache and hands it to a PackageInstaller session. Android's signature check is the
 * integrity check: an APK not signed with the release key will not install over this app.
 */
class UpdateInstaller(private val context: Context, private val client: OkHttpClient) {
    fun canInstall(): Boolean = context.packageManager.canRequestPackageInstalls()

    suspend fun install(update: AvailableUpdate): InstallResult {
        if (!canInstall()) {
            context.startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            return InstallResult.NeedsPermission
        }
        return withContext(Dispatchers.IO) {
            runCatching {
                val folder = File(context.cacheDir, "updates").apply { mkdirs() }
                folder.listFiles()?.forEach { it.delete() }
                val apk = File(folder, "media-manager-2-tv-${update.versionCode}.apk")
                client.newCall(Request.Builder().url(update.downloadUrl).build()).execute().use { response ->
                    if (!response.isSuccessful) error("GitHub answered ${response.code}")
                    apk.outputStream().use { response.body.byteStream().copyTo(it) }
                }
                val installer = context.packageManager.packageInstaller
                val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
                    setAppPackageName(context.packageName)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
                }
                val sessionId = installer.createSession(params)
                installer.openSession(sessionId).use { session ->
                    session.openWrite("update.apk", 0, apk.length()).use { out ->
                        apk.inputStream().use { it.copyTo(out) }
                        session.fsync(out)
                    }
                    // Mutable, because the installer adds its status and, when it needs the owner, the confirm screen.
                    val status = PendingIntent.getBroadcast(
                        context,
                        sessionId,
                        Intent(context, UpdateStatusReceiver::class.java).setPackage(context.packageName),
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
                    )
                    session.commit(status.intentSender)
                }
                InstallResult.Handed
            }.getOrDefault(InstallResult.Failed)
        }
    }
}

/** Shows Android's confirm screen when the installer asks for the owner; Android restarts the app once installed. */
class UpdateStatusReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE) != PackageInstaller.STATUS_PENDING_USER_ACTION) return
        val confirm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
        } else {
            @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_INTENT)
        } ?: return
        context.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
