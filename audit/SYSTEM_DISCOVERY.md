# SYSTEM_DISCOVERY.md — Q-Tech CRM

> Read-only discovery. Every answer is grounded in the actual code, types, routes, and schema. Where the codebase does not implement or reveal something, it is marked **Not Implemented** or **Cannot Determine**. No assumptions.

---

## BUSINESS

**1. Primary purpose**
A sales-and-operations tracking system for an industrial engineering / equipment-trading business. It records customer requests for quotations (RFQs), coordinates getting prices from overseas suppliers, quotes the customer, and — when won — tracks the resulting order from purchase order through procurement, shipment, delivery, engineer commissioning, and payment. Product types in the code (`DVR`, `SVG`, `AHF`, `Automation`, `Software` — `src/types/crm.ts:7`) indicate power-quality / industrial-automation equipment.

**2. Business workflow currently supported**
Prospect → Client → RFQ received → floated to suppliers (inquiries) → supplier quotes collected → quote sent to client → RFQ won (converted to order) or lost → Order lifecycle (PO received → procurement → in transit → delivered → payment received) → optional engineer assignment / commissioning at the customer site. Follow-up reminders are auto-generated at key steps. Management sees pipeline metrics, quarterly targets, and order-based financials.

**3. Industries targeted**
Industrial engineering / electrical power-quality equipment supply (DVR/SVG/AHF are power-electronics products), plus automation and software. Client records carry a free-text `industry` field. Sample data referenced heavy industry (textiles, cement, glass, sugar mills — from earlier session data).

**4. CRM, ERP, Ops, Procurement, or combination?**
A **combination, primarily a Sales CRM + light Operations/Procurement tracker.** It is a CRM at its core (clients, prospects, RFQs, follow-ups), with an operations layer (order lifecycle, engineer commissioning) and a light procurement layer (supplier inquiries/quotes, one supplier per order). It is **not** a full ERP — there is no inventory, no general ledger in use, no formal procurement PO document to suppliers, no approvals.

**5. Business processes FULLY implemented** (verifiable end-to-end in code)
- Client & prospect management (CRUD, prospect→client conversion) — `ClientsPage`, `ProspectsPage`, `convertProspect`
- RFQ management incl. multi-product line items, priority, deadline/status — `RFQsPage`, `RFQDetailPage`, `rfq_line_items`
- Supplier inquiry & multi-quote collection — `supplier_inquiries`, `supplier_quotes`
- RFQ → Order conversion — `convertRFQToOrder`
- Order lifecycle state machine — `allowedTransitions` (`CRMContext.tsx:15-21`)
- Engineer assignment & commissioning status — `order_engineers`, `OrderDetailPage`, `MyJobsPage`
- Follow-up action automation & the Actions center — `follow_up_actions`, `ActionsPage`
- Dashboard pipeline metrics + admin quarterly targets — `DashboardPage`, `quarterly_targets`
- Order-based financial reporting — `FinancePage`
- Loss tracking (reason + notes) — `rfqs.loss_reason/loss_notes`
- CSV export on all list pages

**6. Business processes PARTIALLY implemented**
- **Finance / bookkeeping** — a full invoices/expenses/payables/payments data layer exists in `CRMContext` but its entire UI (the 10-tab Bookkeeping module) has been removed; the backend is dormant. The live `FinancePage` derives revenue/cost/profit from **orders**, not invoices.
- **Quotation to customer** — a `quoted_price` / `quote_sent_date` / `quote_expiry_date` are stored on the RFQ, but there is no generated customer quotation *document* and no expiry enforcement.
- **PDF/document generation** — `src/lib/pdfExport.ts` exists but outputs **HTML** (comment: "you would use a library like jsPDF"), and is **not wired to any page**. The Daily RFQ Report's PDF button shows "PDF export coming soon."

**7. Business processes COMPLETELY missing** (Not Implemented)
- Supplier purchase orders (a PO *to* the supplier) — only inquiries/quotes exist
- Inventory / stock management
- Approval workflows (quote approval, discount approval, PO approval)
- Product catalog (brands, models, categories, manufacturers)
- Document attachments / file uploads (no storage usage anywhere)
- Email or WhatsApp sending (drafts are stored, never sent)
- Shipment/logistics tracking beyond a single `in_transit` status and a `delivery_date`
- Customer lifetime value / repeat-business analytics
- Supplier performance / response-time analytics
- Multi-currency accounting (quotes carry a currency field; the app displays PKR only)
- Audit trail (no `audit_log` table)

---

## USERS

**8. Roles that exist** (`src/types/crm.ts:1`, sidebar `roles`)
`admin`, `sales`, `engineer`.

**9. What each role can do** (from `navItems` roles + `RequireRole` guards + page-level `isAdmin` checks)
- **admin**: everything — Dashboard, Clients, Prospects, RFQs, Daily RFQ Report, Orders, Actions, Vendors, **Finance** (admin-only), **Team** (admin-only), plus edit/delete privileges gated by `isAdmin` on detail pages, and setting quarterly targets.
- **sales**: Dashboard, Clients, Prospects, RFQs, Daily RFQ Report, Orders, Actions, Vendors. Can create/edit RFQs, inquiries, quotes, orders, follow-ups. Cannot access Finance or Team; cannot delete (delete buttons/policies are admin-gated).
- **engineer**: **My Jobs** only (their assigned order commissioning tasks). No access to sales/finance areas.

**10. Permissions that exist**
- **Client-side**: sidebar link filtering by role; `RequireRole` route guards on `/team`, `/finance`, `/my-jobs`; `isAdmin`/`isSales` checks hiding edit/delete/target actions.
- **Server-side (RLS)**: role-based Postgres policies (SELECT for authenticated, INSERT/UPDATE/DELETE gated by role via the `users` table). Delete policies were added in the `20260710_delete_policies` migration. Financial data loads only for admins.

**11. Is the permission system scalable?**
Partially. Roles are a **fixed enum of three** with hard-coded checks scattered across the sidebar, routes, and individual pages — adding a fourth role or a granular permission (e.g. "sales manager who can see Finance") requires code changes in many places. There is **no permissions/roles table, no per-feature grants, no teams/territories**. Adequate for a small team; not designed for fine-grained or org-scale permissioning.

---

## RFQ LIFECYCLE

**Statuses** (`RFQStatus`, `src/types/crm.ts:11`): `new` → `in_progress` → `quoted` → `converted` | `lost`.

**Transitions** — set manually by sales via the RFQ detail page (`updateRFQStatus`); there is **no enforced state machine** for RFQs (unlike orders). Any status can be set, though the intended flow is new → in_progress → quoted → converted/lost.

**Actions available on an RFQ** (`RFQDetailPage`): edit RFQ details & RFQ number (sales); add/edit/delete line items (products); create supplier inquiries (with an editable email draft); record supplier quotes; mark quotes; change priority; change status; mark as lost (with reason + notes); convert to order.

**Automations tied to the RFQ**
- New RFQ created → auto follow-up "chase" scheduled (+1 day, priority per RFQ priority) — `CRMContext` autoFollowUp on `addRFQ`.
- RFQ set to `quoted` → auto follow-up (+3 days); `quote_sent_date` auto-stamped if empty.
- RFQ converted → order created and a +5-day follow-up scheduled.
- Supplier inquiry sent → +2-day "await supplier response" follow-up.
- Deadline/priority drives dashboard alerts and the Actions overdue badge.
- Auto follow-ups are **de-duplicated** (one pending action per entity+type).

**Validations** — required fields on forms (client, contact, etc.); status set freely; no server-side transition rules for RFQ status. Client existence is validated when creating an order.

**Database tables involved**: `rfqs`, `rfq_line_items`, `supplier_inquiries`, `supplier_quotes`, `clients`, `vendors`, `users`, `follow_up_actions`, and on conversion `orders`.

---

## QUOTATION PROCESS

**Supplier quotation flow**: For an RFQ, sales create one or more **supplier inquiries** (`supplier_inquiries`, one per vendor, with an editable `email_draft` and a `status` of pending/responded/no_response). When a supplier replies, sales record a **supplier quote** (`supplier_quotes`: `unit_price`, `currency`, `lead_time_days`, `moq`, `validity_days`, `notes`, `is_selected`, linked to the inquiry).

**Customer quotation flow**: Captured as fields on the RFQ (`quoted_price`, `quote_sent_date`, `quote_expiry_date`) and the status `quoted`. There is **no generated customer quotation document** and no separate customer-quote table.

**Approval process**: **Not Implemented.** No approval fields, states, or approver role.

**Comparison process**: A value-scoring function (`calculateValueScore`: price/lead-time/MOQ weighted) and a "recommended quote" helper exist in `CRMContext`, **but the supplier-comparison UI component was removed** — so comparison is currently code-only/dormant, not surfaced to users. **Cannot Determine** any live comparison screen.

- **Multiple supplier quotations?** **Yes** — `supplier_quotes` is one-to-many per RFQ.
- **Multiple revisions?** **Not Implemented** — no revision/version field on quotes; a new quote row would be added, but there is no revision tracking or history chain.
- **Do quotations expire?** Fields exist (`validity_days` on supplier quotes, `quote_expiry_date` on the RFQ) but **no expiry automation or enforcement** — nothing flags or acts on an expired quote.

---

## ORDER PROCESS

**Statuses** (enforced state machine, `allowedTransitions`): `po_received` → `procurement` → `in_transit` → `delivered` → `payment_received`. Transitions are forward-only through `updateOrderStatus`/`getNextOrderStatus`.

- **Customer PO**: captured on the order (`customer_po_number`, `customer_po_date`). Entered when an RFQ converts or when an order is created directly (e.g., WhatsApp order without an RFQ).
- **Supplier PO**: **Not Implemented** — no purchase order document/record sent to the supplier; the order stores a single `vendor_id`.
- **Procurement**: represented by the `procurement` status only (a stage flag), not a detailed procurement record.
- **Shipment**: represented by `in_transit` status + `delivery_date`; no carrier/tracking/logistics detail.
- **Delivery**: `delivered` status; delivery date; on reaching `delivered`, a payment-follow-up is auto-scheduled based on `payment_terms_days`, and `payment_due_date` is computed.
- **Installation / commissioning**: engineers are assigned to an order (`order_engineers`: engineer, `site_location`, `start_date`, `expected_completion`, `commissioning_status` pending/in_progress/completed). Engineers see and update these under **My Jobs**.
- **Completion**: `payment_received` is the terminal order status; commissioning has its own `completed` status. There is no single unified "order fully closed" flag combining payment + commissioning.

---

## PROCUREMENT

**How it works today**: For an RFQ, sales send inquiries to vendors and record their quotes. When the deal is won, an **order** is created carrying **one `vendor_id`** (the chosen supplier) and **one `product_type`**. The `procurement` status marks that the order is being fulfilled. There is no supplier PO, no goods-receipt, no partial-receipt tracking.

- **Can one customer order have multiple suppliers?** **No** — an order has a single `vendor_id`. (Multiple suppliers could only be modeled as multiple orders under the same RFQ.)
- **Can one supplier supply multiple products?** At the RFQ/quote level, informally yes (a vendor can be quoted on several line items, and `vendors.products_supplied` is free text). At the **order** level, each order is one product_type + one vendor, so a single order does not itemize multiple products.
- **Can procurement be partially completed?** **Not Implemented** — procurement is a single status flag, not quantity-tracked; there is no partial receipt.

---

## PRODUCTS

**Architecture**: There is **no product catalog table.** Products appear in two forms:
1. `Order.product_type` — a loose enum/string (`DVR|SVG|AHF|Automation|Software` or free text).
2. `RFQLineItem` — free-text `product_type`, `quantity`, `specification`, optional `target_price`.

Do products have… **Brands: No. Categories: No (only the 5 loose product_type values). Models: No. Specifications: Yes but only as free text on RFQ line items. Manufacturers: No** (the closest is `vendors.products_supplied`, a free-text string).

- **Can one RFQ contain multiple products?** **Yes** — via `rfq_line_items` (one-to-many).
- **How are products linked to quotations and orders?** Loosely, by text. Supplier quotes attach to the **RFQ** (not to a specific line item — `supplier_quotes` has no `line_item_id`). Orders carry a single `product_type` string. There is **no referential link from a product record to quotes/orders** because there is no product entity.

---

## CLIENTS

**Stored for customers** (`Client`): company name, industry, contact person, phone, email, address, created_by. That is all.

- **How are relationships managed?** Through RFQs, orders, and manually-added follow-up actions attached to the client. Prospects convert into clients (`converted_client_id`).
- **Is customer history available?** **Not on the client screen.** `ClientDetailPage` shows only contact/business info + an "Add Follow-up" button. It does **not** list that client's RFQs, orders, or interactions. (The data is relationally present but not surfaced per-client.)
- **Can management see lifetime value?** **Not Implemented** — no per-client revenue rollup anywhere.
- **Can management see repeat business?** **Not Implemented** on the client screen. The dashboard's "Top Clients by RFQs" (count of RFQs per client) is the only client-frequency signal.

---

## SUPPLIERS

**Stored** (`Vendor`): name, country, contact person, phone, email, `products_supplied` (free text).

- **Supplier performance measurable?** **Not Implemented** — `VendorDetailPage` shows only static vendor info; no win-rate, price competitiveness, or reliability metrics are surfaced.
- **Supplier response time measurable?** **Data exists but not surfaced.** `supplier_inquiries.sent_at` and `supplier_quotes.received_at` are stored, so response time is computable, but **no screen or report displays it**.
- **Supplier history viewable?** **Not on the vendor screen.** Inquiries/quotes are visible from the RFQ side, not aggregated per vendor. Vendor detail shows no interaction history.

---

## FINANCE

> Two layers exist. The **live** layer is order-based (on `FinancePage`, admin-only). A second **invoice/expense/payables** layer exists in `CRMContext` but its UI (Bookkeeping module) was removed and the backend is dormant.

**Live (FinancePage, from `orders`)**:
- **Revenue** = Σ `order_value` of orders whose PO/confirmed date falls in the selected range.
- **Cost** = Σ `cost_value`. **Profit** = revenue − cost. **Margin** = profit/revenue %.
- **Receivables ("Payments Pending")** = value of **delivered but unpaid** orders.
- **Overdue** = orders past `payment_due_date` and not paid.
- **Revenue-by-month** bar chart across the selected range.
- Presets: This Month, Last 3 Months, This Year, Last Year, All Time, Custom.

**Dormant (CRMContext, no live UI)**:
- **Invoices** (`invoices`), **Expenses** (`expenses`), **Payments** (`payment_records`), **Payables** (`payables`), and helper functions for MTD/YTD, AR/AP aging, cashflow, monthly summary, project profitability. Payment recording logic exists (`recordPayment`, `recordPayablePayment`) but is not reachable from the UI now.

- **Margins**: order-level (order_value − cost_value) on FinancePage; project-level (invoices − expenses − order costs) exists dormant.
- **Outstanding balances**: order receivables/overdue live; invoice AR / payables AP dormant.
- **Note**: "Revenue" has **two definitions** in the codebase — order value (live) vs invoiced amount (dormant). Only the order-based one is currently shown.

---

## DASHBOARDS

All on `DashboardPage` (admin + sales). Widgets:

| Widget | Purpose | Calculation | Source | Business value |
|---|---|---|---|---|
| Overdue alert banner | Surface overdue follow-ups | pending actions with due_date < today (mine/unassigned) | `follow_up_actions` | Prevents dropped tasks |
| Today alert banner | Today's due actions | pending actions due today | `follow_up_actions` | Daily focus |
| Today's briefing | Grouped count of my actions by type | group myActions by action_type | `follow_up_actions` | At-a-glance workload |
| Last 10 Days Pipeline (4 cards) | Recent RFQ intake health | RFQs in last 10 days: received / floated / not floated / responded | `rfqs`,`supplier_inquiries`,`supplier_quotes` | Is the funnel being worked |
| Monthly RFQ Pipeline (4 cards) | This month's funnel | received / quote-from-supplier / quoted-to-client (by quote_sent_date) / PO received (orders by PO date) | `rfqs`,`supplier_quotes`,`orders` | Monthly conversion tracking |
| Quarterly RFQ Pipeline (4 cards) | This quarter's funnel | same as monthly, quarter range | same | Quarter tracking |
| Previous Quarter Performance (4 cards + selector) | Compare past quarters | same metrics for a chosen prior quarter | same | Historical comparison |
| Current Quarter Target | Target vs achieved | target from `quarterly_targets`; achieved = Σ order_value by PO date in quarter; progress bar | `quarterly_targets`,`orders` | Goal tracking (admin-set) |
| Previous Quarter Target | Past quarter target vs achieved | same for selected quarter (admin-editable) | same | Historical goal review |
| Overall KPIs (4 cards) | Business snapshot | total clients, total orders, in procurement/transit, active prospects | `clients`,`orders`,`prospects` | High-level health |
| Total Order Value | Cumulative booked value | Σ all order_value | `orders` | Book size |
| Top Clients by RFQs | Most active clients | count RFQs per client (excludes unknown) top 5 | `rfqs` | Key-account visibility |
| Margin Distribution chart | Margin spread across orders | component `MarginDistributionChart` over orders | `orders` | Profitability spread |

---

## REPORTS

**1. Daily RFQ Report** (`/daily-rfq-report`, admin+sales)
- **Purpose**: operational view of RFQ activity in a period.
- **Filters**: date range (Today / Last 7 Days / Last 30 Days / All / Custom), status, priority, client.
- **Sections/Calculations**: Not Floated, Floated-awaiting-response, Responses Received, Converted — the four buckets partition the total. Sorted newest-first.
- **Export**: CSV (formula-injection-safe). PDF button shows "coming soon."
- **Usefulness**: daily standup / follow-up worklist.

**2. Finance report** (`/finance`, admin only) — see FINANCE section. Revenue/cost/profit/margin, receivables, overdue, revenue-by-month, with date presets and CSV export.

No other formal reports exist. (The dormant Bookkeeping "Reports" tab — P&L / project profitability — was removed.)

---

## AUTOMATION

All automation is **client-side, triggered by user actions** (there are **no scheduled jobs, cron, or server-side background workers** — Cannot find any).

- **Auto follow-up creation** on: new prospect (+1d), new RFQ (+1d), RFQ→quoted (+3d), RFQ→converted (+5d), supplier inquiry sent (+2d), order→delivered (+payment_terms). De-duplicated per entity+type.
- **Recurring follow-ups**: on completion, if a `recurrence_days` is set, the next occurrence is auto-created.
- **Auto date stamping**: `quote_sent_date` on quoting; `payment_due_date` computed on delivery from payment terms; `confirmed_date` on order.
- **Notifications**: **in-app only** — sidebar overdue badge, dashboard alert banners. **No email, no push, no SMS/WhatsApp** (drafts are stored but never sent).
- **Automatic calculations**: pipeline metrics, targets vs achieved, margins, aging (dormant), invoice number generation (dormant).
- **Emails/scheduled**: **Not Implemented.**

---

## DOCUMENTS

- **RFQs / Quotations / Purchase Orders / Invoices as documents**: **Not generated.** Data is stored in tables; no printable/branded document is produced for any of them.
- **Attachments / file uploads**: **Not Implemented** — no Supabase Storage usage, no file inputs, no attachment fields.
- **PDF generation**: `src/lib/pdfExport.ts` builds an **HTML** string and downloads it as `.html` (explicit comment that real PDF would need jsPDF); it is **not wired into any page**. The one visible PDF button (Daily RFQ Report) says "coming soon."
- **What does exist**: CSV export on all list pages and the two reports.

---

## SEARCH

- **What can be searched**: free-text search boxes on five list pages — **Clients, Prospects, RFQs, Orders, Vendors**. RFQs and Orders also support status/date filters and PO-number search; RFQs/Orders support ascending/descending sort by date.
- **How powerful**: **Basic client-side substring filtering** over already-loaded rows (name/company/PO number/product, depending on page). There is **no global/cross-entity search**, no full-text server search, no fuzzy matching, and no search on detail pages. Adequate for the current data volume (whole tables are loaded into the browser).

---

## ANALYTICS

**KPIs implemented** (all on Dashboard/Finance): RFQs received / floated / not floated / responded (10-day, monthly, quarterly, previous-quarter); quote-from-supplier count; quoted-to-client count; PO-received count; quarter target & achieved (current + previous) with % progress; total clients; total orders; orders in procurement/transit; active prospects; total order value; revenue; cost; profit; margin %; payments pending (delivered-unpaid); overdue payments.

**Charts / graphs**:
- Dashboard: **Margin Distribution** chart (`MarginDistributionChart`); target **progress bars**.
- Finance: **Revenue-by-month** bar chart; monthly cost/profit bars.
- (Additional chart components exist in the codebase — e.g. profit-trend/supplier-performance — but are **Cannot Determine / not confirmed live** on the current routed pages.)

**Metrics not surfaced despite data being present**: supplier response time, RFQ→PO conversion rate, per-salesperson performance, loss-reason trends, customer lifetime value. The underlying data exists; no screen computes them.

---

## MISSING INFORMATION — questions for the product owner

1. What is the real end-to-end sales process on paper today, and which steps happen **outside** this app (email, Excel, WhatsApp)?
2. When an RFQ has multiple products, do you ever split it across multiple suppliers and multiple orders — and do you need to see them grouped back under one RFQ?
3. Do you issue a formal **purchase order to your supplier**, and does that need to live in the system (with its own number, terms, status)?
4. Do you need branded **PDF documents** (customer quotation, PO, invoice, delivery note), and which ones are contractually required?
5. What does "won" mean financially — is revenue recognized at PO, at delivery, or at payment? (This determines which date should drive targets and finance.)
6. Are there **approval steps** anywhere — quote sign-off, discount limits, PO authorization — and who approves?
7. Do you track **partial deliveries / partial payments**, and how common are they?
8. Which **currencies** do suppliers quote in, and do you need FX handling, or is everything converted to PKR manually?
9. What **supplier performance** signals matter to you (response speed, price competitiveness, on-time delivery, quality)?
10. What **customer** insights does management want — lifetime value, repeat rate, share of wallet, aging receivables per client?
11. Do you need **attachments** on RFQs/orders (datasheets, drawings, supplier quotes, POs, invoices)?
12. Should suppliers/customers ever **receive automated emails** from the system, or is sending always manual?
13. What are your **reporting cadences** — daily, monthly, quarterly — and who consumes each report?
14. How do you want **engineer/commissioning** work scheduled and reported (site visits, completion sign-off, service history)?
15. Do you need a real **audit trail** (who changed what, when) for compliance or accountability?
16. What defines a **fully closed** order for you — payment received, commissioning complete, or both?
17. Do you need **inventory / stock**, or is everything procured-to-order?
18. How large is the team expected to grow, and will you need **finer roles** (e.g., sales manager, procurement officer, accountant) beyond admin/sales/engineer?
19. What are your **quarterly/annual targets** based on — order value booked, revenue collected, or profit — and per salesperson or company-wide?
20. Which of your current **out-of-system spreadsheets** would you most want to retire first?

---

## FINAL SUMMARY

**In one paragraph:** Q-Tech CRM is a web-based sales-and-operations tracker for an industrial equipment / power-quality engineering business. It moves an opportunity from prospect and client, through an RFQ that can hold multiple products, out to overseas suppliers for inquiries and quotes, back to the customer as a quote, and — when won — into an order that progresses through a fixed lifecycle (PO received → procurement → in transit → delivered → payment received) with optional engineer commissioning at the customer site. It layers in automated follow-up reminders, an Actions center, a management dashboard with pipeline metrics and admin-set quarterly targets, and order-based financial reporting. It is a CRM-first system with light operations and procurement tracking; it deliberately stops short of being an ERP (no inventory, no supplier POs, no approvals, no document generation, no accounting UI currently active).

**"If I joined tomorrow as Operations Manager, what would this software help me manage, and what would I still manage outside it?"**

*It would help you manage:* your sales pipeline (who has how many RFQs at what stage), whether RFQs are being floated to suppliers and responded to on time, the follow-up tasks your team owes, the order lifecycle from customer PO to payment, engineer commissioning assignments, quarterly targets vs. actual booked value, and a top-line view of revenue/cost/profit and outstanding receivables from orders.

*You would still manage outside the system:* actually **sending** supplier inquiries and customer quotes (the app only drafts/stores them — email/WhatsApp happens elsewhere); any **formal documents** (branded quotations, supplier POs, invoices, delivery notes); **supplier PO issuance and goods receipt**; **partial deliveries/payments**; **inventory**; **approvals and sign-offs**; **currency conversion** on supplier prices; **per-customer history and lifetime value** and **per-supplier performance** (the data is captured but not surfaced, so you'd rebuild these in a spreadsheet); the **accounting books** (invoices/expenses/payables — the module is currently switched off, so real bookkeeping stays in your accounting software); **document storage/attachments** (datasheets, drawings, signed POs); and any **scheduled reporting or email notifications** (the system notifies only in-app while you're logged in).
