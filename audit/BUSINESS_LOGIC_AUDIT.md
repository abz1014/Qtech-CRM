# BUSINESS_LOGIC_AUDIT.md — Q-Tech CRM (Read-Only Audit)

> Every workflow and calculation traced to file:line. Verdicts: CORRECT / INCORRECT / UNVERIFIABLE.
> All metrics are computed client-side from full-table loads (`CRMContext.tsx:190-204`).

## 0. SYSTEMIC DEFECT — UTC "today" in a UTC+5 business (CRITICAL)

The business runs on Pakistan time; the code computes "today" as the **UTC** date via `new Date().toISOString().split('T')[0]`. From **00:00-05:00 PKT every day**, "today" is yesterday. Occurrences:

| Location | Used for |
|---|---|
| DashboardPage.tsx:21, 93, 125 | today, 10-day window, quarter end |
| DailyRFQReportPage.tsx:17, 28, 41, 45, 150 | today filter, week/month boundaries, CSV filename |
| FinancePage.tsx:15, 19, 83 | preset ranges, overdue comparison |
| ActionsPage.tsx:630 | overdue/today/upcoming membership |
| AppSidebar.tsx:50 | sidebar overdue badge |
| CRMContext.tsx:475, 573, 584, 638, 905/910, 1593, 1678, 1756 | follow-up due dates, payment_due_date, quote_sent_date, invoice numbers, recurrence |
| DashboardTab.tsx:14-25, BudgetVsActualTab.tsx:25-30, ReportsTab.tsx:39-53, PaymentModal.tsx:19, PayablePaymentModal.tsx:24 | month boundaries, default payment dates |

**Worse variant:** `DashboardTab.tsx:25` and `FinancePage.tsx:19` build a *local* Date then `toISOString()` — subtracting 5h. Month-end `new Date(2026,6,0)` (June 30 local) serializes as `"2026-06-29"`, so **the last day of every month is excluded** from bookkeeping-dashboard metrics, and FinancePage's "This Month" starts on the last day of the previous month.

## 1. CRITICAL — Realtime INSERT echo duplicates optimistic inserts

Every add path appends the new row locally (CRMContext.tsx:491, 530, 620, 698, 716, 927, 959, 990, 1180, 1529, 1606, 1689) AND the realtime INSERT handlers (:277 orders, :307 rfqs, :322/:337 inquiries/quotes, :367 follow-ups, :382 invoices, :397 expenses, :412 payments, :427 payables) prepend `payload.new` again with **no id-existence check**. Supabase broadcasts postgres_changes back to the originating client, so **every created row appears twice in state until reload** — inflating the sidebar badge, pipeline counts, revenue sums, and double-counting inside `recordPayment` (:993-995). Fix: id-dedup in the INSERT handlers (`if (prev.some(x => x.id === payload.new.id)) return prev`).

## 2. Dashboard metrics (DashboardPage.tsx)

| Metric | Formula | Verdict |
|---|---|---|
| Last-10-days received | rfq_date ∈ [today-10, today] (:91-97) | CORRECT-ish; window is **11 days inclusive** (label says 10) — Medium; UTC boundary |
| floated | ≥1 supplier_inquiries (:98) | CORRECT |
| notFloated | no inquiry AND status ∉ {converted, lost} (:99) | **INCORRECT as complement** — converted/lost-without-floating RFQs vanish from both buckets; floated+notFloated ≠ received. Medium |
| responded | ≥1 supplier_quotes (:100) | CORRECT |
| quotedToClient (monthly/quarterly) | status ∈ {quoted, converted} (:84) | **INCORRECT — High.** Uses *current status*, not quote date (`quote_sent_date` exists at CRMContext:638 but unused). Quoted-then-lost RFQs drop out; historical quarters mutate retroactively |
| poReceived | status = converted, filtered by rfq_date (:85) | **INCORRECT — High.** Attributes PO to the RFQ receipt period, not conversion date. Inconsistent with Target Achieved (which uses order dates) — same quarter's PO count and achieved value cover different order sets. This is the exact confusion the user hit (June: 4 orders on PO page vs 1 poReceived) |
| Target (quarterly_targets) | maybeSingle + upsert onConflict year,quarter (:178-226) | CORRECT; concurrent admin saves are silent last-write-wins (Medium); no realtime on this table |
| **Target Achieved** | Σ order_value where getOrderDate(o) ∈ quarter; getOrderDate = customer_po_date → confirmed_date → delivery_date → linked RFQ.rfq_date → null (:130-159) | **INCORRECT — Critical.** Fallback chain mixes date semantics: delivery-date-only orders book revenue in the delivery quarter; the RFQ-date fallback books it in the request quarter. The same order **migrates between quarters as fields get filled in**. Dateless orders are excluded from every quarter yet count in Total Revenue → Σ(quarters) ≠ total. Recommendation: single canonical PO date (backfill the 8 NULL-date rows) instead of a fallback chain |
| `today` staleness | memoized once (:20-24) | **High** — a tab left open across midnight keeps yesterday's "today" for alerts, ranges, targets |
| Overall KPIs, Total Revenue, Top Clients | :162-175 | CORRECT (labels; `installationOrders` misnomer — Low) |

## 3. Daily RFQ Report (DailyRFQReportPage.tsx)

| Item | Verdict |
|---|---|
| "Today" | UTC — INCORRECT 00:00-05:00 PKT (Critical for a daily report) |
| "Last 7 Days" | inclusive both ends = **8 days** (Medium) |
| "Last 30 Days" | actually 1 calendar month via setMonth(-1), with JS month-overflow edge cases (Medium) |
| Dropdown `responded` (:58-59) vs "Responses Received" section (:89) | **INCONSISTENT — High**: dropdown doesn't exclude converted; section does — filtering yields a different population than the cards |
| "Floated — Awaiting Response" (:88) | **INCORRECT — High**: doesn't exclude RFQs that already have quotes; responded RFQs appear under "Awaiting Response"; the 4 cards don't partition Total |
| Converted section (:90) | status-only; ignores orders.rfq_id linkage (Medium) |
| CSV export | formula sanitizer present (:102-109) but embedded `"` not escaped (:145) → corrupt rows (Medium) |

## 4. Finance page (FinancePage.tsx — orders only)

| Item | Verdict |
|---|---|
| Order date filter (:86-92) | Orders with neither customer_po_date nor confirmed_date are excluded from every preset **including "All Time"** (:88-89) — revenue silently missing. Medium |
| Revenue/Cost/Profit/Margin (:95-98) | CORRECT (zero-guarded). Note: "Revenue" here = booked order value; Bookkeeping defines revenue = invoiced amount — **two different revenue definitions in one app** (Medium) |
| Payments Pending (:102-111) | Includes po_received/procurement orders (pipeline, not receivable) — business call, Low |
| Overdue (:105-110) | CORRECT except UTC today |
| Revenue by Month (:116-130, 338-340) | Mostly CORRECT; negative-profit months overflow the bar (Low); "This Month" start shifted by the local→UTC bug (Medium) |

## 5. Bookkeeping helpers (CRMContext + tabs)

| Item | Verdict |
|---|---|
| getDashboardMetrics MTD/YTD (:1018-1061) | CORRECT mechanically (accrual by issued_date) |
| **outstanding_ap** (:1057) | **INCORRECT — High: hardcoded `0`** despite payables loaded in state |
| DashboardTab month range (:25) | **High** — drops last day of every month (local→UTC) |
| getMonthlySummary (:1063-1077), getProjectProfitability (:1079-1098) | CORRECT; project profitability ignores order-level costs & expenses without rfq_id → margins overstated (Medium) |
| **getCashflowStatement** (:1100-1129) | **INCORRECT — High.** Not cashflow: ignores `payment_records` (loaded but unused here); Partial payments contribute zero inflow; cash keyed to invoice issue month; opening balance arbitrary 0; payable payments not counted as outflow |
| getARAgingBuckets (:1131-1164) | CORRECT-ish; bucket label overlap; due-today counts as overdue (Low) |
| getAPAgingBuckets (:1242-1293) | Math CORRECT over real payables; mock-Invoice shape shim with client_id=vendor_id is fragile (Low) |
| **Budget vs Actual** (BudgetVsActualTab.tsx:46-57) | **INCORRECT — High: all budget figures are hardcoded `sampleBudgets`**; BudgetForm output never read; variances/alerts/trend line computed against mock numbers. Expense categories outside the 9-item list dropped from chart (Medium) |
| recordPayment (:978-1016) | Race: totals from local state; realtime echo can double-count; `Overdue` branch unreachable (Medium) |
| recordPayablePayment (:1206-1240) | Float equality `===` for Paid status can strand payables at Partial (Medium). No AP payment history persisted (payable_payments never inserted) |
| getNextInvoiceNumber (:904-912) | Concurrent duplicates possible; deleted invoices reuse numbers; no DB UNIQUE backstop (Medium) |

## 6. Actions & follow-up automation

Auto-triggers (autoFollowUp, CRMContext:463-495; due = UTC today+N): new prospect +1d; new RFQ +1d; RFQ→quoted +3d; RFQ→converted +5d; inquiry sent +2d; order→delivered +payment_terms_days.

| Item | Verdict |
|---|---|
| **No dedup on triggers** (:463-495, 644, 702) | **High** — re-toggling a status or sending multiple inquiries spawns duplicate pending actions |
| Sidebar badge vs Actions page overdue count | **CORRECT — verified aligned** (AppSidebar:50-55 ≡ ActionsPage:601-607+630) |
| ActionsPage tier labels vs tab membership | Local-midnight vs UTC mismatch (:36-49 vs :630) — an action can sit in "Due Today" wearing a "1d overdue" badge, 00:00-05:00 PKT (Medium) |
| completeFollowUp (:1560-1613) | **Overwrites `description` with the outcome note** (:1569) — original destroyed; errors swallowed while UI closes modal (Medium) |
| Snooze (:1616-1629) | DB/local state divergence on `status` field (Low); errors swallowed |
| Recurrence | `__recur:N__` magic string parsed from description (:1587) while the DB `recurrence_days` column goes unused (Medium) |
| getPatternInsights (:1710-1737) | **INCORRECT — High**: computes from `followUpActions` which loads only `status='pending'` (:200) — completed actions absent on fresh load; insights near-empty/biased. Same-day completions discarded by `avgDays > 0` filter |
| getUserWorkload (:1647-1659) | CORRECT (unassigned invisible — Low) |

## 7. Supplier quote scoring

`calculateValueScore` (:1459-1471): price 25% / lead 25% / MOQ 50%, with linear penalties clipped at 0 — any unit price ≥ PKR 500,000 scores 0 on price; lead ≥ 60d scores 0; MOQ ≥ 100 scores 0. **For industrial equipment where prices routinely exceed 500k, all quotes tie at 0 on price and MOQ dominates — the "recommended" quote can be the most expensive. INCORRECT/questionable — High.** `getRecommendedQuote` (:1490-1511) CORRECT given the score; multiple manual recommendations → arbitrary pick (Low).

## 8. Edge cases

- **deleteOrder** (:842-862): `order?.rfq_id` guard is CORRECT, but Supabase update + `setRFQs` run *inside the setOrders updater* — StrictMode double-fires, unawaited promise, and a failed delete after the RFQ reset leaves an RFQ marked quoted with a live order. **High.**
- **Multi-order-per-RFQ**: deleting one sibling order resets the RFQ to quoted even though another order remains (Medium).
- **Currency**: raw float accumulation everywhere; equality checks on floats (:1211-1213) (Medium).

## 9. Score

Business logic correctness: **4/10** — arithmetic and guards are fine; date semantics, realtime duplication, no-dedup automation, and two mock-backed metrics drag it down.
