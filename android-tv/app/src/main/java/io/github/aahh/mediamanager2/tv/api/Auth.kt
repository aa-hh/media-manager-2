package io.github.aahh.mediamanager2.tv.api

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

// Field names are copied from src/server/app.ts and auth.ts; there is no shared schema with the TypeScript server.

/** `GET /auth/status` (`auth.ts` status). */
@Serializable
data class AuthStatus(val configured: Boolean, val pending: Boolean = false, val firstRun: Boolean = false, val provider: String? = null)

/** `GET /api/session`. */
@Serializable
data class SessionInfo(val expiresAt: Long, val serverNow: Long, val mediaServer: String)

/** `POST /auth/link/start` 201: the code to show and when it stops working (server time, ms). */
@Serializable
data class LinkCode(val code: String, val expiresAt: Long)

/** `POST /auth/link/complete`: 202 `{status:'pending'}`, or 200 `{expiresAt}` with the session cookie. */
@Serializable
data class LinkProgress(val status: String? = null, val expiresAt: Long? = null)

/** `POST /api/device-logs` 201. */
@Serializable
data class DeviceLogReference(val reference: String)

@Serializable
private data class LinkStartBody(val deviceName: String)

@Serializable
private data class DeviceLogBody(val appVersion: String, val log: String)

/** The sign-in, session and Settings routes of our server. */
class AuthApi(private val client: ServerClient) {
    suspend fun status(): ApiResult<AuthStatus> = client.get("/auth/status", AuthStatus.serializer())

    suspend fun session(): ApiResult<SessionInfo> = client.get("/api/session", SessionInfo.serializer())

    suspend fun linkStart(deviceName: String): ApiResult<LinkCode?> =
        client.post("/auth/link/start", client.json.encodeToString(LinkStartBody(deviceName)), LinkCode.serializer())

    suspend fun linkComplete(): ApiResult<LinkProgress?> = client.post("/auth/link/complete", "{}", LinkProgress.serializer())

    suspend fun cancel(): ApiResult<Unit?> = client.post<Unit>("/auth/cancel", "{}", null)

    /** Settings → Log out: ends only this TV's session, then forgets the cookie whatever the server said. */
    suspend fun logout(): ApiResult<Unit?> = client.post<Unit>("/auth/logout", "{}", null).also { client.cookies.clear() }

    /** Settings → Get logs: [log] must already be scrubbed (`log/Scrub.kt`). */
    suspend fun sendLog(appVersion: String, log: String): ApiResult<DeviceLogReference?> =
        client.post("/api/device-logs", client.json.encodeToString(DeviceLogBody(appVersion, log)), DeviceLogReference.serializer())
}
