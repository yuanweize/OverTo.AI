# Visual review — local development build

## Round 4 — operations console

The new ROOT-only operations pages were captured in Chrome after implementation. The first desktop capture used a 1280px test viewport despite its 1440 filename; the browser test was corrected to set 1440px before capture and rerun. The resulting [English overview](../../assets/screenshots/v7-admin-overview-en-1440.png), [Czech overview](../../assets/screenshots/v7-admin-overview-cs-1440.png), [English dark mobile overview](../../assets/screenshots/v7-admin-overview-en-dark-390.png) and [English users table](../../assets/screenshots/v7-admin-users-en-1440.png) were inspected. The metric strip becomes a two-column mobile grid, links and status text remain readable, and the desktop table aligns six fields. The screenshots show synthetic local accounts, not real adoption. Unauthorized requests to each new page returned 404 in the same browser run. The remaining visual gate is the broader keyboard, contrast and tablet audit across all routes.

Screenshots were captured from the running app with synthetic content on 2026-10-29. They are visual evidence of the local build, not deployed-service evidence or a usability study.

## Direction

Three directions were compared in [Visual directions](VISUAL-DIRECTIONS.md). The chosen system uses an annotated message and evidence as the memorable product element, with restrained cobalt controls, precise rules, semantic surfaces and a denser workspace shell. Light and dark use the same information hierarchy. The `frontend-design` and `ui-ux-pro-max` skills guided typography, 44px controls, responsive layout, contrast, focus and motion review. We avoided fabricated security badges and decorative AI avatars.

## Round 1 — initial local screens

| Screen | Screenshot | Finding |
| --- | --- | --- |
| Czech home, desktop light | [Home](../../assets/screenshots/v6-home-cs-light.png) | Clear purpose and evidence demo; lower sections remained visually quiet. |
| English analysis, dark | [Analysis](../../assets/screenshots/v6-analysis-en-dark.png) | Evidence hierarchy readable; exact quotation behavior needed stricter repeated-span handling. |
| Workspace, 390px dark | Initial capture was overwritten by the second pass | Mobile navigation and project forms consumed excessive vertical space. The corrected state is captured below. |

Changes after review: evidence graph enumerates repeated and ambiguous occurrences, the mobile workspace navigation opens as a bounded overlay, and project rows keep rename controls behind an explicit action. The first mobile workspace screenshot showed the navigation expanded above the content; the second screenshot below shows the closed state.

## Round 2 — live browser captures

| Screen | Screenshot | Review |
| --- | --- | --- |
| Project workspace, 1280px light | [Workspace desktop](../../assets/screenshots/v7-workspace-en.png) | Compact rows, aligned actions, legible status and form hierarchy. |
| Project workspace, 390px dark | [Workspace mobile](../../assets/screenshots/v7-workspace-mobile.png) | Content starts below a compact navigation header. No horizontal overflow. |
| Pricing, 1440px Czech light | [Pricing desktop](../../assets/screenshots/v7-pricing-cs-1440.png) | Clear current versus planned offering; no invented commercial price. |
| Pricing, 390px English dark | [Pricing mobile](../../assets/screenshots/v7-pricing-en-dark-390.png) | Single-column cards and readable controls. Second-card link needed more space below text; spacing was increased after capture. |
| Documentation, 1024px English light | [Docs](../../assets/screenshots/v7-docs-en-1024.png) | Scannable editorial sections and a direct route to the API. |
| Features, 375px Czech light | [Features](../../assets/screenshots/v7-features-cs-375.png) | Mobile content fits viewport. |
| How it works, 768px Czech dark | [Process](../../assets/screenshots/v7-how-cs-dark-768.png) | Mid-size dark layout fits viewport. |
| Model registry, desktop English | [AI Studio models](../../assets/screenshots/v7-model-registry.png) | Synthetic root account added and restored a model ID. The screenshot uses a temporary test site name and contains no access key or endpoint address. |

The browser test also opened `/security`, `/privacy` and `/terms` in English and checked their main headings. It verified no horizontal overflow at 375/390/768/1024/1440 pixels.

## Remaining visual acceptance

At the end of round 2, home, analysis, dashboard, API keys, playground, billing, admin and Prompt Lab still needed fresh captures. Round 3 below covers the first five of those surfaces. Keyboard-only task completion, screen-reader labels, contrast measurements, reduced-motion review and responsive checks for every admin state are not yet complete. The current result is a reviewed local design iteration, not a claim of first-tier SaaS polish.

## Round 3 — OpenRouter-inspired direction, original identity

The live public reference and its access limits are recorded in [reference review](OPENROUTER-REFERENCE-REVIEW.md). A new design pass made the home hero a dark evidence instrument, replaced dashboard cards with a compact metric strip, made API Playground show a decision summary before expandable JSON, and gave `/docs` a table of contents and runnable examples. The analysis form's disabled CTA now has readable colors in dark mode. These changes were rechecked in a fresh browser session after clearing the Next development cache.

| Screen | Real screenshot | Visual finding |
| --- | --- | --- |
| Home desktop, English light | [Home](../../assets/screenshots/v7-home-en-1440.png) | The evidence excerpt is the dominant product preview; no invented product metrics. |
| Home mobile, Czech dark | [Home mobile](../../assets/screenshots/v7-home-cs-dark-390.png) | One-column hero and annotation fit without horizontal overflow; the full-page capture is tall. |
| Analysis mobile, English dark | [Analysis](../../assets/screenshots/v7-analyze-en-dark-390.png) | Disabled review action now uses a neutral surface and legible text. |
| Dashboard desktop, Czech light | [Dashboard](../../assets/screenshots/v7-dashboard-cs-1440.png) | Credits, projects and plan form one scannable strip; all values come from the test account. |
| Dashboard mobile, Czech dark | [Dashboard mobile](../../assets/screenshots/v7-dashboard-cs-dark-390.png) | Metrics stack cleanly; the primary analysis action stays visible below them. |
| API keys desktop, Czech light | [Keys](../../assets/screenshots/v7-api-keys-cs-1440.png) | Current and revoked key show the same quota lineage; only prefixes are visible. |
| API keys mobile, Czech dark | [Keys mobile](../../assets/screenshots/v7-api-keys-cs-dark-390.png) | First capture exposed squeezed key details and a low-contrast disabled button. The layout and disabled state were corrected, then recaptured after a clean dev restart. Key prefixes only are visible. |
| Playground desktop, Czech light | [Playground](../../assets/screenshots/v7-playground-cs-1440.png) | Decision, signal count, engine and credits precede expandable JSON. The input was cleared before capture. |
| Docs, English, 1024px | [Documentation](../../assets/screenshots/v7-docs-en-1024.png) | Navigation, code examples and content measure are readable. |
| Billing, Czech desktop light | [Billing](../../assets/screenshots/v7-billing-cs-1440.png) | Disabled test-payment state is explicit; no live amount or entitlement is invented. |
| Billing, Czech mobile dark | [Billing mobile](../../assets/screenshots/v7-billing-cs-dark-390.png) | Single-column copy and buttons fit 390px. Disabled actions received a semantic high-contrast treatment. |
| AI Studio, English desktop light | [Light](../../assets/screenshots/v7-ai-studio-en-light.png) | Compact live metrics and bordered trace rows replace the earlier card stack. The obsolete feature disclaimer was corrected. |
| AI Studio, English desktop dark | [Dark](../../assets/screenshots/v7-ai-studio-en-dark.png) | Status labels remain readable in dark mode; only synthetic administrator identity and operational metadata are shown. |

An active billing subscription and the remaining admin surfaces need another visual iteration. Keyboard-only and assistive technology acceptance is still incomplete. This round is a real improvement, not final visual acceptance for every route.
