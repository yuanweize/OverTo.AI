# Public interface reference — 2026-10-30

The user selected [OpenRouter](https://openrouter.ai/) as a visual-quality reference. We inspected the live public site in a browser at 1200px and compared the homepage, [model catalog](https://openrouter.ai/models), [model detail](https://openrouter.ai/baseten/joey-1), [rankings](https://openrouter.ai/rankings) and [quickstart documentation](https://openrouter.ai/docs/quickstart). These observations are about interface patterns, not OpenRouter API integration or a claim about its product quality.

| Public screen | Observed treatment | OvěřTo.AI decision |
| --- | --- | --- |
| Home | Tight top navigation, high-contrast dark hero, direct actions and product illustrations | Use a dark evidence-led hero with our original annotation motif; avoid invented usage statistics and provider logos. |
| Model catalog | Filter rail, search/sort controls, compact rows and secondary metadata | Favor scan-friendly model rows and explicit default selection. Only display capabilities and prices after the operator verifies and configures them. |
| Model detail | Small parameter summary, stable left navigation, task-oriented playground | Give AI Studio a compact configuration hierarchy and separate diagnostics from actual inference. |
| Rankings | Chart and leaderboard use dense but labeled data | Use only real local usage and test results; do not generate an empty decorative chart. |
| Quickstart | Persistent table of contents, readable content measure and code examples | Create a dedicated bilingual `/docs` page with section links and runnable local curl examples. |

The [API keys page](https://openrouter.ai/settings/keys) redirects an unauthenticated visitor to sign-in. Usage, credits, billing and developer dashboard were likewise not inspected behind an account. No private-screen layout is described as observed. Their public labels and documentation were used only as information-architecture hints.

Our identity remains an evidence frame, cobalt action color and amber quotation highlight. The dark hero uses neutral ink instead of OpenRouter's black and its own accent; no logos, artwork, code or page layouts were copied. The [visual review](FINAL-VISUAL-REVIEW.md) records implementation and real local screenshots.
