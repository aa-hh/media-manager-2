package io.github.aahh.mediamanager2.tv.ui.components

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import coil3.ImageLoader
import coil3.compose.AsyncImage
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade
import io.github.aahh.mediamanager2.tv.api.ServerClient

/**
 * Pictures from our own server (`/api/images/…`): posters, fanart and Plex list collages. They load through the
 * server client's OkHttp, so they carry the session cookie and keep its https-only rule.
 */
class ServerImages(context: Context, private val client: ServerClient) {
    val loader: ImageLoader = ImageLoader.Builder(context)
        .components { add(OkHttpNetworkFetcherFactory(callFactory = { client.http })) }
        .crossfade(true)
        .build()

    /** The full address of a server path; null for anything that is not a path on our server. */
    fun url(path: String): String? = if (path.startsWith("/") && !path.startsWith("//")) client.url(path).toString() else null
}

/** Set by the navigation once there is a server; null before then, when pictures show nothing. */
val LocalServerImages = staticCompositionLocalOf<ServerImages?> { null }

/** A picture from our server at [path], filling [modifier]; nothing while it loads, when it fails or when [path] is null. */
@Composable
fun ServerImage(path: String?, modifier: Modifier = Modifier, contentScale: ContentScale = ContentScale.Crop) {
    val images = LocalServerImages.current ?: return
    val url = path?.let(images::url) ?: return
    AsyncImage(model = url, contentDescription = null, imageLoader = images.loader, modifier = modifier, contentScale = contentScale)
}
