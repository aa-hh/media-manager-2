# Plex terms: can the app play video through Plex?

Researched 14 Oct 2026. This is research, not legal advice. Nobody here is a lawyer, and Plex's terms are a contract under Delaware law that only a court or Plex itself can settle.

Builds on [media-servers.md](media-servers.md), section 1 ("Plex", "Terms of service"). That section quoted four clauses; this file checks them against the live pages, adds the rest, and looks at how Plex has acted.

"PMS" below means Plex Media Server, the server program running on the Whatbox slot. "API" means the set of web addresses (endpoints) a program calls to talk to PMS. A "token" is the sign-in key a program sends with each call.

## Bottom line

- **The player itself: green.** A private player for one person, on the owner's own Plex account with a lifetime Plex Pass, using Plex's published API, is what Plex invited when it published that API in September 2025. Several third-party players have done this for years, some for money, and none has been shut down that I could find.
- **The setup as a whole: amber**, for a reason that exists with or without the player. The terms now say PMS may run only "on a device or hardware that you own", and a rented Whatbox slot isn't owned. Plex has acted on this once, against a whole hosting company (Hetzner, 2023). It has never acted against Whatbox that I could find.
- **What would push it to red:**
  1. Publishing the app so that people *without* a Plex Pass can stream remotely through it. If our server relays the video, PMS sees the request as coming from the same machine (local) and skips its September 2026 paywall check. For the owner this changes nothing, since the owner pays. For anyone else it is "obtaining Plex Pass functionality without a valid Plex Pass", which the terms forbid by name.
  2. Copying Plex's own web app (its code or its look), or building on calls found by watching Plex's apps rather than on the published API.

## 1. The clauses, quoted from the live pages

### Plex Terms of Service

Source: [plex.tv/about/privacy-legal/plex-terms-of-service](https://www.plex.tv/about/privacy-legal/plex-terms-of-service/), fetched 14 Oct 2026. Header: "Revised October 30, 2025". The section names below are the page's own headings; the page has no section numbers.

**Who the licence is for** (License, "General Plex Solution Grant"):
> "a personal (non-commercial), revocable, limited, non-exclusive, nontransferable, and non-sublicensable license to access and use the Plex Solution"

"Plex Solution" is defined at the top as "the Plex website, a Plex software, mobile, or web application(s), or any related Plex service(s)".

**"Substantially the same functionality"** (License, "Additional License Restrictions"):
> "you shall not directly or indirectly (a) use the Plex Solution to create any service, software or documentation that performs substantially the same functionality as the Plex Solution, (b) disassemble, decompile, reverse-engineer, or use any other means to attempt to discover any source code, algorithms, trade secrets, or applications underlying the Plex Solution or any of its tools, content, or features, (c) encumber, sublicense, transfer, distribute, rent, lease, time-share, or use the Plex Solution in any service bureau arrangement or otherwise for the benefit of any third party, (d) adapt, combine, create derivative works of, or otherwise modify the Plex Solution, (e) disable, circumvent, or otherwise avoid or undermine any security device, mechanism, protocol, or procedure implemented in the Plex Solution, [...] or (h) use the Plex Solution in any manner which could damage, disable, overburden, or impair the Plex Solution"

**"Device or hardware that you own"** (License, "PMS Software Download(s)"):
> "You may only use the PMS Software: (i) on a device or hardware that you own; (ii) to add Content (defined below) to that PMS Software; and (iii) and as a part of your use of the Plex Solution or other Plex service."

**"Storage that you own"** (License, "Content Available Through the Plex Solution"):
> "You are expressly prohibited from engaging in or facilitating the unauthorized sharing or distribution of Content. For that reason, Content available on your PMS Software must be on storage that you own."

**Interfacing Software** (License, "Interfacing Software"), the definition in full:
> "'Interfacing Software' means any software that you obtain or provide and that accesses or calls any PMS Software provided by Plex as part of the Plex Solution including, but not limited to, plug-ins for the Plex Solution, channel plug-ins, metadata agents, and client applications that communicate directly or indirectly with the Plex Solution. You are responsible and liable for any Interfacing Software, including any data collection that may be undertaken or occur through the Interfacing Software."

The same section goes on to say that "By making, or assisting others in making, available any Interfacing Software", you grant Plex a worldwide, royalty-free licence to use, copy, distribute and promote it, and you agree to "provide and include (or link to) a privacy notice" and to "include in the source code of the Interfacing Software a copyright notice of the form: Copyright © <year> <copyright holders>". You can ask Plex to stop using your software, with "a transition period of at least thirty (30) days".

**Plex Pass** (License, "Restrictions"):
> "Plex expressly prohibits you and any third parties from: (i) selling or purchasing access to the Plex Solution or to any other service that makes improper and unauthorized use of the Plex Solution in violation of these TOS; (ii) distributing all or part of the Plex Solution; (iii) replicating any exclusive Plex Pass functionality as described here; or (iv) obtaining Plex Pass functionality without a valid Plex Pass."

"As described here" links to [plex.tv/plex-pass](https://www.plex.tv/plex-pass/).

**Security and enforcement** (User Obligations, "Enforcing Security" and "Generally"):
> "accessing or using Plex data, systems, or networks in an unauthorized manner, [...] circumventing any Plex security or authentication measures [...] using any false, misleading, or deceptive TCP-IP packet header information"

> "If you violate this TOS, Plex has sole discretion to suspend or permanently disable your access to the Plex Solution, and we may permanently disable or delete your account or prohibit you from creating a new account."

"Term and Termination" adds that termination "shall result in deactivation or deletion of your account with Plex".

### What changed, and when

I compared against archived copies on the Wayback Machine. A copy from Feb 2024 ([archive](http://web.archive.org/web/20240223233544/https://www.plex.tv/about/privacy-legal/plex-terms-of-service/)), headed "Revised June 6, 2023", says:

> "You may only use the PMS Software on a device or hardware that you own or control"

The June 2023 version has the Interfacing Software definition in nearly the same words. It has none of: the "Additional License Restrictions" list (so no "substantially the same functionality" and no reverse-engineering clause), the "storage that you own" sentence, or the two Plex Pass prohibitions. Its "Restrictions" clause only barred "third parties from selling or purchasing access to the Plex Solution". A Jan 2020 copy also says "own or control".

So the hardware clause dropped "or control" and the other restrictions arrived at some point between June 2023 and 30 Oct 2025. The archived Sept 2025 copy didn't load, so I couldn't pin the exact revision (unverified).

### Developer pages and the API reference

- [developer.plex.tv](https://developer.plex.tv/) has no separate developer terms. `/terms` and `/pms/terms` both return 404. The landing page says Plex is "not officially reviewing, approving, or endorsing community developer-built tools at this time".
- The API reference at [developer.plex.tv/pms](https://developer.plex.tv/pms/) (version 1.2.3, for PMS 1.43.4 or later) carries one licence: `"license":{"name":"Apache 2.0"}` in its OpenAPI header. Its intro says nothing about terms, permitted uses or Plex Pass.
- Apache 2.0 covers the **document**: we may copy, change and redistribute the spec, for example to generate a typed client from it. It grants nothing about **using PMS**. That is still governed by the Terms of Service above.
- The reference describes which calls are official: "paths that aren't documented here aren't part of the API contract, they just happen to exist". It lists the `X-Plex-*` headers a client sends, including `X-Plex-Product`, `X-Plex-Client-Identifier` ("typically required") and `X-Plex-Pms-Api-Version` ("If no header is provided, the version `0.0` is assumed").

### The September 2025 announcement

- [Forum post, 15 Sep 2025](https://forums.plex.tv/t/public-api-docs-for-pms-are-here/930957), by the Plex staff account @PlexInfo, lists as its audience "Third-party clients that want to play content from a PMS." It says Plex is "not planning on vetting or giving official 'Stamps of Approval' on developer-built tools". It says nothing about terms.
- [Blog post, 21 Sep 2025](https://www.plex.tv/blog/plex-pro-week-25-api-unlocked/), by Plex engineers Kevin Wanke and Marcelo: "The release of the PMS API documentation is a starting point for this path that all are welcome to use. If we don't have the solution that fits your exact use case, then this might be where you can explore finding or creating that solution."

## 2. How each clause applies to this app

The app: one user (the owner), the owner's own Plex account with a lifetime Plex Pass, PMS on a rented Whatbox slot, our own web player calling PMS for playback, track choice and progress (`/:/timeline`). Not sold. Might be published as open source one day.

| Clause | Reading for this app | Verdict |
|---|---|---|
| Interfacing Software | A "client application" that calls PMS is named in the definition. The terms treat such software as allowed, with duties attached: the maker is liable for it, and if it's "made available", it needs a copyright notice in the source and a privacy notice. Private use isn't "making available". Publishing it would trigger the notices and the licence grant to Plex. | Fine. Add the notices before publishing. |
| Personal, non-commercial licence | One owner, no money changing hands. | Fine. |
| (a) "substantially the same functionality as the Plex Solution" | The Plex Solution is Plex's whole product: website, apps, servers and services. Our app manages Sonarr, Radarr and torrents and adds a player; it doesn't replace Plex. Read literally, the clause would also catch every third-party player, but the definition of Interfacing Software names "client applications", and Plex's own announcement invited "third-party clients that want to play content". A court would be unlikely to read one clause to forbid what another clause and Plex's own invitation allow. The clause reads as aimed at products that rebuild Plex's service using Plex itself. | Grey, low. Using the API as a client, not building a rival service. |
| (b) Reverse engineering | Using the published API isn't reverse engineering. Two playback calls the earlier research found only in community clients (the transcode keep-alive `ping` and `stop` calls, see [media-servers.md](media-servers.md) "Not documented") were found by others watching Plex's traffic. Calling them is a much weaker case than decompiling PMS, but it is outside the published contract. | Fine for documented calls. Grey for the two undocumented ones. |
| (c) "for the benefit of any third party" / "service bureau" | This bars running Plex as a service for other people. One owner using it for themselves isn't that. Offering the app as a hosted service to others would be. | Fine as planned. |
| (d) "adapt, combine, create derivative works of [...] the Plex Solution" | We don't modify PMS or ship Plex code. Copying parts of Plex's web app (its JavaScript, its player) would be a derivative work. | Fine if we write our own player. |
| (e) Circumventing a "security device, mechanism, protocol" | Signing in with Plex's own PIN flow and sending our real identity in the headers circumvents nothing. Relaying video through our server so PMS treats it as local is fine for the owner, who is entitled to remote playback anyway. Offered to people who aren't entitled, the same relay would get around the remote-playback check (see section 4). | Fine for the owner. Likely prohibited if offered to people without Plex Pass. |
| (h) "overburden" | One viewer at a time. Progress reports every 10 seconds is what the spec asks for. | Fine. |
| Restrictions (iii) "replicating any exclusive Plex Pass functionality" | Reading features Plex already computes (intro markers, for example) with the owner's Plex Pass is using Plex Pass, not copying it. Building our own version of a Plex Pass feature for non-Pass users would be copying it. | Fine as planned. |
| Restrictions (iv) "obtaining Plex Pass functionality without a valid Plex Pass" | The owner holds a lifetime Plex Pass, and the server reports `myPlexSubscription=true` (checked on the slot, see [media-servers.md](media-servers.md)). | Fine for this owner. Red trigger for a published version (section 4). |
| "device or hardware that you own" / "storage that you own" | Whatbox owns the machine and the disks. This breaks the literal wording, but it's about running PMS on the slot at all, which the owner already does. The player adds nothing to it. | Grey. Same exposure with or without the player. |
| Trademarks ([guidelines](https://www.plex.tv/about/privacy-legal/plex-trademarks-and-guidelines/)) | Allowed: saying the app "Works with Plex" and using the Plex logo "to show that your product is compatible with Plex". Not allowed: "Plex" in the app's name, a domain containing "Plex", a play-symbol icon in dark grey or orange, or copying "the Plex look and feel". | Fine if the player has its own look and the Plex logo only marks the Plex connection. |

## 3. Other apps that do this

Third-party players that stream video from PMS through its API, with their own interface:

| App | Status (checked 14 Oct 2026) | Notes |
|---|---|---|
| [Infuse](https://community.firecore.com/t/plex-integration-to-infuse/17509) (Firecore) | Operating. Paid app. Plex support since Infuse 5.7. | On 21 Sep 2026 Firecore [told users](https://community.firecore.com/t/changes-to-plex-remote-streaming-requirements/60825) that Plex had informed it remote streaming "will require a paid Plex license", including "videos played through 3rd-party apps like Infuse". Plex told Firecore about a paywall; it didn't tell Firecore to stop. |
| [Plezy](https://github.com/edde746/plezy) | Operating. Open source (GPL-3.0), last push 13 Oct 2026, 3,713 stars. Paid in the iOS App Store. | Plays Plex video with its own player. Hit Plex's remote check in Sept 2026 (section 4). |
| [PlexKodiConnect](https://github.com/croneter/PlexKodiConnect) | Operating. Last push 1 Apr 2026. | Plex inside Kodi, with Kodi's player. |
| [plex-for-kodi](https://github.com/pannal/plex-for-kodi) | Operating. Last push 11 Oct 2026. | Community continuation of Plex's own former Kodi add-on. |
| [PlxNative](https://www.androidauthority.com/lg-tv-slow-plex-app-plx-native-3712671) | New, covered 17 Sep 2026. | Independent Plex player for older LG TVs. |
| [Symfonium](https://docs.symfonium.app/wiki/providers/plex-media-provider-configuration/), [Prologue](https://prologue.audio) | Operating (Prologue's App Store listing shows 2026 updates). | Music and audiobooks, not video, but same API and same terms. |

Not found: "Plozzle" returned nothing. "Prism" matched only an old music app with Plex support whose status is unknown. Composite was not checked.

**Cease-and-desist letters or cut-offs:** I found none against a third-party Plex player. The breakages I found were accidents or business rules:

- Sept 2025: a Plex web update broke "Sign in with Plex" for third-party apps. Plex staff member @bengeorge [replied](https://forums.plex.tv/t/plex-oauth-authenticate-with-plex-broken-after-plex-web-update-v4-152-0/931098) on 17 Sep 2025: "Breaking auth on 3rd party apps was not intentional." and "testing 3rd party apps isn't easy in our test environments".
- Nov 2025: Plex [announced](https://forums.plex.tv/t/changes-coming-to-remote-streaming-on-roku/933671) (@PlexInfo, 19 Nov 2025) that the remote-playback paywall would reach "any third party clients using the API to offer remote streaming in 2026". It also said a server owner's Plex Pass "ensures all users accessing the Plex Media Server can stream remotely, without an additional charge." That arrived in Sept 2026 (above).

**Plex's stated stance**, in short: clients are welcome (the 2025 announcement and blog), not vetted or approved (developer site), and subject to the same remote-playback paywall as Plex's own apps (Nov 2025 and Sept 2026).

## 4. The September 2026 remote check, and why our design touches it

- Plezy issue [#2435](https://github.com/edde746/plezy/issues/2435) (23 Sep 2026): a user without Plex Pass lost remote playback. The maintainer replied: "Plex has added server-side checks, not a Plezy issue." He suggested Tailscale, or running Plex behind a reverse proxy (a web server that forwards requests, so PMS sees them as coming from the proxy).
- Issue [#2476](https://github.com/edde746/plezy/issues/2476) (26 Sep 2026) shows the check in PMS's own log: browsing and metadata succeed from a WAN (internet) address, and only the video request gets `403` (refused), in 1 ms.
- Plex's [support article](https://support.plex.tv/articles/requirements-for-remote-playback-of-personal-media/) defines remote as any time "the player app cannot make a connection to the Plex Media Server on the same subnet of the same local network", and lists the ways to pass: an admin Plex Pass "(which also allows remote playback for any other user streaming from that server)", your own Plex Pass, or a Remote Watch Pass.

What this means here:

- The owner's server admin account has a lifetime Plex Pass, so the check passes whichever way we connect. No problem today.
- The earlier research suggests routing Plex calls through our own server, since both run on the slot ([media-servers.md](media-servers.md), "CORS"). Then PMS sees every request as coming from the same machine, and the remote check never runs. For a Plex Pass owner that's harmless.
- For a published version used by someone *without* Plex Pass, the same design hands out remote playback Plex charges for. That is "obtaining Plex Pass functionality without a valid Plex Pass", and arguably circumventing a "procedure implemented in the Plex Solution" (clause (e)). Plezy's maintainer recommending a proxy workaround in public hasn't drawn a response from Plex that I could find, but that's no protection.
- Fix if published: check the server admin's Plex Pass (the `myPlexSubscription` flag the slot already reports) before turning on the player, and say why in the interface.

## 5. Seedboxes and "hardware you own"

Evidence that Plex enforces it:

- Sept 2023, Hetzner. Plex emailed users whose servers ran at the German host Hetzner that the server "appears to come from a service provider that hosts a significant number of Plex Media Servers that violate our Terms of Service", and that Plex would "block access and activity from Plex Media Servers hosted by that provider" ([TorrentFreak, 15 Sep 2023](https://torrentfreak.com/?p=240196)). The block began 12 Oct 2023 ([LowEndBox](https://lowendbox.com/blog/plex-blocks-hetzner-in-move-against-piracy)).
- Plex staff member @chrisc in the [Hetzner thread](https://forums.plex.tv/t/not-allowed-to-use-hetzner/853570), 14 Sep 2023: the server "was always designed and intended for users to host themselves at home", users "should move it to be hosted from home. (Or at least a different hosting provider.)", and hosting on a shared provider "could have unexpected consequences".
- At that time the terms still said "own or control". The narrower "own" came later.

Evidence that it doesn't:

- Whatbox offers Plex as a one-click install and its [Plex page](https://whatbox.ca/wiki/Plex) mentions no Plex terms issue. Ultra.cc and RapidSeedbox sell Plex hosting openly.
- I found no case of Plex blocking Whatbox, Ultra.cc or any named seedbox company, and no case of Plex acting against a single account for running on rented hardware.
- Plex's own remote-playback article lists "Running apps or servers inside a container/virtualization" as a known setup, without calling it forbidden.

Reading: Plex's one known action targeted a hosting company where it saw lots of terms violations (it never said which; press coverage assumed piracy and sharing), and cut off every server there at once. The risk is a provider-wide block of Whatbox, not action against this owner's account. The player doesn't change that risk: the slot runs PMS today. If Whatbox were blocked, PMS on the slot would stop working with or without our player.

## 6. Realistic worst case, and what lowers the risk

Most likely to least likely:

1. **An API change breaks the player.** Plex has broken third-party sign-in by accident once already (Sept 2025), and the undocumented `ping`/`stop` calls can change at any time. Cost: a fix on our side. Likely over a few years.
2. **Plex blocks Whatbox as a provider**, like Hetzner in 2023. PMS on the slot stops working entirely; the player is collateral. Unlikely but possible, and independent of the player.
3. **Plex blocks this app's identity.** PMS sees each app by `X-Plex-Product` and `X-Plex-Client-Identifier`, so Plex could refuse one product name. No sign Plex has done this to any client.
4. **Account action.** The terms allow suspending or deleting the account. I found no case of Plex doing this to someone for using a third-party player. Losing the account would also lose the lifetime Plex Pass, so this is the costly outcome, and the red triggers in the Bottom line are what would invite it.

The terms cap Plex's liability to the owner at $100 (or three months of payments), so there is no money to recover if any of this happens.

What lowers the risk:

- **Say who we are.** Send an honest `X-Plex-Product` (the app already sends `media-manager-2`, `src/server/auth.ts` line 164) and keep one fixed `X-Plex-Client-Identifier` per install for playback. Never pretend to be Plex Web or another Plex app (the terms bar "false, misleading, or deceptive TCP-IP packet header information"). The existing sign-in already uses Plex's recommended PIN and key-pair flow.
- **Stay on the published API.** Send `X-Plex-Pms-Api-Version`, use only calls in the reference, and replace the undocumented `ping`/`stop` calls with documented ones where possible (`/:/timeline` with `state=stopped` is documented).
- **Write our own player and look.** Use hls.js or similar, not Plex Web's code. No Plex-style orange play icon. Show the Plex logo only to mark the Plex connection.
- **Don't route around Plex Pass.** Fine for this owner. Before publishing, gate the player on the server admin's Plex Pass, and don't build our own versions of Plex Pass-only features.
- **If published:** add a copyright notice to the source and a privacy notice, as the Interfacing Software clause requires; keep "Plex" out of the app name; don't offer it as a hosted service for others.

## Could not verify

- Which revision between June 2023 and 30 Oct 2025 first said "own" instead of "own or control", and first added the "Additional License Restrictions". The Sept 2025 Wayback copy didn't load.
- Whether Plex has ever sent a cease-and-desist to a third-party client. None found in searches of news, Plex forums and GitHub, but a private letter wouldn't show up.
- Plex's reason for the Hetzner block beyond "violate our Terms of Service". Piracy is press inference, not a Plex statement.
- Whether the September 2026 check looks at anything besides the client's network address (product name, for example). Plezy's logs show only that the video request was refused from a WAN address.
- Status of "Plozzle", "Prism" (as a video client) and Composite.
