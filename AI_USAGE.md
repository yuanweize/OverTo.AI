# AI usage

The optional analysis sends reviewed, best-effort redacted text to the configured model service. OpenLux is supported; local development can also use an HTTP gateway bound to an IP assigned to the same machine. The gateway may forward data to another provider. Data may remain sensitive; review their terms and do not assume OpenAI's retention rules apply to the relay. User consent is required. The adapter validates structure and matching quotations, but cannot guarantee interpretations are correct.

For localhost testing copy `.env.example` to `.env.local`, enter `OPENAI_API_KEY`, and run `npm run dev -- --hostname 127.0.0.1 --port 3005`. `AI_LOCAL_ONLY=true` bypasses the external-limit assertion only in development: it does not enforce a network boundary or a rate limit. Never expose this development server publicly. `npm run ai:check` sends one synthetic test request and may incur a small charge; it never prints the key. Provider/model support for strict schema must be verified with a real request.

For production, use real distributed rate limits and provider spending limits, disable local-only mode, then set `AI_EXTERNAL_RATE_LIMIT_CONFIRMED=true` as an operator assertion. The flag itself does not provide protection.
