# 2FA Live Code

An ultra-lightweight, zero-tracking, **100% client-side** browser TOTP (RFC 6238) 2FA authenticator built with **Tailwind CSS v4**, **High-Contrast Liquid Glass (Liquid Morphism)** UI, and native Web Crypto API.

No ads, no analytics, no backend servers, and zero build step — runs cleanly as modular native ES Modules and works even when completely offline.

## Features

- **Instant Live TOTP Generator**: Supports raw Base32 secret keys and full `otpauth://totp/...` URIs (auto-detects issuer, label, digits, period, and algorithm) with `CryptoKey` memoization.
- **60fps Liquid Glass Countdown & Visibility Auto-Pause**: Continuous SVG gooey liquid countdown stream inside a translucent optical glass channel with automatic `visibilitychange` pause (0% background CPU).
- **Custom TOTP Parameters**: Supports `6` or `8` digits, `15s` / `30s` / `60s` periods, and `SHA-1` / `SHA-256` / `SHA-512` via native `crypto.subtle`.
- **Multi / Bulk 2FA Mode**: Paste multiple `Label: SECRET_KEY` lines to monitor all live tokens simultaneously with one-click copy.
- **Offline QR Code Export & Lazy-Loaded Scanner**:
  - Pure JavaScript SVG QR encoder (`src/core/qr-encoder.js`, works 100% offline with SVG download).
  - Live webcam QR scanner and image upload (`src/core/qr-decoder.js`) lazily loaded on demand via native `BarcodeDetector` with `jsQR` fallback.
- **Local Vault (`localStorage`)**: Quick-access list of recent keys with live ticking codes, masked secret preview, and instant QR popup.
- **High-Contrast Liquid Glass UI**: Layered translucent dark glass (`backdrop-filter: blur(28px) saturate(210%)`) with Fresnel specular rims, flowing chromatic orbs, rAF-throttled caustic spotlight, and a Light Glass toggle.
- **Smooth Scroll & Motion Choreography**: **Lenis** smooth scroll synced with **GSAP ScrollTrigger** staggered reveals and **Motion** spring physics for cards, modals, and the flowing liquid tab pill.

## Project Structure

```text
├── index.html
├── README.md
├── LICENSE
├── src/
│   ├── main.js                 # App bootstrapper, tabs & global shortcuts
│   ├── styles/
│   │   └── main.css            # High-Contrast Liquid Glass design system
│   ├── core/
│   │   ├── totp.js             # RFC 6238 TOTP engine with CryptoKey cache
│   │   ├── qr-encoder.js       # Offline ISO/IEC 18004 QR Matrix & SVG encoder
│   │   ├── qr-decoder.js       # Lazy-loaded BarcodeDetector + jsQR decoder
│   │   └── storage.js          # Safe localStorage persistence layer
│   └── ui/
│       ├── animations.js       # Lenis, GSAP ScrollTrigger & Motion choreography
│       ├── ticker.js           # 60fps liquid bar ticker with tab auto-pause
│       ├── single-mode.js      # Live single-key generator & local vault
│       ├── bulk-mode.js        # Multi / Bulk 2FA live board
│       ├── qr-export-mode.js   # Offline otpauth:// QR generator & SVG export
│       ├── scanner.js          # Webcam & image QR scanner modal
│       ├── modal.js            # Legal/info & quick QR preview modal
│       └── toast.js            # Toast notifications & clipboard utilities
└── tests/
    └── totp.test.mjs           # RFC 6238 unit tests (zero dependencies)
```

## Quick Start

Serve the project over any static HTTP server:

```bash
# Using Python
python -m http.server 4173

# Or using Node.js
npx serve -l 4173 .
```

Then open **http://localhost:4173** in your browser.

## Running Unit Tests

Runs with Node.js built-in test runner (no `npm install` required):

```bash
node --test tests/totp.test.mjs
```

## Security & Privacy

- All HMAC-SHA calculations run strictly inside your browser's `window.crypto.subtle` API.
- Secret keys are **never** transmitted to any server. You can verify this by disconnecting from the internet after loading the page.
- Recent keys are stored locally in your browser's `localStorage` and can be wiped at any time with the **Clear** button.

## License

Licensed under the [MIT License](./LICENSE).
