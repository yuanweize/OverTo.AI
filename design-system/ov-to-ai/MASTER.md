# OvěřTo.AI design system

Implemented foundation, 2026-10-29. Source: `src/app/globals.css`. Replaces the earlier generated exploration; it does not imply all product pages have been redesigned.

## Semantic colors

| Token | Light | Dark | Purpose |
|---|---|---|---|
| canvas | #f5f7fb | #101a26 | Page background |
| surface | #ffffff | #172536 | Interactive panels |
| surface-alt | #edf1f7 | #213348 | Message excerpt and inset areas |
| ink | #152534 | #edf3fc | Primary text |
| muted | #526579 | #b3c2d5 | Secondary text |
| line | #ccd6e3 | #3d526a | Structural boundaries |
| accent-text | #2454cf | #a8bfff | Links and information |
| warning-text | #814700 | #ffdfa4 | Caution, paired with words/icons |
| danger-text | #a42c45 | #ffb6c5 | High-risk guidance, paired with words/icons |

Primary button fill defaults to #2454cf. Administrator changes require at least 4.5:1 contrast with white button text. The configured action color does not recolor risk states. System mode follows CSS media preference; manual mode is rendered from a persistent cookie before hydration.

## Type and layout

Inter, Latin Extended, variable weights. Body 16px, supporting text 14px, small metadata 12px. Headline 40–60px; mobile 43px. Body copy uses 1.5–1.8 line height. Shell maximum 1180px, 20px side gutters (16px on mobile). Layout breakpoints: 700px and 900px. Existing Tailwind workspace layouts retain their responsive breakpoints during migration.

Spacing follows a 4px base, with 8/12/16/24/32/48px common steps. Controls use 9px radius, message insets 10px, signature evidence panel 18px. Only the signature panel has a broad shadow; borders carry most hierarchy. Buttons reserve at least 44px touch height. Focus ring: 3px, 4px offset. Reduced motion removes transitions. No information is conveyed solely through color.

## Implemented components

Brand lockup, Header, Footer, native preference selects, primary/secondary button styles, evidence demo, safe site settings form with status feedback and version conflicts. Native controls retain keyboard behavior. Existing analysis and account controls share semantic colors but still need layout and full bilingual review.

Do not add unused complex controls merely to satisfy a component inventory. When a real flow needs dialogs, comboboxes, menus or data grids, use a maintained accessible primitive and test keyboard behavior. Such components are not implemented by this foundation.

## Review requirements

Check 375/390/768/1024/1440px, both themes and languages, keyboard focus, zoom, validation, disabled/loading/empty/error states and reduced motion. Capture the running app. See [review evidence](../../docs/design/DESIGN-REVIEW.md) for actual coverage and remaining gaps.
