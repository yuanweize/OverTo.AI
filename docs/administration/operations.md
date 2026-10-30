# Operations console

Status: implemented for the loopback-only local account environment. It is not a production operations console.

The verified ROOT account can open `/admin/operations` and navigate to:

| Page | Data shown | Limits |
| --- | --- | --- |
| `/admin/users` | Verified status, personal workspace, active project count, total test credits granted and consumed | Search is a literal name/email prefix; 50 rows per page, at most 100 pages |
| `/admin/billing` | Stripe Test Mode subscription status and processed webhook event types | No invoice amounts, payment details or live billing |
| `/admin/audit` | Latest 100 site-setting and AI Studio operation records | Metadata only; no message text, full prompt or secret values |
| `/admin/system` | Database connectivity, expected table presence and AI credential configuration flag | No provider completion, email delivery, backup or public readiness test |

Each page checks the verified ROOT session on the server. Unauthenticated requests receive 404. The interface uses server-side, parameterized queries; user search escapes SQL wildcard characters. The browser receives only the records rendered for the administrator. Full API key secrets and submitted message contents are not queried.

The overview counts come from the live local PostgreSQL database. Synthetic browser tests create accounts and may increase these counts. A high count in a screenshot is not evidence of real adoption.

The dedicated privileged browser journey checks root access, literal search and empty state, all five unauthorized routes, and the existing settings save/restore path. Run it only against the dedicated loopback test database with `OVERTO_ADMIN_E2E=true` and one Playwright worker. It creates a synthetic temporary ROOT role and removes that role afterward.

Still needed for a full SaaS: production authentication and email, audited user actions, account export/deletion, organization membership, billing reconciliation and operational monitoring. See [acceptance matrix](../development/ACCEPTANCE-MATRIX.md).
