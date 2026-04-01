# TODO

## P0 - Stabilize Current MVP
- [x] Add dedicated audit log UI page (`/admin/audit`), with filters by status/provider/query.
- [x] Improve webhook error classification:
  - parse errors
  - validation errors
  - dispatch network errors
  - target business errors
  - align Telegram text and webhook JSON reason codes.
- [x] Add end-to-end smoke script for webhook regression tests.
- [x] Add idempotency guard for repeated Telegram updates (`update_id` dedupe).
- [x] Normalize webhook response contract documentation and add response examples.

## P1 - Dispatcher & Command Safety
- [x] Implement `authType=hmac` in dispatcher.
- [x] Add command argument validator that supports:
  - number min/max
  - string regex
  - nested object schemas.
- [x] Add optional command-level cooldown / rate limit.
- [x] Add confirmation flow for commands marked `confirmationRequired`.
- [x] Add command dry-run endpoint (validate and render final payload without dispatch).
- [x] Add target connectivity test action and health check in admin UI.
- [x] Add target restore validation and rollback safeguards.

## P1 - Provider Management
- [x] Add provider edit page (update base URL/model/headers).
- [x] Add API key rotation flow for provider secrets.
- [x] Add "test provider connection" action from admin UI.
- [x] Add provider capability profile and JSON output strictness options.

## P1 - Telegram UX
- [x] Add allowlist link between Telegram account and admin user.
- [x] Add richer Telegram responses:
  - clear reason codes
  - summarized execution result
  - error hints for operator.
- [x] Add optional device aliases for stable parsing and explicit matching.
- [x] Add optional command aliases (per command) for more stable parsing.
- [x] Return the same reason taxonomy in Telegram reply text and webhook JSON.

## P2 - Data & Operations
- [x] Add restore admin UI for SQLite.
- [x] Add backup creation and backup listing admin UI for SQLite.
- [x] Add migration path docs from SQLite to PostgreSQL.
- [x] Add structured operational logs and metrics.
- [x] Add health endpoints for app, DB, and target connectivity checks.

## P2 - Testing
- [x] Unit tests for `lib/llm.js` via `scripts/test_unit_llm.mjs`:
  - endpoint candidate selection
  - capability parsing
  - JSON extraction
  - prompt contract
- [x] Unit tests for `lib/registry.js` via `scripts/test_unit_registry.mjs`:
  - schema validation
  - nested object validation
  - array item validation
  - min/max and pattern validation
- [x] Unit tests for `lib/dispatcher.js` via `scripts/test_unit_dispatcher.mjs`:
  - payload rendering
  - JSON body parsing
  - HMAC signature determinism
- [x] Unit tests for `lib/telegram.js` via `scripts/test_unit_telegram.mjs`:
  - confirm/cancel token parsing
  - webhook secret header verification
- [x] Integration tests for `/api/telegram/webhook` via `scripts/test_webhook_integration.py`.
- [x] Complete message-flow integration test via `scripts/test_message_flow_integration.py`:
  - confirmation pending
  - confirm execution
  - cancel flow
  - cooldown rejection
  - audit / pending action / command execution side effects
  - mock Telegram outbound reply capture
- [x] Contract tests for payload template rendering via `scripts/test_contract_payload_template.mjs`.
- [x] Fixture-based alias matching tests via `scripts/test_alias_fixtures.mjs`.
- [x] Add a single local aggregate runner for the current testing chapter via `npm run test:core`.
- [x] Add a CI aggregate runner via `.github/workflows/test-core.yml`.

## P3 - Future Expansion
- [ ] Multi-step workflow support (sequence of commands).
- [ ] Scheduled automation jobs.
- [ ] Multi-home / multi-site support.
- [ ] RBAC expansion beyond single-admin prototype.
