# ANALYTICS_AUDIT.md — Q-Tech CRM (Read-Only Audit)

> The audit template targeted an Energy Management System; this project is a CRM. This file is the domain-analytics equivalent: **every dashboard widget, KPI, chart, and report traced to its data source**, with a verdict on whether it is backed by real data and computed correctly. Full formula detail lives in BUSINESS_LOGIC_AUDIT.md.

## Metric-to-Source Trace Matrix

| Widget / KPI | Page | Data source | Backed by real data? | Calculation valid? |
|---|---|---|---|---|
| Last 10 Days Pipeline (4 cards) | Dashboard | rfqs + supplier_inquiries + supplier_quotes | ✅ Real | ⚠️ 11-day window; notFloated not a true complement; UTC today |
| Monthly RFQ Pipeline (4 cards) | Dashboard | rfqs (+quotes) by rfq_date | ✅ Real | ⚠️ quotedToClient/poReceived use current status, not event dates |
| Quarterly RFQ Pipeline | Dashboard | same | ✅ Real | ⚠️ same |
| Previous Quarter Performance (+selector) | Dashboard | same, historical range | ✅ Real | ⚠️ same; retroactively mutates as statuses change |
| Current Quarter Target | Dashboard | quarterly_targets | ✅ Real (table exists, session-verified) | ✅ (no realtime; last-write-wins race) |
| **Target Achieved** (current & previous) | Dashboard | orders via getOrderDate fallback chain | ✅ Real | ❌ **INVALID — mixed date semantics; orders migrate between quarters; dateless orders excluded** |
| Overall KPIs (clients/orders/procurement/prospects) | Dashboard | entity counts | ✅ Real | ✅ |
| Total Order Value | Dashboard | Σ orders.order_value | ✅ Real | ✅ for its label (not "collected") |
| Top Clients by RFQs | Dashboard | rfqs grouped by client_id | ✅ Real | ✅ |
| Daily RFQ Report (all sections) | Daily Report | rfqs + inquiries + quotes | ✅ Real | ⚠️ Overlapping buckets (cards don't partition Total); dropdown vs section inconsistency; UTC |
| Revenue / Cost / Profit / Margin | Finance | orders | ✅ Real | ✅ (but "revenue" ≠ Bookkeeping's invoice-based revenue) |
| Payments Pending / Overdue | Finance | orders.status + payment_due_date | ✅ Real | ⚠️ Pending includes pre-shipment orders; UTC |
| Revenue by Month chart | Finance | orders bucketed by month | ✅ Real | ⚠️ month-start shifted 1 day (local→UTC); negative-profit bar overflow |
| MTD/YTD Revenue/Expenses/Profit | Bookkeeping Dashboard (unrouted) | invoices + expenses | ✅ Real | ⚠️ last day of month excluded |
| **Outstanding AP** | Bookkeeping Dashboard | — | ❌ **Hardcoded 0** (CRMContext:1057) despite payables loaded | ❌ |
| AR Aging | Bookkeeping | invoices + payment_records | ✅ Real | ✅-ish (bucket label overlap) |
| AP Aging | Bookkeeping | payables | ✅ Real | ✅-ish (shape shim) |
| **Cashflow Statement** | Bookkeeping | invoices + expenses | ⚠️ Real tables, wrong ones | ❌ **INVALID — ignores payment_records; Partial payments = 0 inflow; cash keyed to issue month** |
| **Budget vs Actual** (all figures, variance, alerts, trend) | Bookkeeping | expenses (actuals) + `sampleBudgets` | ❌ **Budgets are hardcoded mock data** (BudgetVsActualTab:46-57) | ❌ |
| Audit Log | Bookkeeping | synthesized in memory from invoices/expenses/payments | ❌ **No audit_log table** — reconstruction, not a log | ❌ as an audit trail |
| Pattern Insights | Actions | follow_up_actions (pending-only load) | ⚠️ Partial data | ❌ Near-empty/biased — completed actions not loaded |
| Team Workload | Actions | follow_up_actions by assignee | ✅ Real | ✅ |
| Quote Value Score / Recommended vendor | RFQ detail | supplier_quotes | ✅ Real | ❌ Score saturates at 0 for typical industrial prices; MOQ (50%) dominates |
| Margin Distribution chart | Dashboard component | orders | ✅ Real | ✅ (component usage verified) |

## Displayed but unsupported / mock-backed (REMOVE or WIRE UP)

1. **Budget vs Actual** — every budget number is `sampleBudgets` mock. Either persist budgets (table exists!) and read them, or remove the tab. The whole Bookkeeping module is unrouted anyway.
2. **Outstanding AP KPI** — hardcoded 0; wire to payables or remove the tile.
3. **Cashflow Statement** — not a cashflow statement; rename to "Invoiced vs Expensed by Month" or rebuild on payment_records.
4. **Audit Log** — presented as an audit log but is an in-memory reconstruction; rename or build a real append-only table.
5. **Pattern Insights** — statistically meaningless on pending-only data; hide until completed actions are loaded.
6. **Quote Value Score** — recalibrate thresholds/weights for PKR industrial price ranges or hide the "Recommended" badge.

## Available but unused data

- `payment_records.payment_date` — the real cash-in signal; unused by cashflow.
- `rfqs.quote_sent_date` — set on quote (CRMContext:638) but never used by quotedToClient.
- `follow_up_actions.recurrence_days` column — unused (magic string in description instead).
- `budgets` table — exists in DDL, never read.
- `orders.created_at` — exists in DB, absent from types; would be the honest fallback date for legacy orders.
- Order-level cost fields (material/engineering/logistics/overhead) — ignored by project profitability.

## Useful analytics missing from UI

- RFQ→PO conversion rate and average response time (quote_sent_date − rfq_date) per salesperson.
- Win/loss rate by loss_reason over time (loss data is captured but only listed).
- True cash position (payments in − expenses/payables out by payment date).
- Quarter-over-quarter comparison view (data exists; only single-quarter selector shipped).

## Redundant / noise

- Two "revenue" definitions (orders-based Finance vs invoice-based Bookkeeping) — pick one vocabulary.
- Three different "not floated" definitions across Dashboard, Daily Report, and CRMContext helpers.
- Dual toast systems, dual pagination components (UI-level noise).

## Device Compatibility Audit

Not applicable — no meters/devices; sole integration is Supabase. Closest analog (which client "supports" which data): **legacy orders with NULL dates** don't support date-based analytics and silently vanish from them — the same class of bug as a dashboard assuming an unsupported meter register. Fix by backfilling dates or an explicit "undated" bucket.

## Analytics Score: 4/10
Real data underneath almost everything, but two mock-backed displays, one invalid financial statement, unstable quarter attribution, and systemic timezone drift.
