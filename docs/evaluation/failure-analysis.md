# Rules-only failure review

Generated from the synthetic challenge run at 2026-10-28T13:22:56.156Z. These are hypotheses from case design, not independently verified incidents.

- **bank-1** (label MALICIOUS; banking; decision INSUFFICIENT_EVIDENCE): Supposed bank identity, urgent transfer and secrecy.
- **bank-2** (label MALICIOUS; banking; decision INSUFFICIENT_EVIDENCE): Requests an authentication code under a protective pretext.
- **parcel-1** (label MALICIOUS; delivery; decision VERIFICATION_RECOMMENDED): Payment card request linked to alleged delivery problem.
- **family-1** (label MALICIOUS; family; decision INSUFFICIENT_EVIDENCE): Family impersonation scenario combining new contact and urgent payment.
- **family-2** (label MALICIOUS; family; decision INSUFFICIENT_EVIDENCE): Changed contact, distress, payment demand and secrecy.
- **market-1** (label MALICIOUS; marketplace; decision INSUFFICIENT_EVIDENCE): Asks seller for payment card secrets to receive funds.
- **market-2** (label MALICIOUS; marketplace; decision VERIFICATION_RECOMMENDED): Asks seller for bank login through a supplied site.
- **invest-1** (label MALICIOUS; investment; decision INSUFFICIENT_EVIDENCE): Implausible guaranteed returns and account access request.
- **government-1** (label MALICIOUS; government; decision VERIFICATION_RECOMMENDED): Government claim used to request banking credentials.
- **remote-1** (label MALICIOUS; remote-access; decision INSUFFICIENT_EVIDENCE): Remote control demand plus financial threat.
- **inject-1** (label MALICIOUS; injection; decision VERIFICATION_RECOMMENDED): Instruction spoofing embedded in a credential request.
- **inject-2** (label MALICIOUS; injection; decision VERIFICATION_RECOMMENDED): Role and JSON spoofing embedded in a family transfer request.
- **benign-education-2** (label BENIGN; education; decision HIGH_RISK): Discusses remote access in a warning, not a demand.

Do not tune to this set and then call it a blind evaluation. Review semantic context, assumptions and likely consequences before changing rules; confirm improvements with a separately reviewed holdout.
