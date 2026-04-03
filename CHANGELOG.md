# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Added
- Added SQLite backup upload flow in `/admin/system`, with optional immediate restore after upload.
- Added admin-only SQLite backup download flow from `/admin/system`.

### Changed
- Updated beginner tutorial and environment reference documents so Render free demo examples now use `/tmp/data/...` consistently and explicitly warn that restart / redeploy may clear both SQLite and backups.
- Updated `README.md` with the backup upload/download flow and current Render SQLite startup notes.

### Fixed
- Fixed SQLite migration bootstrap so `prestart` on Render still runs through `npm run start`, but now avoids false baseline states caused by runtime-only tables such as `app_runtime_settings`.
- Fixed the SQLite migrate wrapper to recover from a bad local/ephemeral baseline state where `_prisma_migrations` existed but application tables like `User` had never actually been created.

## 1.0.3 - 2026-04-01

### Added
- Added beginner-first getting started guide: `docs/getting-started-beginner.md`.
- Added beginner-first pre-deployment checklist: `docs/deployment-checklist-beginner.md`.

### Changed
- Updated `README.md` document index to surface the new beginner onboarding and deployment-checklist guides.
- Bumped project version to `1.0.3` for the documentation release.

### Notes
- These two documents assume the reader has no prior Render, Vercel, or Telegram webhook deployment experience.
- Version `1.0.3` is the last local version before the planned archive-and-reinitialize workflow for `.git` history.
- If the repository is later reinitialized before GitHub upload, treat this changelog entry as the continuity marker between the private local history and the new public history.

## 1.0.2 - 2026-04-01

### Added
- Added local mock Telegram outbound server: `scripts/mock_telegram_server.py`.
- Added full message-flow integration test: `scripts/test_message_flow_integration.py`.
- Added raw-data runner for full message-flow testing: `scripts/run_message_flow_integration_with_report.sh`.
- Added raw log artifact for the message-flow run: `reports/raw/TEST-20260401-message-flow.log`.

### Changed
- Updated `apps/web/lib/telegram.js` to support `TELEGRAM_API_BASE_URL`, enabling local outbound reply-chain testing without Telegram Cloud.
- Updated testing docs and README with the complete message-chain verification flow and mock Telegram usage.

### Notes
- The message-flow integration test is self-contained: it starts the Next.js app and all required local mock services, then asserts confirmation, cancel, cooldown, validation, and DB side effects.

## 1.0.1 - 2026-04-01

### Added
- Added CI aggregate runner: `.github/workflows/test-core.yml`.
- Added raw-data aware local test runner: `scripts/run_test_core_with_report.sh`.
- Added tracked raw log artifacts for the latest test round:
  - `reports/raw/TEST-20260401-test-core.log`
  - `reports/raw/TEST-20260401-build.log`

### Changed
- Updated testing documentation so every testing item now requires both raw data output and a report reference.
- Added `npm run test:report:core` for local execution with persisted raw logs.

### Notes
- Future testing additions should write raw command output into `reports/raw/` and reference those files from the matching report.

## 1.0.0 - 2026-04-01

### Added
- Added pure reusable helper modules for testable logic extraction:
  - `apps/web/lib/llm-utils.mjs`
  - `apps/web/lib/registry-utils.mjs`
  - `apps/web/lib/dispatcher-utils.mjs`
  - `apps/web/lib/telegram-utils.mjs`
- Added automated local testing scripts:
  - `scripts/test_contract_payload_template.mjs`
  - `scripts/test_alias_fixtures.mjs`
  - `scripts/test_unit_llm.mjs`
  - `scripts/test_unit_registry.mjs`
  - `scripts/test_unit_dispatcher.mjs`
  - `scripts/test_unit_telegram.mjs`
- Added aggregate local test runner: `npm run test:core`.

### Changed
- Updated `docs/testing-standard.md` with an explicit testing matrix and script-to-scope mapping.
- Updated `TODO.md` so the testing chapter lists exact script filenames for each planned or completed test area.
- Reused extracted pure helper modules from runtime code so local unit tests exercise production logic instead of duplicated test-only implementations.

### Notes
- Current aggregate runner is local-only. CI wiring remains a future follow-up once repository CI is introduced.

## 0.9.9 - 2026-04-01

### Added
- Established Node workspace baseline for monorepo layout.
- Added `apps/web` Next.js app skeleton with initial dashboard UI.
- Added Prisma + SQLite foundation and initial migrations.
- Added admin bootstrap login flow using `.env` credentials.
- Added cookie-based session auth for protected admin routes.
- Added provider registry module and admin pages:
  - create provider
  - activate/deactivate provider
  - set default provider
  - delete provider
- Added encrypted secret storage (`AES-256-GCM`) for provider and target secrets.
- Added device registry module and admin pages:
  - target CRUD-like actions (create/toggle/delete)
  - device CRUD-like actions (create/toggle/delete)
  - command CRUD-like actions (create/toggle/delete)
- Added Telegram allowlist admin pages and actions.
- Added Telegram webhook endpoint with:
  - secret header verification
  - allowlist authorization
  - audit log writeback
- Added LLM parsing pipeline for OpenAI-compatible providers.
- Added registry context builder for LLM prompt grounding.
- Added parsed-action validation against active target/device/command whitelist.
- Added dispatcher MVP to execute validated commands against target APIs.
- Added local mock target device server for dispatcher testing.
- Added audit log UI page with filters and request/response drill-down.
- Added device aliases support for explicit natural-language matching.
- Added device edit flow for name, type, description, and aliases.
- Added structured webhook JSON response contract for curl-based testing.
- Added provider and target connection test actions in the admin UI.
- Added protected `/admin/system` page for SQLite backup creation and backup listing.
- Added Telegram `update_id` dedupe storage and webhook guard.
- Added `scripts/test_webhook.sh` smoke test tool with auto-incrementing `update_id`.
- Added `docs/testing-standard.md` for local verification and reporting minimums.
- Added provider edit flow for base URL, model, headers, capabilities, and API key updates.
- Added command alias support and inline command edit flow.
- Added shared `reasonCode` output across webhook JSON and Telegram replies.
- Added target edit flow for name, base URL, auth type, timeout, and auth secret.
- Added command dry-run flow to render final request without dispatching to the target.
- Added `authType=hmac` support for dispatcher and target health checks.
- Added Telegram confirmation flow for commands marked `confirmationRequired`.
- Added command-level cooldown tracking using successful execution history.
- Added health endpoints for app, DB, and target connectivity checks.
- Added SQLite restore UI with:
  - backup-directory allowlist
  - `PRAGMA integrity_check`
  - automatic pre-restore rollback backup.
- Added provider capability profile and JSON strictness controls.
- Added local mock OpenAI-compatible LLM server.
- Added local webhook integration test runner for fixture-based regression checks.
- Added Telegram allowlist linking to active admin users in the admin UI.
- Added inline Telegram allowlist edit flow for linked admin user, username, and display name.
- Added provider API key rotation flow with:
  - explicit rotation confirmation
  - immutable secret history
  - audit log entry for each rotation.
- Added a second `Back to dashboard` shortcut near the top of `/admin/audit`.
- Added `/api/metrics` for structured operational metrics JSON.
- Added operational metrics and recent operational events to `/admin/system`.
- Added `docs/sqlite-to-postgres-migration.md` with cutover steps, risks, and rollout guidance.

### Changed
- Improved provider resolution:
  - prefer `active + default`
  - fallback to latest `active` provider
  - allow providers without API key (for local gateways such as Ollama).
- Improved OpenAI-compatible endpoint resolution:
  - supports `/v1/chat/completions` and `/chat/completions`.
- Improved action validation robustness:
  - target/device matching ignores case and symbol differences
  - infer target from unique matching device when target key mismatch
  - basic schema validation for required/type/enum
  - require explicit raw-text match against device key, name, or alias.
- Added natural-language arg enrichment for `state`:
  - maps "開/打開/on" to `ON`
  - maps "關/關閉/off" to `OFF`.
- Tightened control safety:
  - removed auto-selection fallback for single target/device/command
  - reject ambiguous device selections instead of dispatching.
- Improved webhook API responses:
  - always return stage-aware parse / validation / dispatch status.
- Documented webhook response contract with concrete success / validation / dedupe examples.
- Exposed command aliases to the LLM registry context and command validation flow.
- Aligned Telegram error replies with webhook response taxonomy.
- Expanded command argument validation to support:
  - number min/max
  - string pattern
  - nested object schemas
  - array item validation
  - boolean and integer types.
- Added command form support for `cooldownSeconds`.
- Avoid duplicate-update unique constraint noise by checking recorded update IDs before insert.
- Provider edit no longer mutates the active API key in-place; rotation is handled in a dedicated flow.
- Improved webhook error classification for:
  - provider timeout
  - provider network failure
  - provider HTTP failure
  - target business error (`200 OK` with `{"ok":false}`)
  - target authorization failure.
- Improved Telegram operator replies with:
  - summarized execution result
  - explicit reason codes
  - actionable hints.
- Surfaced 24h operational counts for dispatch success/failure, provider errors, pending confirmations, and Telegram inputs.
- Reduced timestamp typography in `/admin/system` metric cards to avoid overflow.

### Fixed
- Fixed root `.env` loading and runtime path resolution for `apps/web`.
- Fixed SQLite runtime connection path issues under `apps/web`.
- Fixed Prisma 7 adapter usage for SQLite.
- Fixed `/admin/audit` to await Next.js 15 `searchParams`.

### Notes
- Audit UI exists now, but remains an MVP surface.
- SQLite restore is still a single-instance operational workflow and is not intended for multi-replica deployments.
