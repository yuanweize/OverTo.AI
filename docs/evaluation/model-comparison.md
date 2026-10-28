# Model comparison

No live comparison has yet been performed. The default `npm run eval` does not call a model. An explicit `npm run eval -- --live`, with the provider configured, runs LLM-only and hybrid in addition to rules. Such a run sends the **synthetic** challenge texts to the configured provider and may incur charges; review provider terms, cost controls and quota first. Failed or unavailable calls are excluded from AI mode metrics and counted, never reported as successful AI inference.

LLM-only uses a documented research mapping of validated semantic signal severity to the product's three decision levels; it is not the production policy. Do not claim AI improves outcomes until the comparison is run and reviewed, preferably on an independently labeled holdout. Grounded substrings can still have wrong interpretations. Automated action safety and actual cost are not currently measured.
