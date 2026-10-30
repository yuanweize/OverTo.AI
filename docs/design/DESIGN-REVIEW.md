# Design review — 6.0 work in progress

Date: 2026-10-29. Environment: local Next development server, Chromium via installed Google Chrome, synthetic messages and accounts. These screenshots are not evidence of a public production deployment.

## First review

The Czech home at 1440px showed the new evidence mark, stable two-column hero and actual rules demonstration. The next review covered the English dark mobile home and English analysis results. Text remains legible without relying on red/amber alone; the original Czech excerpt is deliberately untranslated.

## Corrections and retest

- Removed incompatible `instant` exports after adopting per-request language/settings rendering.
- Fixed canonical-origin validation that rejected preference saves when Next normalized the internal host.
- Replaced the source-link code symbol with the GitHub mark.
- Unified favicon and Apple touch icon with the evidence mark.
- Added persistent Light/Dark/System tests and explicit language override tests.
- Added evidence-location controls, a focusable source-text view and highlighted exact spans.
- Replaced overconfident Czech guidance with bounded interpretations where the rules only detect wording.

Nine browser journeys passed, including the full English analysis/privacy/verification flow, Czech local account/credit/project/key flows, system dark mode and overflow checks at 375/390/768/1024/1440px. A separate explicit administrator journey passed save, stale-version rejection, fresh-page branding and restoration of original settings. The screenshot review is partial; it is not an accessibility certification or a full-page/state audit.

## Current captures

- [Czech light home](../../assets/screenshots/v6-home-cs-light.png)
- [English dark mobile home](../../assets/screenshots/v6-home-en-dark-mobile.png)
- [English dark analysis and evidence focus](../../assets/screenshots/v6-analysis-en-dark.png)
- [Administrator configuration](../../assets/screenshots/v6-admin-settings.png)

Older `saas-*` captures describe the earlier UI and must not be presented as final 6.0 screenshots.

## Remaining visual work

Analysis results are still long, with duplicate explanatory sections; progressive disclosure and a clearer workspace layout need a further pass. The relationship view has grounded links and source focus, but no zoomable graph. Authentication, dashboard, billing, developer and pricing content are not fully bilingual. Dense tables, privileged empty/error states, keyboard-only journeys, 200% zoom, automated contrast checks and measured frontend performance remain to be reviewed. AI Studio currently has operational trace views, not prompt/release/evaluation management.
