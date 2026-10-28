# Security

The API bounds request size and validates input. URL analysis parses locally and does not request the target. OpenLux calls require explicit user consent, server configuration, a timeout and output limit; the operator flag for external limiting is not a limiter. No public distributed rate limiting or provider spending enforcement is implemented in this repository. Do not enable public AI until those controls are configured and tested. No independent security audit has been completed.

Account functionality is explicitly development-only. Local email verification and password-reset messages are captured by Mailpit bound to loopback and are not delivered externally. Its inbox contains sensitive one-time links: never expose it publicly or use real accounts. Production email delivery, authentication deployment, distributed login limits and operational security are not implemented or validated. Password reset revokes existing sessions in local tests.

Do not put secrets in Git or client code. Redaction is incomplete; users should remove sensitive details before submission. Model output is untrusted and exact quotation matching does not ensure correct interpretation. For responsible disclosure contact the maintainer through a private channel; no public security contact has yet been configured.
