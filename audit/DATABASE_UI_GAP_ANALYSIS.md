# DATABASE_UI_GAP_ANALYSIS.md — Q-Tech CRM (Read-Only Audit)

> For every widget/report: is it backed by real DB data, and is the value valid? Condensed verdicts (full traces in ANALYTICS_AUDIT.md / BUSINESS_LOGIC_AUDIT.md).

## Displayed but NOT properly backed (fix or remove)

| Display | Gap | Recommendation |
|---|---|---|
| Budget vs Actual tab (all budget numbers, variances, alerts, trend line) | Budgets hardcoded `sampleBudgets` (BudgetVsActualTab:46-57); `budgets` table exists but is never read; BudgetForm doesn't persist | Wire to `budgets` table or remove tab (module is unrouted anyway) |
| Outstanding AP KPI | Hardcoded `0` (CRMContext:1057) while payables data is loaded | One-line fix: sum payables outstanding |
| Cashflow Statement | Ignores `payment_records` (the actual cash data, loaded but unused); Partial payments = 0 inflow; cash keyed to invoice issue month | Rebuild on payment_records or rename "Invoiced vs Expensed" |
| Audit Log tab | No audit_log table — in-memory reconstruction from current rows; deleted/edited history is invisible | Rename, or add a real append-only table |
| Pattern Insights | Source state loads pending-only actions (CRMContext:200); completed actions absent → stats near-empty/biased | Hide until completed actions are loaded |
| Target Achieved (both quarters) | Real orders, invalid attribution (mixed-date fallback chain; 8 dateless legacy orders) | Backfill canonical PO dates; drop fallback chain |
| "Recommended" quote badge | Score saturates at 0 above PKR 500k unit price; MOQ weighted 50% | Recalibrate or hide badge |

## Available in DB but unused by UI

- `payment_records.payment_date` — true cash-in series (cashflow, collections reports)
- `rfqs.quote_sent_date` — enables correct "quoted in period" metrics + response-time KPIs
- `rfqs.loss_reason/loss_notes` — captured; only listed, never trended
- `follow_up_actions.recurrence_days` — column unused (magic string in description instead)
- `budgets` table — fully unused
- `orders.created_at` — in DB, absent from TS types; honest fallback date for legacy orders
- Order cost breakdown columns (material/engineering/logistics/overhead) — ignored by project profitability
- `users` realtime — role/name changes don't propagate live

## Useful analytics missing from UI (data already supports)

1. RFQ→PO conversion rate per salesperson / per client
2. Avg supplier response time (quote received_at − inquiry sent_at)
3. Avg client quote turnaround (quote_sent_date − rfq_date)
4. Loss-reason trend over quarters
5. True cash position and collections forecast (payment_records + payment_due_date)
6. Quarter-over-quarter side-by-side comparison

## Redundant / noise

- Two "revenue" definitions (Finance: order value; Bookkeeping: invoiced) — unify vocabulary
- Three "not floated" definitions (Dashboard vs Daily Report vs CRMContext helper)
- Dual toast systems; dual pagination components; duplicate status color maps (5 copies)
- "Payments Pending" includes pre-shipment orders — pipeline dressed as receivables

## Impossible-with-current-data displays

- Any per-day cash metric before payment_records adoption
- Historical audit trail (no event log)
- Accurate quarter attribution for the 8 dateless legacy orders until backfilled
