# AI usage

The optional analysis sends reviewed, best-effort redacted text to the configured OpenAI-compatible model endpoint. Local development can also use an HTTP gateway bound to an IP assigned to the same machine. The gateway may forward data to another provider. Data may remain sensitive; review the selected provider's terms and retention policy. User consent is required. The adapter validates structure and matching quotations, but cannot guarantee interpretations are correct.

For localhost testing copy `.env.example` to `.env.local`, enter `OPENAI_API_KEY`, and run `npm run dev -- --hostname 127.0.0.1 --port 3005`. `AI_LOCAL_ONLY=true` enables requests only in development: it does not enforce a network boundary or a rate limit. Never expose this development server publicly. `npm run ai:check` sends one synthetic test request and may incur a small charge; it never prints the key. Provider/model support for strict schema must be verified with a real request.

Production AI calls currently fail closed. The legacy `AI_EXTERNAL_RATE_LIMIT_CONFIRMED` flag cannot enable paid requests. Shared authorization, quota reservations and spending controls must be implemented and verified before production AI is opened. Rules analysis remains available; failed or blocked AI requests are reported as rules fallback.
