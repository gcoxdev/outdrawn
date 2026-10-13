# Mobile and offline verification

`npm run test:mobile` runs repeatable Chromium/Pixel 7 and WebKit/iPhone 13 emulation. It covers touch decisions, readable selected-card rules, keyboard dialog focus, private handoff, nested events, local restoration, and an explicit code/art update followed by offline launch with the origin server stopped.

The Chromium run applies a shared server-side 4 Mbps transfer budget with 150 ms latency, including service-worker downloads. The optimized release precaches about 15.4 MiB; the measured initial run completed in about 37 seconds, transferring about 17.8 MB including page and worker requests. The test uses a two-minute regression ceiling under that model. This is a reproducible laboratory budget, not a measured phone/network promise.

Playwright emulates device parameters and uses its own WebKit build. It does not run Apple's shipped Safari or reproduce iOS home-screen installation. See [Playwright browser support](https://playwright.dev/docs/browsers) and [device emulation](https://playwright.dev/docs/emulation).

## Physical-device acceptance

Physical Android and iOS checks remain unperformed. Record device model, OS/browser version, origin, build version, and elapsed installation time with the results. Use a disposable test match when exercising reset or update flows.

1. Build and serve the complete `dist/` over [trusted LAN HTTPS](lan-pwa-https-hosting.md). Confirm the phone sees no certificate warning.
2. Open the app with a fresh browser origin/storage state. Keep it online until its offline copy finishes. Use the browser's home-screen/install option and launch from that icon. Record the cold-install time and network conditions.
3. Start a three-human match. Select a card and read its rules without horizontal scrolling. Play an attack, hand the device to the defender, and confirm that private cards stay hidden until **Reveal Hand**.
4. Open/close the menu and rotate the phone. Check controls, overlays, scrolling, readable rules, and the on-screen keyboard if editing player names.
5. Reload during a pending choice. Confirm that the same choice returns and hands are hidden again. Close and reopen the installed app and check restoration.
6. Disable network access or stop the host. Relaunch from the installed icon and verify gameplay and card artwork, not only the lobby.
7. Return online and deploy a second complete build with a visible text or artwork change. During a match, confirm that update application is disabled. Finish the test match or return to the lobby, choose **Check Updates**, then **Apply Update and Reload**.
8. Disable the network again and relaunch. Confirm the updated UI/art and saved-state behavior. Record pass/fail and screenshots for any layout or installation issue.

Keep results under gitignored `internal/`. Do not mark these physical-device checks passed based on viewport emulation alone.

## Artwork generation

Builds generate WebP using [Sharp's lossless output option](https://sharp.pixelplumbing.com/api-output/#webp), preserving full image resolution. Source/output hashes detect changed originals and damaged generated files. Originals remain the source of truth; edit them and run `npm run build` to regenerate the release. Icons remain PNG for the app manifest and touch icon.
