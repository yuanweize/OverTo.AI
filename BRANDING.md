# OvěřTo.AI branding

The project identity uses an evidence frame and check mark: a reminder to inspect the basis for a decision, not a certification that a message is safe.

## Assets

- `public/brand/mark.svg`: original scalable mark.
- `public/brand/wordmark.svg`: original light-background lockup.
- `public/brand/social.png`: 1200 × 630 default social artwork.
- `public/brand/icon-192.png`, `icon-512.png`, `icon-maskable.png`: install icons. The dynamic manifest uses the configured name, color and local logo. No offline analysis or service-worker caching is claimed.
- `src/app/icon.svg`, `src/app/favicon.ico`, `src/app/apple-icon.png`: browser and device icons.

The application lockup renders the configured name as real text and the configured local mark separately. It supports Czech characters and dark surfaces. Keep whitespace around the mark and do not distort it. Cobalt is an action color; do not use the mark as a verified-safety badge.

## Self-hosting and attribution

Application code is Apache-2.0; see [LICENSE](LICENSE). Original artwork in this repository is supplied under the same license. That does not grant trademark rights or permission to imply endorsement. Third-party names and logos, including GitHub, identify their respective services and remain their owners' marks.

Self-hosters may replace the site name, descriptions, local logo, primary action color and announcement through the protected configuration page. Public signup never grants this privilege. Browser icons and social artwork are currently build-time files; replacing the site logo does not yet change them. Use your own branding for a separately operated service and make its operator and privacy practices clear.

## Tokens and typography

Inter with Latin and Latin Extended covers Czech and English. Main copy uses 16–18px with generous line height; dense operations tables use 13px. Default cobalt `#2454cf` identifies actions, with pale cobalt surfaces; slate canvas and text adapt to light/dark/system. Semantic danger and warning tokens are separate from brand color. Do not communicate risk with color alone.

Use at least one-quarter mark width as clear space. The app lockup uses real text with theme-aware foreground; the standalone wordmark SVG is for light surfaces. Use Lucide interface icons consistently, normally 18–24px, and keep visible text for important actions. The evidence-frame mark must not be presented as certification of safety.
