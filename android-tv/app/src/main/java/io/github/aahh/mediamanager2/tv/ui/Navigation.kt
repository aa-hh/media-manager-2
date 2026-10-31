package io.github.aahh.mediamanager2.tv.ui

import android.content.Context
import android.content.pm.ApplicationInfo
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import io.github.aahh.mediamanager2.tv.api.ApiResult
import io.github.aahh.mediamanager2.tv.api.AuthApi
import io.github.aahh.mediamanager2.tv.api.BrowseApi
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.api.Playlist
import io.github.aahh.mediamanager2.tv.api.ServerClient
import io.github.aahh.mediamanager2.tv.downloads.DownloadsFeed
import io.github.aahh.mediamanager2.tv.ui.components.NavItem
import io.github.aahh.mediamanager2.tv.ui.components.SideMenuDivider
import io.github.aahh.mediamanager2.tv.ui.components.TvIcons
import io.github.aahh.mediamanager2.tv.ui.screens.AddressScreen
import io.github.aahh.mediamanager2.tv.ui.screens.AppDetailsScreen
import io.github.aahh.mediamanager2.tv.ui.screens.DiscoverScreen
import io.github.aahh.mediamanager2.tv.ui.screens.FilmScreen
import io.github.aahh.mediamanager2.tv.ui.screens.HomeScreen
import io.github.aahh.mediamanager2.tv.ui.screens.LibraryKind
import io.github.aahh.mediamanager2.tv.ui.screens.LibraryScreen
import io.github.aahh.mediamanager2.tv.ui.screens.LinkCodeScreen
import io.github.aahh.mediamanager2.tv.ui.screens.OfflineScreen
import io.github.aahh.mediamanager2.tv.ui.screens.PlayerScreen
import io.github.aahh.mediamanager2.tv.ui.screens.PlexListScreen
import io.github.aahh.mediamanager2.tv.ui.screens.ReleasesScreen
import io.github.aahh.mediamanager2.tv.ui.screens.SearchScreen
import io.github.aahh.mediamanager2.tv.ui.screens.SettingsScreen
import io.github.aahh.mediamanager2.tv.ui.screens.ShowScreen
import io.github.aahh.mediamanager2.tv.ui.screens.UpdatePrompt
import io.github.aahh.mediamanager2.tv.update.UpdateChecker
import io.github.aahh.mediamanager2.tv.update.UpdateState
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import okhttp3.OkHttpClient

/** Every place in the app. The FINAL frames each one is built from are listed on its screen. */
sealed interface Route

/** Decides where the app opens; never stays on screen. */
@Serializable data object StartupRoute : Route
/** [prefill] is the old address after Log out, with focus on Continue (T03c A6). */
@Serializable data class AddressRoute(val prefill: String? = null) : Route
@Serializable data object LinkCodeRoute : Route
@Serializable data object OfflineRoute : Route
@Serializable data object HomeRoute : Route
@Serializable data object TvRoute : Route
@Serializable data object FilmsRoute : Route
@Serializable data object SearchRoute : Route
@Serializable data object DiscoverRoute : Route
@Serializable data class PlexListRoute(val id: String, val title: String) : Route
@Serializable data object SettingsRoute : Route
@Serializable data object AppDetailsRoute : Route
/** A Radarr movie's title page. */
@Serializable data class FilmRoute(val movieId: Int) : Route
/** A Sonarr series' title page. */
@Serializable data class ShowRoute(val seriesId: Int) : Route
/** Pick a release for a movie (`radarr`, [id] a movie id) or an episode (`sonarr`, [id] an episode id). */
@Serializable data class ReleasesRoute(val service: String, val id: Int) : Route
/** Plays a title ([service] and [id] as the library names it), or a Plex list from its start ([playlistId], [shuffle]). */
@Serializable data class PlayerRoute(val service: String? = null, val id: Int? = null, val playlistId: String? = null, val shuffle: Boolean = false) : Route

/**
 * The app's screens and how they connect. Opens on Home; with no address on Address, with no session on the link code.
 * A 401 from the server at any time goes back to the link code. Back follows the interactions doc
 * (https://claude.ai/artifact/FnYdCGH4PvPRZAv6uPYbtg): on a top-level page it opens the side menu, from the menu it goes
 * to Home, and from Home's menu it leaves the app.
 */
@Composable
fun AppNavigation(session: AppSession, onLeave: () -> Unit) {
    val nav = rememberNavController()
    val scope = rememberCoroutineScope()
    var client by remember { mutableStateOf(session.client) }
    val menuOpen = rememberSaveable { mutableStateOf(false) }
    var playlists by remember { mutableStateOf(emptyList<Playlist>()) }
    var playlistsFor by remember { mutableStateOf<ServerClient?>(null) }
    var playlistsLoading by remember { mutableStateOf(false) }
    val feed = remember(client) { client?.let { DownloadsFeed.forServer(it, scope) } }
    val context = LocalContext.current
    val updates = remember { UpdateChecker(OkHttpClient(), installedVersionCode(context), isDebuggable(context)) }
    var updateState by remember { mutableStateOf<UpdateState>(UpdateState.Unknown) }
    var updateDismissed by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(Unit) { updateState = updates.checkNow() }
    LaunchedEffect(client) {
        client?.signedOut?.collect { signedOut ->
            if (signedOut) nav.navigate(LinkCodeRoute) {
                popUpTo(nav.graph.id) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    fun go(route: Route) = nav.navigateTo(route)

    // The side menu and Back for the pages it lists. Plex lists load after sign-in, in the app's own scope so leaving the
    // page doesn't cancel the read. A read that failed or found Plex unavailable is tried again on the next page.
    @Composable
    fun TopLevel(current: Route, content: @Composable () -> Unit) {
        val active = client
        LaunchedEffect(active) {
            if (active == null || playlistsFor == active || playlistsLoading) return@LaunchedEffect
            playlistsLoading = true
            scope.launch {
                val result = LibraryApi(active).playlists()
                playlistsLoading = false
                if (result is ApiResult.Ok && result.value.kind != "unavailable" && client == active) {
                    playlists = if (result.value.kind == "ok") result.value.playlists else emptyList()
                    playlistsFor = active
                }
            }
        }
        Shell(current, playlists, menuOpen, onNavigate = ::go, onLeave = onLeave, content = content)
    }

    NavHost(nav, startDestination = StartupRoute, modifier = Modifier.fillMaxSize().background(Tokens.background)) {
        composable<StartupRoute> {
            LaunchedEffect(Unit) {
                val active = client
                val next: Route = when {
                    active == null -> AddressRoute(session.address)
                    else -> when (val result = AuthApi(active).session()) {
                        is ApiResult.Ok -> HomeRoute
                        is ApiResult.Error -> if (result.status == 401) LinkCodeRoute else OfflineRoute
                        is ApiResult.Failed -> OfflineRoute
                    }
                }
                nav.navigate(next) {
                    popUpTo<StartupRoute> { inclusive = true }
                    launchSingleTop = true
                }
            }
        }
        composable<AddressRoute> { entry ->
            AddressScreen(prefill = entry.toRoute<AddressRoute>().prefill, onConnected = { origin ->
                client = session.useAddress(origin)
                nav.navigate(LinkCodeRoute) { popUpTo(nav.graph.id) { inclusive = true } }
            })
        }
        composable<LinkCodeRoute> {
            val active = client
            if (active == null) {
                LaunchedEffect(Unit) { nav.navigate(AddressRoute()) { popUpTo(nav.graph.id) { inclusive = true } } }
            } else {
                LinkCodeScreen(client = active, onSignedIn = {
                    active.signedIn()
                    menuOpen.value = false
                    nav.navigate(HomeRoute) { popUpTo(nav.graph.id) { inclusive = true } }
                })
            }
        }
        composable<OfflineRoute> {
            OfflineScreen(onRetry = { nav.navigate(StartupRoute) { popUpTo(nav.graph.id) { inclusive = true } } })
        }
        composable<HomeRoute> { signedIn(client) { TopLevel(HomeRoute) { HomeScreen(LibraryApi(it), BrowseApi(it), onNavigate = ::go) } } }
        composable<TvRoute> { signedIn(client) { TopLevel(TvRoute) { LibraryScreen(LibraryKind.Shows, LibraryApi(it), feed, onNavigate = ::go) } } }
        composable<FilmsRoute> { signedIn(client) { TopLevel(FilmsRoute) { LibraryScreen(LibraryKind.Films, LibraryApi(it), feed, onNavigate = ::go) } } }
        composable<SearchRoute> { signedIn(client) { TopLevel(SearchRoute) { SearchScreen(BrowseApi(it), onNavigate = ::go) } } }
        composable<DiscoverRoute> { signedIn(client) { TopLevel(DiscoverRoute) { DiscoverScreen(BrowseApi(it), onNavigate = ::go) } } }
        composable<PlexListRoute> { entry ->
            val route = entry.toRoute<PlexListRoute>()
            signedIn(client) { TopLevel(route) { PlexListScreen(route.id, route.title, LibraryApi(it), onNavigate = ::go) } }
        }
        composable<SettingsRoute> {
            signedIn(client) { active ->
                TopLevel(SettingsRoute) {
                    SettingsScreen(AuthApi(active), onOpenAppDetails = { go(AppDetailsRoute) }, onLoggedOut = {
                        menuOpen.value = false
                        nav.navigate(AddressRoute(session.address)) { popUpTo(nav.graph.id) { inclusive = true } }
                    })
                }
            }
        }
        composable<AppDetailsRoute> { AppDetailsScreen(onBack = { nav.popBackStack() }) }
        composable<FilmRoute> { entry ->
            signedIn(client) { FilmScreen(entry.toRoute<FilmRoute>().movieId, LibraryApi(it), feed, onNavigate = ::go) }
        }
        composable<ShowRoute> { entry ->
            signedIn(client) { ShowScreen(entry.toRoute<ShowRoute>().seriesId, LibraryApi(it), feed, onNavigate = ::go) }
        }
        composable<ReleasesRoute> { entry ->
            val route = entry.toRoute<ReleasesRoute>()
            signedIn(client) { ReleasesScreen(route.service, route.id, onDone = { nav.popBackStack() }) }
        }
        composable<PlayerRoute> { entry -> PlayerScreen(entry.toRoute<PlayerRoute>(), onClose = { nav.popBackStack() }) }
    }

    val state = updateState
    if (state is UpdateState.Available && !updateDismissed) UpdatePrompt(state.update, onLater = { updateDismissed = true })
}

// A signed-in page with no client cannot happen (no client means no address, which opens on Address), so it shows nothing.
@Composable
private fun signedIn(client: ServerClient?, content: @Composable (ServerClient) -> Unit) {
    if (client != null) content(client)
}

// Top-level pages replace each other above Home, so Back from any of them ends at Home; title pages and the player stack.
private fun NavHostController.navigateTo(route: Route) {
    val topLevel = route is HomeRoute || route is TvRoute || route is FilmsRoute || route is SearchRoute ||
        route is DiscoverRoute || route is PlexListRoute || route is SettingsRoute
    navigate(route) {
        if (topLevel) popUpTo<HomeRoute> { inclusive = route is HomeRoute }
        launchSingleTop = true
    }
}

private fun installedVersionCode(context: Context): Int =
    context.packageManager.getPackageInfo(context.packageName, 0).longVersionCode.toInt()

private fun isDebuggable(context: Context): Boolean = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

/**
 * The side menu (T03a A2; T03d C6 without Plex lists): Home, TV, Films, Search, Discover, then a divider and one item per
 * Plex list (both hidden when there are none), Settings at the bottom. Back on the page opens it; Back in it goes to
 * Home, and on Home leaves the app. Choosing an item closes it.
 */
@Composable
private fun Shell(
    current: Route,
    playlists: List<Playlist>,
    menuOpen: MutableState<Boolean>,
    onNavigate: (Route) -> Unit,
    onLeave: () -> Unit,
    content: @Composable () -> Unit,
) {
    val menuFocus = remember { FocusRequester() }
    BackHandler(enabled = !menuOpen.value) { menuOpen.value = true }
    BackHandler(enabled = menuOpen.value) { if (current is HomeRoute) onLeave() else onNavigate(HomeRoute) }
    LaunchedEffect(menuOpen.value) { if (menuOpen.value) runCatching { menuFocus.requestFocus() } }
    Row(Modifier.fillMaxSize()) {
        if (menuOpen.value) {
            Column(
                Modifier.width(240.dp).fillMaxHeight().background(Tokens.card).padding(vertical = 32.dp, horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                val choose = { route: Route ->
                    menuOpen.value = false
                    onNavigate(route)
                }
                NavItem("Home", TvIcons.Home, current is HomeRoute, expanded = true, onClick = { choose(HomeRoute) }, modifier = Modifier.focusRequester(menuFocus))
                NavItem("TV", TvIcons.Tv, current is TvRoute, expanded = true, onClick = { choose(TvRoute) })
                NavItem("Films", TvIcons.Movie, current is FilmsRoute, expanded = true, onClick = { choose(FilmsRoute) })
                NavItem("Search", TvIcons.Search, current is SearchRoute, expanded = true, onClick = { choose(SearchRoute) })
                NavItem("Discover", TvIcons.Explore, current is DiscoverRoute, expanded = true, onClick = { choose(DiscoverRoute) })
                if (playlists.isNotEmpty()) {
                    SideMenuDivider(Modifier.padding(vertical = 12.dp))
                    for (list in playlists) {
                        val route = PlexListRoute(list.id, list.title)
                        NavItem(list.title, TvIcons.PlaylistPlay, current == route, expanded = true, onClick = { choose(route) })
                    }
                }
                Spacer(Modifier.weight(1f))
                NavItem("Settings", TvIcons.Settings, current is SettingsRoute, expanded = true, onClick = { choose(SettingsRoute) })
            }
        }
        Box(Modifier.weight(1f).fillMaxHeight()) { content() }
    }
}
