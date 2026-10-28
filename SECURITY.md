# Security

The API bounds request size and validates input. URL analysis parses locally and does not request the target. OpenAI calls require explicit user consent, server configuration, a timeout and output limit; the operator flag for external limiting is not a limiter. No public distributed rate limiting or provider spending enforcement is implemented in this repository. Do not enable public AI until those controls are configured and tested. No independent security audit has been completed.

Do not put secrets in Git or client code. Redaction is incomplete; users should remove sensitive details before submission. Model output is untrusted and exact quotation matching does not ensure correct interpretation. For responsible disclosure contact the maintainer through a private channel; no public security contact has yet been configured.
