package io.github.aahh.mediamanager2.tv.ui

import android.content.Context
import android.content.pm.ApplicationInfo
import android.view.SoundEffectConstants
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.focusTarget
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import androidx.tv.material3.DrawerState
import androidx.tv.material3.DrawerValue
import androidx.tv.material3.Icon
import androidx.tv.material3.ModalNavigationDrawer
import io.github.aahh.mediamanager2.tv.api.ApiResult
import io.github.aahh.mediamanager2.tv.api.AuthApi
import io.github.aahh.mediamanager2.tv.api.BrowseApi
import io.github.aahh.mediamanager2.tv.api.LibraryApi
import io.github.aahh.mediamanager2.tv.api.ServerClient
import io.github.aahh.mediamanager2.tv.downloads.DownloadsFeed
import io.github.aahh.mediamanager2.tv.downloads.DownloadsState
import io.github.aahh.mediamanager2.tv.downloads.menuDownloads
import io.github.aahh.mediamanager2.tv.ui.components.DateTile
import io.github.aahh.mediamanager2.tv.ui.components.DownloadsRing
import io.github.aahh.mediamanager2.tv.ui.components.NavGroupLabel
import io.github.aahh.mediamanager2.tv.ui.components.NavItem
import io.github.aahh.mediamanager2.tv.ui.components.SideMenuScrim
import io.github.aahh.mediamanager2.tv.ui.components.TvIcons
import io.github.aahh.mediamanager2.tv.ui.screens.AddressScreen
import io.github.aahh.mediamanager2.tv.ui.screens.AppDetailsScreen
import io.github.aahh.mediamanager2.tv.ui.components.LocalServerImages
import io.github.aahh.mediamanager2.tv.ui.components.ServerImages
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
import java.time.LocalDate
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
/**
 * Plays a title ([service] and [id] as the library names it; [ratingKey] is the Plex item to start and [resume] asks Plex
 * to resume it), or a Plex list from its start ([playlistId], [shuffle]).
 */
@Serializable data class PlayerRoute(
    val service: String? = null,
    val id: Int? = null,
    val ratingKey: String? = null,
    val resume: Boolean = false,
    val playlistId: String? = null,
    val shuffle: Boolean = false,
) : Route

/**
 * The app's screens and how they connect. Opens on Home; with no address on Address, with no session on the link code.
 * A 401 from the server at any time goes back to the link code. Back goes back one screen: on a main page it lands on
 * Home, on Home it leaves the app, and with the side menu open it closes the menu. Holding Back goes to Home from any
 * signed-in page but the player; MainActivity hears the hold.
 */
@Composable
fun AppNavigation(session: AppSession, onLeave: () -> Unit, onHoldBack: ((() -> Boolean)?) -> Unit) {
    val nav = rememberNavController()
    val scope = rememberCoroutineScope()
    var client by remember { mutableStateOf(session.client) }
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

    DisposableEffect(nav) {
        onHoldBack {
            val destination = nav.currentDestination
            when {
                destination == null -> false
                destination.hasRoute<PlayerRoute>() || destination.hasRoute<StartupRoute>() ||
                    destination.hasRoute<AddressRoute>() || destination.hasRoute<LinkCodeRoute>() ||
                    destination.hasRoute<OfflineRoute>() -> false
                else -> {
                    if (!destination.hasRoute<HomeRoute>()) nav.navigateTo(HomeRoute)
                    true
                }
            }
        }
        onDispose { onHoldBack(null) }
    }

    // A main page with the side menu over it. Back on Home leaves the app; on any other main page it returns to Home, the
    // only page under it.
    @Composable
    fun TopLevel(current: Route, content: @Composable () -> Unit) {
        Shell(
            current,
            feed,
            onNavigate = ::go,
            onBack = { if (current is HomeRoute) onLeave() else nav.popBackStack() },
            content = content,
        )
    }

    val images = remember(client) { client?.let { ServerImages(context, it) } }
    CompositionLocalProvider(LocalServerImages provides images) {
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
                        nav.navigate(HomeRoute) { popUpTo(nav.graph.id) { inclusive = true } }
                    }, onChangeAddress = {
                        nav.navigate(AddressRoute(session.address)) { popUpTo(nav.graph.id) { inclusive = true } }
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
            composable<DiscoverRoute> { signedIn(client) { TopLevel(DiscoverRoute) { DiscoverScreen(BrowseApi(it), LibraryApi(it), onNavigate = ::go) } } }
            composable<PlexListRoute> { entry ->
                val route = entry.toRoute<PlexListRoute>()
                signedIn(client) { TopLevel(route) { PlexListScreen(route.id, route.title, LibraryApi(it), onNavigate = ::go) } }
            }
            composable<SettingsRoute> {
                signedIn(client) { active ->
                    TopLevel(SettingsRoute) {
                        SettingsScreen(AuthApi(active), onOpenAppDetails = { go(AppDetailsRoute) }, onLoggedOut = {
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
 * The side menu (T04) over a main page: Search, Discover; under "Watch": Home, Films, TV, Calendar; under "Manage":
 * Library, Downloads, Settings. At rest it is the column of icons; it opens over the page, which never moves, while focus
 * is in it, and focus always enters it on Home. The menu rows can take focus only while Shell opens the menu, so it never
 * opens by itself. Left opens it when nothing further left can take focus, when nothing on the page holds focus, and
 * when held anywhere. Right or Back puts focus back on the page, which closes the menu: on the item the user left, where a
 * focusRestorer remembers it. If the page has nothing to take focus, Right does nothing and Back goes back instead. Back
 * never opens the menu. An empty box beside the page takes focus when nothing on the page can. It sits beside the page
 * and never around it, because a focusable box around the page swallows the Back key. Calendar, Library and Downloads
 * have no page yet: they take focus and do nothing.
 */
@Composable
private fun Shell(
    current: Route,
    feed: DownloadsFeed?,
    onNavigate: (Route) -> Unit,
    onBack: () -> Unit,
    content: @Composable () -> Unit,
) {
    val drawer = remember { DrawerState() }
    val homeFocus = remember { FocusRequester() }
    val pageFocus = remember { FocusRequester() }
    val pageSelfFocus = remember { FocusRequester() }
    var menuFocusable by remember { mutableStateOf(false) }
    var pageSelfFocused by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    val view = LocalView.current
    fun openMenu(): Boolean {
        menuFocusable = true
        val opened = runCatching { homeFocus.requestFocus() }.getOrDefault(false)
        if (!opened) menuFocusable = false
        return opened
    }
    BackHandler {
        val closed = drawer.currentValue == DrawerValue.Open && runCatching { pageFocus.requestFocus() }.getOrDefault(false)
        if (!closed) onBack()
    }
    if (feed != null) {
        DisposableEffect(feed) {
            feed.acquire()
            onDispose { feed.release() }
        }
    }
    val snapshot = (feed?.state?.collectAsState()?.value as? DownloadsState.Ready)?.snapshot
    val downloads = remember(snapshot) { snapshot?.let { menuDownloads(it) } }
    val today = remember { LocalDate.now().dayOfMonth }
    LaunchedEffect(Unit) {
        if (!view.hasFocus()) runCatching { pageSelfFocus.requestFocus() }
    }
    LaunchedEffect(pageSelfFocused) {
        if (pageSelfFocused) runCatching { pageFocus.requestFocus() }
    }

    ModalNavigationDrawer(
        drawerContent = { value ->
            val expanded = value == DrawerValue.Open
            Column(
                Modifier
                    .padding(start = 36.dp, top = 27.dp)
                    .onPreviewKeyEvent { event ->
                        val right = event.type == KeyEventType.KeyDown && event.key == Key.DirectionRight
                        if (right) runCatching { pageFocus.requestFocus() }
                        right
                    }
                    .onFocusChanged { if (!it.hasFocus) menuFocusable = false }
                    .focusProperties { onEnter = { homeFocus.requestFocus() } }
                    .focusGroup()
                    // After focusGroup so it applies to the rows, not to the group.
                    .focusProperties { canFocus = menuFocusable },
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    NavItem("Search", { Icon(TvIcons.Search, null, tint = it) }, current is SearchRoute, expanded, onClick = { onNavigate(SearchRoute) })
                    NavItem("Discover", { Icon(TvIcons.Explore, null, tint = it) }, current is DiscoverRoute, expanded, onClick = { onNavigate(DiscoverRoute) })
                }
                Box(Modifier.height(39.dp)) { if (expanded) NavGroupLabel("Watch", Modifier.padding(start = 16.dp, top = 13.dp)) }
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    NavItem(
                        "Home", { Icon(TvIcons.Home, null, tint = it) }, current is HomeRoute, expanded, onClick = { onNavigate(HomeRoute) },
                        modifier = Modifier.focusRequester(homeFocus),
                    )
                    NavItem("Films", { Icon(TvIcons.Movie, null, tint = it) }, current is FilmsRoute, expanded, onClick = { onNavigate(FilmsRoute) })
                    NavItem("TV", { Icon(TvIcons.Tv, null, tint = it) }, current is TvRoute, expanded, onClick = { onNavigate(TvRoute) })
                    NavItem("Calendar", { DateTile(today, it) }, selected = false, expanded = expanded, onClick = {})
                }
                Box(Modifier.height(39.dp)) { if (expanded) NavGroupLabel("Manage", Modifier.padding(start = 16.dp, top = 13.dp)) }
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    NavItem("Library", { Icon(TvIcons.Library, null, tint = it) }, selected = false, expanded = expanded, onClick = {})
                    NavItem("Downloads", { DownloadsRing(downloads, it) }, selected = false, expanded = expanded, onClick = {})
                    NavItem("Settings", { Icon(TvIcons.Settings, null, tint = it) }, current is SettingsRoute, expanded, onClick = { onNavigate(SettingsRoute) })
                }
            }
        },
        modifier = Modifier.fillMaxSize(),
        drawerState = drawer,
        scrimBrush = SideMenuScrim,
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .onPreviewKeyEvent { event ->
                    val held = event.type == KeyEventType.KeyDown && event.key == Key.DirectionLeft && event.nativeKeyEvent.repeatCount > 0
                    if (held) openMenu()
                    held
                }
                .onKeyEvent { event ->
                    if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                    when (event.key) {
                        Key.DirectionLeft -> {
                            val moved = !pageSelfFocused && focusManager.moveFocus(FocusDirection.Left)
                            if (moved || openMenu()) view.playSoundEffect(SoundEffectConstants.NAVIGATION_LEFT)
                            true
                        }
                        Key.DirectionRight, Key.DirectionUp, Key.DirectionDown -> {
                            if (pageSelfFocused) runCatching { pageFocus.requestFocus() }
                            pageSelfFocused
                        }
                        else -> false
                    }
                },
        ) {
            Box(
                Modifier
                    .fillMaxSize()
                    .focusRequester(pageSelfFocus)
                    .onFocusChanged { pageSelfFocused = it.isFocused }
                    .focusTarget(),
            )
            Box(
                Modifier
                    .fillMaxSize()
                    .focusRequester(pageFocus)
                    .focusRestorer()
                    .focusGroup(),
            ) { content() }
        }
    }
}
