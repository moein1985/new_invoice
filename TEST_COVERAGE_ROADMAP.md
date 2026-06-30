# Roadmap: Reach 70% Test Coverage

## Current State (Baseline)
- Global coverage is low because many `app/*` pages and `server/api/*` routers are currently untested.
- Existing tests mostly cover validation and a subset of PDF/sanitize logic.

## Target Strategy
- Do not chase 70% randomly.
- Increase coverage in high-impact order:
  1. `server/api/routers/*` (largest business logic)
  2. `app/api/*/route.ts` (auth + validation + IO branches)
  3. `lib/services/*` (export and helper branches)
  4. critical UI flows (selected pages/components)

## Phase Plan

### Phase 1 (Immediate: this sprint)
Goal: Build stable backend/unit testing foundation and move coverage materially.

- Add route tests:
  - `app/api/upload/purchase/route.ts`
  - `app/api/uploads/purchases/[...path]/route.ts`
- Add service tests:
  - `lib/services/vfs-fonts.ts`
- Add 1 integration-safe router test harness for `purchaseRouter` (mocked prisma/session context).
- Enforce stable local execution:
  - `npm run test -- --runInBand --passWithNoTests`

Exit criteria:
- All new tests pass locally.
- Tests synced to server host non-interactively.

### Phase 2 (Core business logic)
Goal: Cover major router branches.

- `server/api/routers/purchase.ts`
  - list role filtering
  - create requestNumber generation
  - addInquiry restrictions
  - submit/approve/reject transitions
  - forbidden and not-found paths
- `server/api/routers/document.ts`
  - list filters/search/deepSearch/date range
  - exportFiltered shaping
  - transition and guard branches

Exit criteria:
- Router-level branch coverage grows significantly.

### Phase 3 (Service and API expansion)
Goal: Cover heavy service files and API guards.

- `lib/services/pdf-export-v2.ts`
- `lib/services/pdf-export-html.ts`
- `lib/services/excel-export.ts`
- API auth/error branches for document/work-report PDF routes.

Exit criteria:
- Services no longer near 0% in coverage report.

### Phase 4 (UI and E2E critical path)
Goal: Prevent regressions in key user flows and raise page coverage.

- Add RTL tests for critical components/pages:
  - login
  - create customer
  - create document
  - purchase list/detail
- Keep Playwright smoke flows for end-to-end confidence.

Exit criteria:
- Core user journey tests green.

## Work Queue (Next actions)
1. Add tests for `purchaseRouter` core flows. (Started, initial suite added)
2. Add tests for `documentRouter` core flows.
3. Add tests for `app/api/upload/purchase/route.ts` with a Next-compatible route harness.
4. Sync newly added tests to server host with `pscp -batch`.
5. Execute server-side tests where source tree is available.

## Progress Update
- Added and passing: `__tests__/purchase-router.test.ts` (6 tests)
- Added and passing: `__tests__/document-router.test.ts` (11 tests)
- Added and passing: `__tests__/customer-router.test.ts` (8 tests)
- Added and passing: `__tests__/user-router.test.ts` (10 tests)
- Added and passing: `__tests__/project-router.test.ts` (7 tests)
- Added and passing: `__tests__/workreport-router.test.ts` (7 tests)
- Added and passing: `__tests__/stats-router.test.ts` (3 tests)
- Added and passing: `__tests__/search-router.test.ts` (2 tests)
- Added and passing: `__tests__/document-pdf-route.test.ts` (4 tests)
- Added and passing: `__tests__/workreport-pdf-route.test.ts` (5 tests)
- Added and passing: `__tests__/upload-purchase-route.test.ts` (8 tests)
- Added and passing: `__tests__/uploads-purchases-route.test.ts` (5 tests)
- Added and passing: `__tests__/vfs-fonts.test.ts`, `__tests__/holidays.service.test.ts`

Latest targeted coverage snapshot (selected suites):
- All files: `12.85%` statements
- `server/api/routers/document.ts`: `60.76%` statements
- `server/api/routers/purchase.ts`: `36.69%` statements
- `server/api/routers/customer.ts`: `93.18%` statements
- `server/api/routers/user.ts`: `93.10%` statements
- `server/api/routers/project.ts`: `95.12%` statements
- `server/api/routers/workReport.ts`: `82.35%` statements
- `server/api/routers/stats.ts`: `100%` statements
- `server/api/routers/search.ts`: `100%` statements

Focused API route coverage snapshot (PDF endpoints):
- `app/api/documents/[id]/pdf/route.ts`: `100%` statements, `100%` branches
- `app/api/work-reports/[reportId]/pdf/route.ts`: `100%` statements, `100%` branches

Focused API route coverage snapshot (PDF + upload endpoints):
- API-focused all-files set: `39.56%` statements, `32.23%` branches
- `app/api/upload/purchase/route.ts`: `94.23%` statements, `88.88%` branches
- `app/api/uploads/purchases/[...path]/route.ts`: `100%` statements, `100%` branches

## Non-Interactive Server Sync Commands
Use these patterns to avoid Enter prompts:

```powershell
plink -batch -no-antispoof -ssh moein@192.168.85.11 -P 22 -pw 12321 "<command>"
pscp -batch -P 22 -pw 12321 "<local-file>" moein@192.168.85.11:/home/moein/new_invoice/<remote-path>
```

## Risk Notes
- Runtime container image may not include full source tree (`/app/pages` or `/app/app`) and can fail Next/Jest bootstrap.
- In that case, run tests on server host repository path (`/home/moein/new_invoice`) or rebuild image with sources for test jobs.
