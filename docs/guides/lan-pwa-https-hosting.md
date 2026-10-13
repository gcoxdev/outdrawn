# LAN HTTPS PWA Hosting

Outdrawn can be installed as an offline PWA from another device on your local
network when the production build is served over trusted HTTPS.

## 1. Create a trusted local certificate

Install `mkcert`, then install its local certificate authority:

```bash
mkcert -install
```

Create the cert folder:

```bash
mkdir -p certs
```

Find your LAN IP. On Manjaro and most Linux distributions:

```bash
ip route get 1.1.1.1
```

Use the address after `src`, such as `192.168.1.50`.

On systems with GNU `hostname`, this may also work:

```bash
hostname -I
```

Generate a certificate for localhost and your LAN IP. Replace
`192.168.1.50` with your actual IP:

```bash
mkcert -cert-file certs/outdrawn.pem -key-file certs/outdrawn-key.pem localhost 127.0.0.1 192.168.1.50
```

The `certs/` folder is ignored by git.

## 2. Trust the certificate on other devices

The browser on each device must trust the mkcert local CA before PWA install
works cleanly.

On the host machine, print the CA folder:

```bash
mkcert -CAROOT
```

Copy the `rootCA.pem` file from that folder to the other device and install it
as a trusted certificate authority. The exact steps depend on the operating
system and browser.

Loading the page after accepting a certificate warning is not enough for PWA
install. The browser must consider the page a trusted secure context. If the
other device does not trust the mkcert CA, the app can load but service worker
registration and offline install can still be blocked.

## 3. Build and host

Create a production build:

```bash
npm run build
```

Serve the build over HTTPS:

```bash
npm run host:https
```

Open this from another trusted device on the same network:

```text
https://YOUR_LAN_IP:4173
```

Example:

```text
https://192.168.1.50:4173
```

## 4. Install and update

Use the browser's install option after opening the HTTPS URL. Outdrawn's PWA
controls can check for service worker updates while the device is online. A successful check downloads a complete new release. Use **Apply Update and Reload** from the lobby or after the match to activate it; updates do not interrupt an active match. Match state is saved in this browser and restored after ordinary reloads.

If the install option is unavailable:

- Confirm the page is using `https://`, not `http://`.
- Confirm the browser trusts the mkcert CA.
- Confirm the URL uses a name or IP included in the generated certificate.
- Rebuild and refresh after changing app files.

## Optional environment variables

The HTTPS host script defaults to `dist/`, port `4173`, and these files:

```text
certs/outdrawn.pem
certs/outdrawn-key.pem
```

Override them when needed:

```bash
PORT=8443 HTTPS_CERT=/path/cert.pem HTTPS_KEY=/path/key.pem npm run host:https
```

## Build and cache behavior

Always deploy the complete output of `npm run build`. Its preparation step produces lossless WebP artwork from the original PNGs. Its final step generates a content-versioned worker and offline manifest; running `vite build` alone does not complete that step. Critical download failures reject installation and keep the previous release usable. The first offline installation downloads approximately 15.4 MiB, so keep the page online until installation finishes.

The host returns 400 for malformed paths and 404 for absent files. Stable filenames revalidate; only hashed build assets receive immutable caching. Updating a card image changes the release version even when its filename stays the same.

The activation flow follows the browser's [worker state lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorker/state) and requests [skipWaiting](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting) only when applying a downloaded update.

Run the [device verification steps](device-verification.md) before treating a particular phone/browser as verified.
