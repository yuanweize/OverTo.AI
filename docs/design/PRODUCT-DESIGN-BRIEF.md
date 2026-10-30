# Product design brief

Decision date: 2026-10-29. Direction: Trustworthy Intelligence, expressed as **clear evidence**.

The primary user is someone unsure about a message and possibly under pressure to pay, share a credential or install software. The primary task is to pause, inspect evidence and choose an independent way to verify the request. Developers and operators are secondary audiences with separate workspaces.

## Product commitments

- Show the message and its supporting evidence together. A risk label is never a guarantee or a probability.
- Preserve original quotations, including in another interface language.
- Review and explicit consent precede external AI transmission. Rules remain usable without AI consent.
- Make recovery guidance reachable before any analysis. Never require a subscription to read emergency guidance.
- Distinguish a live result, an illustrative example, an unknown value and unavailable functionality.
- Put diagnostics in technical views; keep ordinary user decisions understandable.

## Research synthesis

Primary references reviewed: [Linear](https://linear.app), [Vercel](https://vercel.com), [Stripe](https://stripe.com), [Attio](https://attio.com), [PostHog](https://posthog.com), [Supabase](https://supabase.com), [Recombee](https://www.recombee.com), and [New API](https://github.com/QuantumNous/new-api).

The design inference is to separate a focused public task from a denser operational workspace, use persistent navigation in administration, expose technical details progressively, and show meaningful empty states instead of fabricated charts. None of their interfaces or code is copied. New API is a functional reference only; its AGPL code is not incorporated.

## Implementation contract

Inter with Latin Extended supports Czech diacritics. Left-aligned copy and short paragraphs support scanning. Cobalt identifies actions; amber and rose identify caution and risk with accompanying text and icons. The evidence frame is the signature visual device; there is no decorative animation or invented social proof.

See [visual directions](VISUAL-DIRECTIONS.md), [implemented tokens](../../design-system/ov-to-ai/MASTER.md), and [review evidence](DESIGN-REVIEW.md). These documents describe design decisions, not proof of full SaaS readiness.
