# AI integration test plan

Use this plan on a disposable local installation. Do not put API keys, message bodies or one-time links in reports. The current provider is an operator-configured OpenAI-compatible endpoint; model accuracy is not established by connectivity.

## Costless gates

```sh
SITE_CONFIG_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55446/overto_test \
LEDGER_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55446/overto_test npm test
npx tsc --noEmit
```

The database name must be `overto_test` on loopback. Tests create and drop isolated schemas. Review `src/lib/__tests__/llm-adapter.test.ts`, `provider-health.test.ts`, `provider-settings.test.ts`, `prompt-repository.integration.test.ts` and `ai-traces.integration.test.ts` for malformed response, timeout, rate-limit and prompt version behavior. A passing mock is not a successful real model analysis.

## Controlled live check

1. Use an already configured local compatible endpoint and a synthetic message without personal data. Keep `AI_ENABLED` and the endpoint allowlist under operator control.
2. In root AI Studio, use **Check connection** once. It performs `GET /models`, sends no message text and reports only HTTP status and duration. It does not prove model readiness.
3. In Prompt Lab, run one synthetic test of the chosen version and model. Check status, duration, token fields (which may be unknown), trace ID and evidence validation. Stop after a rate limit or provider failure; do not retry for a green result.
4. Confirm the web result reports `engine.mode` and `engine.providerStatus`, and that a fallback is labeled as rules. Verify `traceRecorded`; do not interpret an absent trace as success.

## Independent evaluation handoff

The authored challenge dataset in `src/evaluation/` is not representative or blinded. Before any accuracy claim, build an independent labeled set with malicious, benign and ambiguous cases; predefine binary threshold and abstention treatment; report precision, recall, false-positive and false-negative rates by category. Run rules, AI and hybrid on the same cases. Report failed and unavailable calls separately and include token/cost totals. See [evaluation results](../evaluation/ai-evaluation.md) and [failure analysis](../evaluation/failure-analysis.md).
