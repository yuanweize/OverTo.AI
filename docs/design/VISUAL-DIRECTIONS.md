# Visual directions

2026-10-29. These are design alternatives, not three implemented themes.

| Direction | Layout and typography | Palette and expression | Tradeoff |
|---|---|---|---|
| A — Precision Security | Dense console, compact data rows, side-by-side evidence inspector | Midnight background, cyan controls, precise grid | Useful for analysts; too demanding for a worried first-time visitor |
| B — Trustworthy Intelligence | Generous message canvas, strong sentence-case heading, quiet navigation | Ink, cobalt, ice-white surfaces; framed evidence | Clear to a public audience and adaptable to a denser workspace |
| C — Editorial AI SaaS | Oversized editorial headline, asymmetric columns, story-led sequence | Warm paper, deep blue typography, restrained orange annotations | Distinctive storytelling, but lengthy explanations can slow urgent tasks |

## Selected: B, clear evidence

The memorable element is a message excerpt with evidence annotations and an actionable verification step. The rest of the page stays quiet. Dark mode preserves the same structure and semantics; it is not a second visual direction.

```text
Brand                         Analyze / Developers / Pricing / Sign in
                                                Language / Appearance

A suspicious message.         [ Original message                       ]
A clearer next step.          [ Highlighted request                     ]
                              [ Interpretation + verification guidance ]
Check a message / API         [ Run real example                        ]

Evidence explanation          Independent verification       Privacy review

Limitations                   Open source and self-hosting
```

The generic generated purple/pink chatbot recommendation was rejected: this product helps evaluate a request, rather than inviting an open-ended chat. No pulsing assistant avatar, fake progress steps, testimonial counters or security-certification claims are used.
