# 2FA Live Code

An ultra-lightweight, zero-tracking, **100% client-side** browser TOTP (RFC 6238) 2FA authenticator built with **Tailwind CSS v4**, **High-Contrast Liquid Glass (Liquid Morphism)** UI, and native Web Crypto API.

No ads, no analytics, no backend servers, and zero network requests for cryptographic operations — works even when completely offline.

## Features

- **Instant Live TOTP Generator**: Supports raw Base32 secret keys and full `otpauth://totp/...` URIs (auto-detects issuer, label, digits, period, and algorithm).
- **60fps Liquid Glass Countdown & Next-Code Preview**: Continuous SVG gooey liquid countdown stream inside a translucent optical glass channel with 5-second crimson rotation warning and a preview of the upcoming code.
- **Custom TOTP Parameters**: Supports `6` or `8` digits, `15s` / `30s` / `60s` periods, and `SHA-1` / `SHA-256` / `SHA-512` via native `crypto.subtle`.
- **Multi / Bulk 2FA Mode**: Paste multiple `Label: SECRET_KEY` lines to monitor all live tokens simultaneously with one-click copy.
- **Offline QR Code Export & Scanner**:
  - Pure JavaScript SVG QR generator (works 100% offline with SVG download).
  - Live webcam QR scanner and QR image upload powered by native `BarcodeDetector` (with automatic lazy-loaded `jsQR` fallback).
- **Local Vault (`localStorage`)**: Quick-access list of recent keys with live ticking codes, masked secret preview, and instant QR popup.
- **High-Contrast Liquid Glass UI**:
  - Layered translucent dark glass (`backdrop-filter: blur(28px) saturate(210%)`) with crisp Fresnel specular rims and cursor-tracking chromatic caustic refraction.
  - Flowing chromatic liquid orbs refracted behind glass surfaces, plus a smooth Light Glass toggle.
- **Smooth Scroll & Motion Choreography**:
  - **Lenis** smooth scrolling synced with **GSAP ScrollTrigger** for staggered one-by-one element reveals.
  - **Motion** spring physics for card hover lifts, flowing liquid tab pill transitions, and modal entrances (gracefully falls back when offline).
- **Keyboard Shortcuts**: Press `Ctrl+C` (or click the token display) to copy the active code immediately; `Esc` closes any modal.

## Project Structure

```text
├── index.html     # Main application markup, Tailwind CSS v4 & SVG liquid filters
├── styles.css     # High-Contrast Liquid Glass design tokens & refraction styles
├── totp.js        # RFC 6238 TOTP engine using native Web Crypto API
├── qr.js          # Offline SVG QR encoder + BarcodeDetector / jsQR decoder
├── app.js         # Interactive UI controller, 60fps ticker, bulk mode & local cache
├── animations.js  # Lenis smooth scroll, GSAP ScrollTrigger & Motion spring/tab pill
└── LICENSE        # MIT License
```

## Quick Start

Because the app uses native ES Modules (`type="module"`), serve the directory over HTTP/HTTPS (any static file server works):

```bash
# Using Python
python -m http.server 4173

# Or using Node.js
npx serve -l 4173 .
```

Then open **http://localhost:4173** in your browser.

## Security & Privacy

- All HMAC-SHA calculations run strictly inside your browser's `window.crypto.subtle` API.
- Secret keys are **never** transmitted to any server. You can verify this by disconnecting from the internet after loading the page.
- Recent keys are stored locally in your browser's `localStorage` and can be wiped at any time with the **Clear** button.

## License

Licensed under the [MIT License](./LICENSE).
