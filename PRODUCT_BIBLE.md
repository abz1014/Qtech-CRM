# Q-TECH CRM 2.0 — Product Bible

> **Status:** Living document · **Owner:** Product (Q-Tech) · **Last updated:** 2026-07-10
> This is the single source of truth for Q-Tech CRM 2.0. It is grounded in the current codebase, database schema, completed audit (`audit/`), and system discovery (`audit/SYSTEM_DISCOVERY.md`). Where something is genuinely undecided, it is marked **[OPEN]** rather than assumed.

---

## 1. Executive Summary

Q-Tech CRM is the operational backbone for an industrial engineering company that sells industrial automation, instrumentation, electrical solutions, power-quality solutions, engineering services, and software — most equipment imported, Tianman-branded products manufactured in-house. It takes a customer inquiry all the way from "they asked for a price" to "order delivered and paid," coordinating overseas supplier quotes in between.

Version 2.0 is **not** a rewrite and **not** an ERP. It is the disciplined completion of what already exists: a Sales-and-Operations CRM whose core loop (RFQ → supplier quotes → customer quote → order → delivery → payment) already works, but whose captured data is under-surfaced and whose finance layer needs a clean rebuild. 2.0 finishes the half-built parts, turns already-captured data into decision intelligence, and hardens the system for daily production use — without adding inventory, portals, AI, or document generation.

The guiding test for every feature: **does it save time, reduce manual work, prevent mistakes, improve visibility, improve decisions, or improve reporting?** If not, it is not built.

---

## 2. Product Vision

To be the **best Operations CRM for a mid-size industrial engineering trading business** — not the biggest, the best-fitting. The system should let a small team (admin, sales, engineers) run more RFQs and orders with fewer mistakes and zero dropped follow-ups, while giving management the numbers to make decisions without asking anyone to compile a spreadsheet.

Success looks like:
- A salesperson can see, in one place, every RFQ they owe work on today.
- No RFQ is ever forgotten between "supplier asked" and "customer answered."
- Management can answer "how are we converting, and where are we losing?" from the dashboard, not from memory.
- Every order's status is truthful and current, from customer PO to final payment.
- Finance shows real money owed and real margin, from data entered once.

---

## 3. Business Goals

1. **Never miss a follow-up** — every RFQ, inquiry, and order has a next action, and overdue work is impossible to ignore.
2. **Track every RFQ end-to-end** — from receipt through supplier quotes, customer quote, and win/loss, with the reason captured on every loss.
3. **Track every order truthfully** — a single, current status from customer PO to payment received.
4. **Make suppliers comparable** — surface who quoted what, how fast, and at what price/lead-time/MOQ, so selection is evidence-based.
5. **Make customers legible** — repeat business, history, and value visible per customer.
6. **Give management decision data** — conversion rates, response times, loss trends, targets vs. actuals — without manual compilation.
7. **Enter data once** — no duplicate typing between RFQ, quote, and order.
8. **Stay fast and correct** — the numbers on screen must be trustworthy and the app must stay responsive as data grows.

---

## 4. Non-Goals (Out of Scope — do NOT build)

These are explicitly excluded from 2.0. They are recorded here so they are not quietly reintroduced.

- **Inventory / Warehouse Management / stock or location tracking.** "Warehouse" may exist as a real-world step in the physical workflow, but **the system does nothing warehouse-related** — no stock counts, no bins, no goods-received records.
- **Product Catalog** (brands, models, categories, manufacturers). Products remain loose types + free-text specifications, as today.
- **Document generation** — no branded Customer Quotation PDFs, no Purchase Order documents. Quotes and POs are tracked as **data and reference numbers only** (see §18).
- **File attachments / uploads.** Documents are located externally via their reference numbers stored in the CRM.
- **Email / WhatsApp sending from the app.** The system may draft/store text; **sending stays manual**, by deliberate choice.
- **Customer Portal / Supplier Portal.**
- **Mobile apps, IoT, AI/ML, predictive analytics.**
- **Service Management, Installation Management as a product line, Asset Management, Preventive Maintenance.** (Engineer commissioning of an order is in scope; a standalone service module is not.)
- **HR, Payroll, Manufacturing, full ERP modules.**
- **A full accounting system.** Finance is scoped and supportive (§14), not a general ledger.

---

## 5. Design Principles

1. **Simplicity over completeness.** A smaller feature that's used beats a bigger one that's ignored.
2. **Eliminate clicks.** Common actions (advance an order, log a quote, add a follow-up) should be one or two clicks from where the user already is.
3. **Zero duplicate entry.** Data entered on the RFQ flows into the quote and the order — never retyped.
4. **Every page has one clear job.** If a page tries to do three things, it becomes three pages or one focused page.
5. **Every dashboard widget answers a business question.** If you can't name the question, the widget is removed.
6. **Modules integrate naturally.** RFQ → Order → Finance → Actions are one continuous thread, not islands.
7. **No feature bloat and no dead code.** Anything unused is removed; anything shown is real (no mock data).
8. **Low learning curve.** A new salesperson should be productive in a day without training.

---

## 6. Complete Business Workflow

The canonical physical process (the foundation of the system). Each step notes **how the system represents it** — and where the system does nothing (physical-only step).

| # | Workflow step | System representation |
|---|---------------|------------------------|
| 1 | Customer Inquiry | Prospect or existing Client contact; may precede a formal RFQ |
| 2 | RFQ Created | `rfqs` record + `rfq_line_items` (multi-product); status `new` |
| 3 | Supplier Inquiries Sent | `supplier_inquiries` (one per vendor); status flag; **draft stored, sent manually** |
| 4 | Supplier Quotations Received | `supplier_quotes` (many per RFQ): price, currency, lead time, MOQ, validity |
| 5 | Internal Comparison | Supplier comparison view + value score (§12) |
| 6 | **Management Approval** | Informal / real-world step. **The system does not enforce it** — decided out-of-system (small admin+sales team). No approval gate. |
| 7 | Customer Quotation | Tracked as **data**: quoted price, quote-sent date, expiry date; RFQ status `quoted`. **No PDF generated** |
| 8 | Customer Negotiation | Notes / revised quoted price on the RFQ |
| 9 | Customer Purchase Order | Tracked as **data**: customer PO number + PO date on the order. **No document held** |
| 10 | Supplier Selection | Winning `supplier_quotes` row flagged selected; becomes the order's vendor |
| 11 | Advance Payment to Supplier | Tracked as a fact on the order/procurement (amount + date); full AP accounting is Finance (parked) |
| 12 | Production / Procurement | Order status `procurement` |
| 13 | Shipment | Order status transitions toward `in_transit` |
| 14 | Transit | Order status `in_transit` |
| 15 | Warehouse | **Physical-only. System does nothing** (out of scope) |
| 16 | Delivery | Order status `delivered`; delivery date; payment-due date computed |
| 17 | Customer Payment | Order status `payment_received` (terminal) |

**RFQ status model:** `new → in_progress → quoted → converted | lost`.
**Order status model (enforced, forward-only):** `po_received → procurement → in_transit → delivered → payment_received`.

---

## 7. System Architecture Overview

- **Frontend:** Vite + React 18 + TypeScript, shadcn/ui + Tailwind, lazy-loaded routes. Single-page app.
- **State:** Central React context (`CRMContext`) holding entity data, with Supabase Realtime keeping it live; auth in `AuthContext`.
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Row-Level Security). One Edge Function (`create-user`). All business logic currently runs client-side.
- **Hosting/Deploy:** Vercel (SPA) with security headers/CSP. Deploys on push to `main`.
- **Timezone:** All "today"/date logic runs in **Asia/Karachi** via `businessToday()` — never UTC.
- **Known architectural debts (tracked, not features):** business logic is client-side (no server-authoritative sequences/transactions); the app loads whole tables (fine at current scale, admin-gated for financial tables); tests/CI and single-repo consolidation are pending (see Sprint 1 & 12).

> Architecture is intentionally modest and must stay that way. 2.0 does not introduce a separate backend, microservices, or a new data platform.

---

## 8. Module Specifications

Each module lists its **purpose**, **primary data**, **key screens**, and **integration points**. Modules that exist today are marked *(exists)*; those being completed are marked *(complete in 2.0)*.

### 8.1 Clients *(exists; enriched in Sprint 4)*
- **Purpose:** master record of customers.
- **Data:** company, industry, contact, phone, email, address.
- **Screens:** Clients list (search); Client detail.
- **2.0 additions:** client history (their RFQs and orders), repeat-business and value summary surfaced on the detail page (data already relational, just not shown).
- **Integrates with:** RFQs, Orders, Actions.

### 8.2 Prospects *(exists)*
- **Purpose:** pre-customer leads with hot/warm/cold status.
- **Data:** company, contact, lead source, status, follow-up date, assigned rep.
- **Flow:** convert prospect → client.
- **Automation:** new prospect → initial-outreach follow-up.

### 8.3 RFQs *(exists; enriched in Sprint 2)*
- **Purpose:** the heart of the system — a customer's request for pricing.
- **Data:** RFQ number, client, contact, date, priority, estimated value, status, line items (product, qty, spec, target price), quoted price/date/expiry, loss reason/notes.
- **Screens:** RFQ list (search, status filter, date sort); RFQ detail (line items, inquiries, quotes, status, convert-to-order, mark-lost).
- **2.0 additions:** clearer RFQ workspace, deadline visibility, faster status/line-item actions (Sprint 2).
- **Integrates with:** Suppliers (inquiries/quotes), Orders (conversion), Actions.

### 8.4 Supplier Inquiries & Quotes *(exists; comparison completed in Sprint 3)*
- **Purpose:** get and compare supplier prices for an RFQ.
- **Data:** inquiries (vendor, sent date, status, draft text); quotes (vendor, unit price, currency, lead time, MOQ, validity, selected flag).
- **2.0 additions:** side-by-side comparison view with value scoring and a **management approval** gate before the winning quote is quoted to the customer (Sprint 3).

### 8.5 Orders *(exists)*
- **Purpose:** track a won deal through fulfillment to payment.
- **Data:** client, vendor, product type, order value, cost value, customer PO number/date, payment terms, delivery date, payment due date, status.
- **Screens:** Orders list (search by PO#/client/product, sort); Order detail (status advance, engineer assignment).
- **Integrates with:** RFQs (origin), Engineers (commissioning), Finance (revenue/cost/receivables).

### 8.6 Engineer Commissioning *(exists)*
- **Purpose:** assign engineers to an order's on-site commissioning and track status.
- **Data:** order, engineer, site location, start date, expected completion, commissioning status.
- **Screens:** Order detail (assign); **My Jobs** (engineer's view).

### 8.7 Vendors/Suppliers *(exists; enriched in Sprint 5)*
- **Purpose:** supplier directory.
- **Data:** name, country, contact, products supplied (free text).
- **2.0 additions:** supplier performance surfaced (response time, win rate, price competitiveness) from data already captured in inquiries/quotes (Sprint 5).

### 8.8 Actions / Follow-ups *(exists)*
- **Purpose:** ensure nothing is dropped.
- **Data:** action type, linked entity, due date, priority, assignee, status, recurrence.
- **Screens:** Actions center (overdue/today/upcoming, search, snooze, complete-with-outcome); sidebar overdue badge; dashboard alerts.
- **Automation:** auto-created at key workflow events (§17), de-duplicated.

### 8.9 Finance *(order-based today; full rebuild PARKED — see §14)*
- **Purpose:** money in, money out, margin, receivables.
- **Current:** order-based revenue/cost/profit/margin, receivables (delivered-unpaid), overdue.
- **2.0:** deferred to a dedicated later effort with a clean, fully-justified design.

### 8.10 Team *(exists)*
- **Purpose:** admin manages users/roles.
- **Data:** users (name, email, role). Creation via secure Edge Function (admin-only, server-verified).

---

## 9. Dashboard Specifications

Every widget must answer a named business question. Current + planned:

| Widget | Business question it answers | Source |
|--------|------------------------------|--------|
| Overdue actions alert | "What am I late on?" | follow_up_actions |
| Today's actions / briefing | "What must I do today?" | follow_up_actions |
| Last-10-days pipeline | "Is recent RFQ intake being worked?" | rfqs, inquiries, quotes |
| Monthly pipeline | "How is this month converting?" | rfqs, quotes, orders |
| Quarterly pipeline | "How is the quarter tracking?" | rfqs, quotes, orders |
| Previous-quarter performance (selector) | "How did we do in past quarters?" | same |
| Current-quarter target vs achieved | "Are we on track to goal?" | quarterly_targets, orders |
| Previous-quarter target vs achieved | "Did we hit past goals?" | quarterly_targets, orders |
| Overall KPIs (clients/orders/in-transit/prospects) | "What's the business snapshot?" | clients, orders, prospects |
| Total order value | "How much have we booked?" | orders |
| Top clients by RFQs | "Who are our most active customers?" | rfqs |
| Margin distribution | "How healthy is our margin spread?" | orders |

**2.0 dashboard direction (Sprint 8):** an **Operations Dashboard** consolidating the "state of the business right now" — RFQs awaiting supplier response, quotes awaiting customer decision, orders stuck in a stage too long, payments overdue — each a clickable worklist. No new metric is added unless it names a decision.

---

## 10. Reporting Specifications

Reports are **operational worklists and management summaries**, exportable to CSV. No PDF generation.

- **Daily RFQ Report** *(exists)* — RFQ activity by period, partitioned into Not Floated / Awaiting Response / Responded / Converted, with status/priority/client filters. Purpose: daily follow-up worklist.
- **Finance summary** *(order-based; parked for rebuild)* — revenue/cost/profit/margin, receivables, overdue, revenue-by-month.
- **2.0 reports (Sprint 10):** conversion report (RFQ→PO rate by period/rep/client), loss-reason report (trends over time), supplier response-time report, per-salesperson performance. All computable from existing data; none currently surfaced.

Every report specifies its filters and the exact definition of each number (no ambiguous "revenue").

---

## 11. Customer Intelligence (Sprint 4)

**Question set management wants answered per customer:** How much have they bought (lifetime)? How often do they come back? What's in flight with them right now? What have we lost with them and why?

- **Client history:** list of that client's RFQs and orders on the client detail page (currently the data exists but isn't shown).
- **Lifetime value:** sum of order value for the client.
- **Repeat business:** count/frequency of orders over time.
- **Open pipeline with the client:** active RFQs and orders not yet closed.
- **Loss insight:** the client's lost RFQs with reasons.

All derived from existing tables — this sprint is about **surfacing**, not new data capture.

---

## 12. Supplier Intelligence (Sprint 5)

**Question set:** Which suppliers respond fastest? Who wins on price? Who is reliable?

- **Response time:** average of `received_at − sent_at` across a supplier's inquiries/quotes (data captured today, never shown).
- **Win rate:** how often a supplier's quote is the selected one.
- **Price competitiveness:** how a supplier's quotes rank against others on the same RFQ (value score already exists in code).
- **Supplier history:** the inquiries/quotes and resulting orders per vendor, on the vendor detail page.

Purpose: make **Supplier Selection (workflow step 10)** evidence-based instead of by memory.

---

## 13. Sales Intelligence (Sprint 6)

**Question set:** Are we converting? Where do deals die? Who performs?

- **Conversion funnel & rate:** RFQ → floated → quoted → won, with the drop-off at each stage.
- **Response times:** RFQ received → floated → quoted (speed is the #1 lever in RFQ business).
- **Loss analysis:** loss reasons trended over time.
- **Per-salesperson performance:** volume, conversion, speed, win/loss.

All from existing data (`rfqs`, `supplier_*`, `orders`, `follow_up_actions`). This is the single highest-value analytics sprint because it needs no new integrations and directly informs how the business is run.

---

## 14. Finance Specifications (PARKED — revisit last)

**Decision on record:** the previous invoices/expenses/payables module was built, partly mock-backed, and removed. Finance for 2.0 is **deferred to the end** and will be **rebuilt lean from a clean design** — every field, screen, and number must be justified; nothing decorative or dead.

**Intended scope when built** (subject to that clean-slate review):
- Sales invoices, purchase invoices, expenses, payables, cash flow, profit & loss.
- Single, unambiguous definition of "revenue."
- Real data only — no sample/mock values, no fake audit log.

**Until then:** live finance remains **order-based** (revenue = order value, cost = cost value, margin = the difference; receivables = delivered-unpaid; overdue = past due date). Formal bookkeeping stays in the company's accounting software.

**[OPEN]** The exact rebuilt finance data model is intentionally undecided here and will be specified when this section is reactivated.

---

## 15. Search & Navigation (Sprint 9)

- **Today:** per-page substring search on Clients, Prospects, RFQs, Orders, Vendors; RFQ/Order status & date filters; date sorting.
- **2.0 direction:** consistent, fast search across every list; search by the reference numbers that matter (RFQ number, customer PO number) since those are how physical documents are located (per §18); consistent pagination behavior across all lists. **No global cross-entity search engine** unless a concrete need appears — keep it simple.

---

## 16. Notification System

- **Channel:** **in-app only** — sidebar overdue badge, dashboard alert banners, the Actions center. No email/SMS/WhatsApp/push (out of scope).
- **What's notified:** overdue follow-ups, actions due today, deadline-approaching RFQs, overdue payments.
- **Principle:** a user who logs in should immediately see what's late and what's due — without hunting.

---

## 17. Automation Rules

All automation is event-driven (triggered by user actions in-app); **no scheduled server jobs, no emails**.

| Trigger | Auto-action |
|---------|-------------|
| New prospect | Initial-outreach follow-up (+1 day) |
| New RFQ | Follow-up to progress it (+1 day, priority = RFQ priority) |
| RFQ set to `quoted` | Customer follow-up (+3 days); stamp `quote_sent_date` if empty |
| RFQ converted to order | Follow-up (+5 days); create order |
| Supplier inquiry sent | Await-response follow-up (+2 days) |
| Order reaches `delivered` | Payment follow-up (+ payment terms); compute `payment_due_date` |
| Follow-up completed with recurrence | Next occurrence auto-created |

**Rules:** auto follow-ups are **de-duplicated** (one pending action per entity + type); completing an action **appends** an outcome note (never destroys the original); recurrence uses the `recurrence_days` field.

**2.0 (Sprint 11):** codify and extend these rules (e.g., stale-order nudges: an order sitting in one stage beyond a threshold raises a follow-up) — **without** adding any external sending.

---

## 18. Business Rules

- **Quote & PO are data, not documents.** The system stores quoted price, quote-sent date, quote expiry, customer PO number, and PO date. It does **not** generate or store the actual files; those are found externally by their reference numbers.
- **Management Approval is informal — NOT a system feature.** Decided (2026-07-10): with a small admin+sales team, approval happens as a real-world conversation, not an enforced gate. The system does not block or stamp it. Do not build an approval workflow.
- **One order = one supplier = one product type.** Multiple suppliers or products for one RFQ are modeled as multiple orders under that RFQ.
- **An RFQ may spawn multiple orders.** Deleting one order must not corrupt the RFQ if sibling orders remain (already enforced).
- **Order status is forward-only** through the defined lifecycle.
- **A lost RFQ must record a loss reason.**
- **Target achieved = order value by customer PO date within the quarter** (single canonical date; no mixing date types).
- **Dates are Asia/Karachi.** "Today" is always business-local.
- **Deleting a client cascades** to its RFQs, orders, and follow-ups (enforced at DB + app).
- **Financial data is admin-only** (loaded and visible only to admins).

---

## 19. Permission Matrix

| Area | Admin | Sales | Engineer |
|------|:-----:|:-----:|:--------:|
| Dashboard | ✅ | ✅ | ❌ |
| Clients / Prospects | ✅ (edit/delete) | ✅ (create/edit) | ❌ |
| RFQs / Inquiries / Quotes | ✅ | ✅ | ❌ |
| Orders | ✅ | ✅ | ❌ |
| Engineer commissioning (assign) | ✅ | ✅ | view own |
| My Jobs | ❌ | ❌ | ✅ |
| Actions | ✅ | ✅ | ❌ |
| Vendors | ✅ | ✅ | ❌ |
| Finance | ✅ | ❌ | ❌ |
| Team (users/roles) | ✅ | ❌ | ❌ |
| Quarterly targets (set) | ✅ | ❌ | ❌ |
| Delete records | ✅ | ❌ | ❌ |

Enforcement is **client-side (UI/routes) + server-side (Supabase RLS)**. Roles stay **admin/sales/engineer** — no new roles unless a concrete need forces it. The role model is a fixed enum; adding granular permissions later would require a roles/permissions table (noted, not planned).

---

## 20. UI/UX Standards

- **One clear purpose per page**; primary action visible without scrolling.
- **Consistent components:** one shared modal pattern (focus-trapped, Escape-closable), one toast system for feedback (no native `alert()`), one confirm dialog.
- **Consistent formatting:** currency always PKR via the shared formatter; dates via the shared date formatter (single locale); status colors from a single shared map.
- **Loading & empty states** on every data page (skeletons, not blank flashes).
- **Inline validation** on forms (not popup errors).
- **Detail pages** carry a clear back path and the entity's related context.
- **No decorative widgets** — every element earns its place.

---

## 21. Responsive Design Standards

**Updated 2026-07-10: mobile is now a FIRST-CLASS target.** The team uses the CRM on phones in the field, not only at a workstation. Every screen must be genuinely usable on a phone — not merely "not broken."

- **Dual target: desktop AND mobile.** Both must be comfortable; neither is an afterthought.
- **Mobile list pages:** filters must not consume the first screen — collapse them behind a toggle so data is visible immediately. Wide data tables should present as stacked cards on phones (one record = one card) rather than forcing horizontal scroll, OR scroll cleanly within their container with the key identifier visible first.
- **Touch targets:** buttons and rows large enough to tap; primary action reachable without hunting.
- **Sidebar** collapses to a hamburger drawer (already implemented).
- **Modals** fit small viewports; the page body never scrolls horizontally.
- **No dedicated native mobile app** (out of scope) — this is the responsive web app doing the job well on a phone browser.
- **Definition of done for any screen:** open it on a phone and complete its core task without pinch-zooming or side-scrolling to find things.

---

## 22. Performance Standards

- **Perceived load:** interactive dashboard in a few seconds on a normal connection; route changes feel instant (lazy chunks already split).
- **No render jank:** no `backdrop-filter` blur over scrolling content; heavy list computations memoized; realtime updates must not duplicate rows.
- **Data access:** whole-table loads are acceptable at current scale but must be watched; financial tables load only for admins.
- **Bundle:** vendor libraries code-split; keep the main chunk lean.
- **Definition of done for any feature:** it does not measurably slow the dashboard or list pages.

---

## 23. Security Standards

- **Auth:** Supabase Auth (email/password); no plaintext passwords anywhere.
- **Authorization:** RLS is the real boundary (client checks are cosmetic); every table has role-appropriate SELECT/INSERT/UPDATE/DELETE policies, tracked in `supabase/migrations/`.
- **Secrets:** only the publishable anon key ships to the client; service keys stay server-side (Edge Function). No secrets committed to the repo.
- **Headers/CSP:** strict CSP (no `unsafe-inline` scripts), HSTS, frame-deny, Permissions-Policy.
- **Exports:** CSV exports sanitized against formula injection.
- **Principle:** a user can only see and change what their role allows, enforced at the database.

---

## 24. Data Validation Rules

- **Required fields** enforced on create (client on order, contact on client/RFQ, etc.).
- **Referential integrity** at the DB via foreign keys (orders↔rfqs, invoices/expenses↔rfqs, follow-ups↔entities); no orphan records.
- **Uniqueness** where it matters (e.g., invoice numbers when finance is rebuilt).
- **Dates** stored as strict `YYYY-MM-DD`; compared in business timezone.
- **Money** handled without float-equality bugs (compare in minor units); displayed via the shared formatter.
- **Status transitions** validated (orders forward-only; lost RFQ requires a reason).
- **No mock/sample data in production paths.**

---

## 25. Coding Standards

- **TypeScript throughout**, typed at module boundaries (no stray `any` where a type exists).
- **Shared helpers, not copies:** dates (`businessToday`), currency, status maps live in one place each.
- **Errors surface to the user** — no silently-swallowed write/delete failures; a failed DB operation shows a toast and does not mutate local state as if it succeeded.
- **Realtime writes are idempotent** (dedup by id).
- **No dead code** — unused components/functions are removed, not left dormant.
- **Match surrounding style**; keep functions and components focused (large files like the RFQ detail page are candidates for decomposition, not growth).

---

## 26. Testing Standards

- **Pure logic is unit-tested:** date/quarter math, pipeline/metric calculations, payment status, status transitions (these caused the most audit bugs and are the cheapest to test).
- **Realtime reducers tested** for no-duplicate behavior.
- **A happy-path E2E** covers the core loop: login → create RFQ → float → quote → convert → verify dashboard counts.
- **RLS contract check:** each role attempts each operation; expected allow/deny asserted.
- **CI runs typecheck + unit tests on every push** (Sprint 1/12).
- **Target:** the calculations management relies on are covered before finance is rebuilt.

---

## 27. Deployment Standards

- **Single source repository** — consolidate the current dual-repo (dev vs. deploy) drift into one working tree with a clean git history (Sprint 1).
- **CI gate:** typecheck + tests must pass before deploy.
- **Vercel** auto-deploys `main`; migrations are tracked SQL in `supabase/migrations/` and applied deliberately (not ad-hoc from the dashboard).
- **Every migration is idempotent and reviewed**; schema changes never happen only in production.
- **Rollback:** a failed deploy must not leave the DB half-migrated.

---

## 28. Future Roadmap (beyond 2.0)

Recorded so they aren't built now, but aren't forgotten:
- Finance rebuild (the parked §14 work) — likely the first post-core effort.
- Server-authoritative logic (Postgres functions/sequences for numbering, atomic multi-step operations).
- Deeper per-rep and per-customer analytics once the base intelligence sprints prove their value.
- Anything on the Non-Goals list remains a **future phase only if the business explicitly reprioritizes it.**

---

# SPRINT ROADMAP

Twelve sprints, each independently deployable, none merged. **Sprint 7 (Finance) is PARKED** by decision and revisited last. No sprint introduces email/WhatsApp sending, document generation, file uploads, inventory, or portals.

> Complexity scale: **S** (days), **M** (1–2 weeks), **L** (multi-week). These are relative sizing, not commitments.

---

## Sprint 1 — Foundation & Data Integrity
- **Objective:** make the base trustworthy and the delivery pipeline clean before building features on top.
- **Business problem:** past silent data bugs (duplicated rows, wrong "today", deleted records reappearing) eroded trust in the numbers; dev/deploy runs from two hand-copied repos with no tests.
- **User stories:**
  - As a manager, I trust that a number on the dashboard is correct.
  - As a salesperson, when I delete something it stays deleted.
  - As a developer, I deploy from one repo with tests guarding regressions.
- **Functional requirements:** confirm all audit-critical fixes are live (realtime dedup, business-timezone dates, error-surfacing on writes/deletes, foreign keys, RLS delete policies, canonical order-date for targets); run the tracked migrations; consolidate to a single repo; add CI (typecheck + unit tests); unit-test the date/metric helpers.
- **UI changes:** none of substance (toasts already replace alerts).
- **Backend changes:** apply tracked migrations; no new tables.
- **Database changes:** FKs, delete policies, invoice-number uniqueness, `payable_payments`, realtime for targets (migrations already authored).
- **Acceptance criteria:** creating any record shows it once without reload; deletes persist; every list/metric uses business-local dates; CI green on push; one repo of record.
- **Regression risks:** migration on live data (dangling refs) — mitigated by idempotent, cleanup-first scripts.
- **Test cases:** create RFQ→appears once; delete order→gone after reload; quarter boundary at 01:00 PKT correct; RLS: sales delete denied, admin allowed.
- **Out of scope:** any new feature.
- **Complexity:** M. **Business value:** foundational trust + safe delivery.

## Sprint 2 — RFQ Experience
- **Objective:** make the RFQ workspace fast and complete — the most-used screen.
- **Business problem:** the RFQ detail page is large and does everything; common actions take too many clicks; deadlines aren't prominent.
- **User stories:** as a salesperson, I manage line items, inquiries, quotes, status, and deadline from one clear RFQ screen without hunting.
- **Functional requirements:** streamlined RFQ workspace; prominent deadline/priority; quick status actions; clean line-item editing; consistent inline validation.
- **UI changes:** RFQ detail decomposition into clear sections; deadline visibility on list + detail.
- **Backend changes:** none beyond existing.
- **Database changes:** none (fields exist).
- **Acceptance criteria:** every RFQ action reachable in ≤2 clicks; deadline visible on list; validation inline.
- **Regression risks:** refactor of a large page — covered by the core-loop E2E.
- **Test cases:** add/edit/delete line item; change status; mark lost requires reason.
- **Out of scope:** supplier comparison UI (Sprint 3); documents.
- **Complexity:** M. **Business value:** daily time saved on the busiest screen.

## Sprint 3 — Supplier Comparison ✅ DONE (2026-07-10)
- **Objective:** make supplier selection evidence-based.
- **Business problem:** the comparison logic existed but its UI was removed; selection was by memory.
- **User story:** as a salesperson, I compare supplier quotes side-by-side, see a value score, and lock in the winning supplier.
- **Delivered:** quotes table on RFQ detail now shows a **Value Score** column (price 50% / lead 30% / MOQ 20%), badges the **★ Best Value** / lowest-price / **✓ Winner** quote, and a one-click **Select** (admin/sales) marks the winning supplier via the existing `is_selected` field.
- **UI changes:** enhanced quotes comparison table on RFQ detail.
- **Backend changes:** surfaced existing `calculateValueScore`; no new logic.
- **Database changes:** none (`is_selected` already existed).
- **Acceptance criteria:** ✅ quotes comparable at a glance with score + winner selection.
- **Management approval:** **removed from scope** — decided informal/out-of-system (see §18).
- **Out of scope:** supplier PO documents; approval workflow.
- **Complexity:** M (delivered). **Business value:** better buying decisions.

## Sprint 4 — Customer Intelligence
- **Objective:** make each customer legible on their detail page.
- **Business problem:** client detail shows only contact info; history/value/repeat business live in the data but are invisible.
- **User stories:** as a manager, I open a client and see their lifetime value, repeat business, open pipeline, and losses.
- **Functional requirements:** client history (RFQs + orders), lifetime value, repeat-order frequency, open pipeline, lost-with-reason.
- **UI changes:** enriched client detail.
- **Backend changes:** aggregation queries (data exists).
- **Database changes:** none.
- **Acceptance criteria:** client detail shows correct totals matching source rows.
- **Regression risks:** low (read-only).
- **Test cases:** LTV equals sum of client's orders; repeat count correct.
- **Out of scope:** portals.
- **Complexity:** S–M. **Business value:** account management visibility.

## Sprint 5 — Supplier Intelligence
- **Objective:** surface supplier performance to guide selection.
- **Business problem:** response time and win rate are captured but never shown.
- **User stories:** as a buyer, I see which suppliers respond fastest and win most before I float an inquiry.
- **Functional requirements:** response time (received−sent), win rate, price competitiveness, per-vendor history.
- **UI changes:** enriched vendor detail; comparison-time hints.
- **Backend changes:** aggregation.
- **Database changes:** none.
- **Acceptance criteria:** metrics match underlying inquiries/quotes.
- **Regression risks:** low (read-only).
- **Test cases:** response time computed correctly; win rate = selected/quoted.
- **Out of scope:** supplier portal.
- **Complexity:** S–M. **Business value:** faster, better sourcing.

## Sprint 6 — Sales Intelligence
- **Objective:** turn captured data into how-we-run-the-business decisions.
- **Business problem:** no conversion rate, response-time, loss-trend, or per-rep view exists.
- **User stories:** as management, I see conversion by stage, where deals die, response speed, and per-salesperson performance.
- **Functional requirements:** conversion funnel + rate; RFQ→quote response times; loss-reason trends; per-rep metrics.
- **UI changes:** a sales-intelligence view/section.
- **Backend changes:** aggregation.
- **Database changes:** none.
- **Acceptance criteria:** every metric has a precise definition and matches source data.
- **Regression risks:** low (read-only).
- **Test cases:** conversion rate = won/received for period; loss trend buckets correct.
- **Out of scope:** predictive analytics.
- **Complexity:** M. **Business value:** highest-leverage management insight (no new data needed).

## Sprint 7 — Finance (PARKED)
- **Status:** deferred by decision; revisited **last**, designed lean from a clean slate with every field justified. See §14.
- **Placeholder scope:** sales invoices, purchase invoices, expenses, payables, cash flow, P&L — real data only.
- **Do not start** until reactivated by the product owner.

## Sprint 8 — Operations Dashboard
- **Objective:** a single "state of the business now" screen of actionable worklists.
- **Business problem:** current dashboard is metric cards; it doesn't show *what's stuck* and clickable next steps.
- **User stories:** as an operator, I see RFQs awaiting supplier response, quotes awaiting customer decision, orders stuck in a stage, and overdue payments — and click straight to them.
- **Functional requirements:** clickable worklists for each "stuck" condition; stage-age thresholds.
- **UI changes:** operations dashboard section.
- **Backend changes:** derived queries.
- **Database changes:** none.
- **Acceptance criteria:** each worklist links to the right filtered list; counts accurate.
- **Regression risks:** low.
- **Test cases:** an order stuck > threshold appears; clicking opens it.
- **Out of scope:** new metrics without a decision behind them.
- **Complexity:** M. **Business value:** proactive operations control.

## Sprint 9 — Search & Navigation
- **Objective:** consistent, fast finding across the app.
- **Business problem:** search/pagination behavior is inconsistent; finding by reference number matters (documents are located by ID).
- **User stories:** as any user, I find a client/RFQ/order/vendor quickly and by the numbers I actually use (RFQ number, PO number).
- **Functional requirements:** consistent list search + filters; reference-number search; consistent pagination persistence.
- **UI changes:** unified search/pagination components.
- **Backend changes:** none.
- **Database changes:** none.
- **Acceptance criteria:** every list searches consistently; PO/RFQ number lookups work everywhere relevant.
- **Regression risks:** low.
- **Test cases:** search by PO number returns the order; pagination persists on back-nav.
- **Out of scope:** global cross-entity search engine.
- **Complexity:** S–M. **Business value:** everyday time saved.

## Sprint 10 — Reporting
- **Objective:** management-grade reports with precise definitions and CSV export.
- **Business problem:** only the Daily RFQ Report and an order-based finance view exist.
- **User stories:** as management, I export conversion, loss, supplier response, and per-rep reports for review.
- **Functional requirements:** conversion report; loss-reason report; supplier response-time report; per-rep report; each with filters + defined numbers + CSV.
- **UI changes:** reports section.
- **Backend changes:** aggregation.
- **Database changes:** none.
- **Acceptance criteria:** report numbers match source; CSV sanitized.
- **Regression risks:** low.
- **Test cases:** conversion report matches manual count; CSV opens clean.
- **Out of scope:** PDF; scheduled email delivery.
- **Complexity:** M. **Business value:** decision-ready reporting.

## Sprint 11 — Workflow Automation
- **Objective:** extend in-app automation to catch stalls — no external sending.
- **Business problem:** follow-ups fire on events but nothing flags an order/RFQ that goes quiet.
- **User stories:** as a manager, stale RFQs/orders automatically raise a follow-up so nothing stalls silently.
- **Functional requirements:** stage-age nudges (e.g., order in a stage beyond threshold → follow-up); codified, de-duplicated automation rules; recurrence via `recurrence_days`.
- **UI changes:** minor (surfaced nudges).
- **Backend changes:** rule evaluation on relevant events.
- **Database changes:** none of substance.
- **Acceptance criteria:** a stalled item raises exactly one follow-up; no duplicates.
- **Regression risks:** duplicate-action risk — covered by dedup tests.
- **Test cases:** order stuck past threshold → single follow-up; re-eval doesn't duplicate.
- **Out of scope:** email/WhatsApp/SMS/push.
- **Complexity:** M. **Business value:** fewer stalls, less babysitting.

## Sprint 12 — Production Readiness
- **Objective:** finalize quality, performance, and operability for confident daily use.
- **Business problem:** tests/CI, performance passes, and polish (skeletons, consistent modals) need to be complete and verified.
- **User stories:** as the business, I rely on the system daily without surprises.
- **Functional requirements:** full CI (typecheck + unit + core E2E + RLS contract); performance pass (no jank, lean bundles); UX consistency (shared modal/confirm/toast, skeletons everywhere, single date/currency/status maps); remove any remaining dead code.
- **UI changes:** consistency polish.
- **Backend changes:** none of substance.
- **Database changes:** none.
- **Acceptance criteria:** CI green and gating; no known correctness bugs open; consistent UX; performance targets met.
- **Regression risks:** low (hardening).
- **Test cases:** the full test suite passes; core loop E2E green.
- **Out of scope:** new features.
- **Complexity:** M. **Business value:** confident, low-surprise production operation.

---

## Open Items Register (to resolve as sprints reach them)

| Ref | Open question | Resolve in |
|-----|---------------|-----------|
| §14 | Rebuilt finance data model (lean, justified) | Sprint 7 (parked) |
| §18 / Sprint 3 | Management-approval mechanics | ✅ RESOLVED (2026-07-10): informal, not a system feature |
| §15 | Whether reference-number search needs any server-side support at scale | Sprint 9 |
| §19 | Whether granular permissions (beyond 3 roles) are ever needed | Future only |

---

*End of Product Bible. This document is authoritative; any change to scope, workflow, or the Non-Goals list must be reflected here first.*
