# 2FA Live Code

An ultra-lightweight, zero-tracking, **100% client-side** browser TOTP (RFC 6238) 2FA authenticator built with vanilla HTML, CSS, and ES Modules using the native Web Crypto API.

No ads, no analytics, no runtime frameworks, and zero network requests for cryptographic operations — works even when completely offline.

## Features

- **Instant Live TOTP Generator**: Supports raw Base32 secret keys and full `otpauth://totp/...` URIs (auto-detects issuer, label, digits, period, and algorithm).
- **30-Segment LED Countdown & Next-Code Preview**: Visual LED progress bar with 5-second rotation warning and a preview of the upcoming code.
- **Custom TOTP Parameters**: Supports `6` or `8` digits, `15s` / `30s` / `60s` periods, and `SHA-1` / `SHA-256` / `SHA-512` via native `crypto.subtle`.
- **Multi / Bulk 2FA Mode**: Paste multiple `Label: SECRET_KEY` lines to monitor all live tokens simultaneously with one-click copy.
- **Offline QR Code Export & Scanner**:
  - Pure JavaScript SVG QR generator (works 100% offline with SVG download).
  - Live webcam QR scanner and QR image upload powered by native `BarcodeDetector` (with automatic lazy-loaded `jsQR` fallback).
- **Local Vault (`localStorage`)**: Quick-access list of recent keys with live ticking codes, masked secret preview, and instant QR popup.
- **Light & Dark Claymorphism Theme**: Tactile 3D Claymorphism UI built with **Tailwind CSS v4** utilities, soft multi-layered clay shadows, pastel badges, and a smooth Dark Clay toggle.
- **Smooth Scroll & Motion Choreography**:
  - **Lenis** smooth scrolling synced with **GSAP ScrollTrigger** for staggered one-by-one element reveals.
  - **Motion** spring physics for card hover lifts, tab panel transitions, modal entrances, and holographic cursor spotlight glows (gracefully falls back when offline).
- **Keyboard Shortcuts**: Press `Ctrl+C` (or click the token display) to copy the active code immediately; `Esc` closes any modal.

## Project Structure

```text
├── index.html   # Main application markup & inline SVG infographic
├── styles.css   # Lightweight glassmorphism styles (dark + light themes)
├── totp.js      # RFC 6238 TOTP engine using native Web Crypto API
├── qr.js        # Offline SVG QR encoder + BarcodeDetector / jsQR decoder
├── app.js         # Interactive UI controller, ticker, bulk mode & local cache
├── animations.js  # Lenis smooth scroll, GSAP ScrollTrigger & Motion spring hover/cards
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
