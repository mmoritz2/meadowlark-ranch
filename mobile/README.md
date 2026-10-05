# Meadowlark Ranch: native development foundation

This directory packages the existing game as an offline Capacitor 8 iOS app. It includes an Xcode project, a reproducible local web bundle, native save storage, and lifecycle hooks. It is **not an App Store release**. No native archive, signing, simulator run, or physical-device test has been performed. This machine has Apple command-line tools but not Xcode.

## Build locally

Use Node 22 or later. From this directory:

```sh
npm ci
npm test
npm run stage
npm run verify
npm run ios:sync
npm run release:check
```

The last command deliberately exits unsuccessfully while release evidence is missing. After installing Xcode 26 or later, open `ios/App/App.xcodeproj`, select an owned bundle identifier and development team, and build on a device. The iOS deployment target is 16.4 because the game's import maps require that WebKit version. Landscape orientation is configured for iPhone and iPad. The current bundle identifier is an unregistered development placeholder.

`npm run stage` copies a conservative runtime bundle into ignored `www/`, bundles the native bootstrap with esbuild, and writes `bundle-manifest.json` with file sizes and SHA-256 hashes. Only a directory marked as generated is replaced. `npm run ios:sync` stages the current game source again and copies it into the ignored iOS `public/` directory. Re-run sync after game edits. Never add a production `server.url` pointing at the website.

The staged-browser smoke can be run with the installed Playwright path:

```sh
PLAYWRIGHT_PATH=/path/to/playwright node scripts/smoke.cjs
```

It uses an isolated browser profile, denies external HTTP requests, traps WebSockets, loads the approved horse, opens the primary panels, checks save reload and lifecycle behavior, and writes ignored `verification/` artifacts. A browser pass does not establish native plugin behavior, device performance, or App Review acceptance.

## Source integration

The source game and website are unchanged by staging. `scripts/stage.mjs` adapts **generated copies only** and fails if key integration points move:

- Add `native-bootstrap.js` before the game module, then await `window.MeadowlarkNative.ready` before running that module. A native storage read failure blocks startup rather than silently replacing an existing ranch.
- Route the game's registered local-storage keys through `window.MeadowlarkNative.storage`, whose API is synchronous after hydration.
- Use `await MeadowlarkNative.reload()` after imports. It waits for verified durable writes before navigating. Confirmed reset uses `storage.clear()` followed by the same barrier; it clears registered save, photo, and feature keys and removes their recovery copies.
- Keep `SOCIAL=false` and skip the six social/club feature installers in this native edition. Existing named profiles must not reconnect to the public MQTT broker. The website retains its current social behavior.
- Start new native saves at the existing Medium graphics preset. Preserve any saved quality choice. Device profiling is still required.
- Attach pause/resume hooks through `MeadowlarkNative.attachGame({pause,resume})` after the game initializes. Pause stops the render loop, releases input and audio, and flushes saves; resume resets the clock before rendering. Background and foreground events also emit `meadowlark:pause` and `meadowlark:resume`.

The bridge is deliberately small. If boot, feature-installation, storage, or input APIs change, update the staging adapter and repeat verification. It does not claim to suspend every future timer or background task automatically.

## Save behavior

The native backend uses the official Filesystem plugin in iOS's persistent Library directory, with `meadowlark-save-a.json` and `meadowlark-save-b.json`. It never writes to the user's Safari storage or existing browser profile. A first native installation may migrate only the same app WebView's registered keys; Safari and the native app have separate origins, so Safari progress requires an explicit export/import.

Registered keys are listed in `src/save-store.mjs`: the main ranch, photo journal, VR control preference, tutorial hint, and two feature progress keys. Unknown writes fail explicitly. Add new legitimate keys to that list when adding a saving feature.

Writes are coalesced, serialized, checksummed, read back, and alternated between snapshots. Hydration chooses the newest valid revision. One intact snapshot recovers an interrupted write; two damaged snapshots or an unexpected read error stop startup and preserve files. Checksums detect corruption, not malicious editing. Reset clears both recovery slots before reload succeeds, including when it overlaps an older write. Errors display a retry action and do not report a successful save. The in-memory mirror can contain progress newer than disk until a flush finishes; sudden termination during that window can lose the most recent input. Device testing must cover termination, low storage, large photo saves, backgrounding, import/reset, and OS upgrades. Cross-device synchronization is not implemented.

The native privacy manifest declares the Filesystem plugin's file timestamp API reason `C617.1`. The bundled development edition has no analytics, tracking, account service, advertising, payments, or network social connection. This is an implementation description, not a published privacy policy or completed App Store disclosure.

## Exact runtime assets

`runtime-assets.json` includes the entire runtime asset tree, excluding authoring files, plus explicit review-directory dependencies. The approved white-western, bay-western, and bay-sporthorse native body GLBs remain byte-for-byte identical and are checked against pinned hashes. The motion files and rider remain the existing game assets. No model has been downloaded, replaced, or substituted for mobile packaging.

The first bundle is approximately 559 MiB. This intentionally conservative staging includes more than the initial scene needs, including approximately 192 MiB of legacy art under `assets/models/artist-breeds/`. A successful selected-horse smoke is not exhaustive proof of every breed's dynamic loading paths. Asset-size optimization and device memory/thermal tests are release work; removing files without checking dynamic asset paths is unsafe. The native horse profiles load three bodies from `review/native-trot-reference-kit/`, so an assets-only copy is incomplete.

## Release gates

`release-status.json` is an evidence checklist, and `npm run release:check` fails while any gate remains false. It does not technically prevent someone from manually archiving or publishing through Xcode. Do not mark gates complete without evidence.

Current blockers include suitable rights for WildMesh CC BY-NC horse derivatives and the CC BY-NC/NoAI Black Dragon, an owned bundle identifier, final native icon/branding, published privacy/support information, age-rating answers, signing/developer-account setup, a validated release archive, and physical-device acceptance. The current icon is a Capacitor development placeholder. A free listing alone does not establish that restricted assets are cleared for the planned distribution. Keep the current models for development; obtain suitable written rights or user approval for a specific replacement before release.

The app must retain its own Meadowlark name, artwork, UI expression, and world. Star Equestrian can inform quality goals and mechanics; this foundation does not authorize copying its branding or assets. Apple decides approval after reviewing the completed app.

If social features return, add a real moderation system, content filtering, reporting with human response, user blocking, support contact, and appropriate privacy disclosures before enabling them. If accounts or real-money digital goods are added, implement Apple's applicable account-deletion and purchase requirements before release.

Primary references: [Capacitor environment](https://capacitorjs.com/docs/getting-started/environment-setup), [Filesystem plugin](https://capacitorjs.com/docs/apis/filesystem), [WebKit import maps](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/), [Apple submission requirements](https://developer.apple.com/news/upcoming-requirements/?id=02032026a), [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), and [App privacy details](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy).
