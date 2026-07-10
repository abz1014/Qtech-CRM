# UI_UX_AUDIT.md — Q-Tech CRM (Read-Only Audit)

## High

1. **Native `alert()`/`confirm()` as the primary feedback system.** 27 `alert()` calls (success AND error) + 5 native `confirm()` despite BOTH shadcn Toaster and Sonner being mounted (`App.tsx:70-71`) and used nowhere. Locations: VendorsPage:50,52,70; ClientsPage:63,65; ProspectsPage:59,61; OrdersPage:167,169,183; RFQsPage:200,208,210; RFQDetailPage:164,248,255,259,263,270,323; DailyRFQReportPage:153 ("PDF export coming soon!"); FollowUpForm:109,132; SequenceModal:47; ExpensesTab:51; InvoicesTab:55; PayablesTab:72. confirm(): ActionsPage:701, RFQDetailPage:119,227, PayablesTab, FollowUpActionsDashboard — while RFQsPage/OrdersPage use a custom delete-confirm modal. **Fix: one toast system + one confirm dialog, app-wide.**
2. **46 hand-rolled `fixed inset-0` modal overlays across 30 files** instead of Radix `ui/dialog.tsx`/`alert-dialog.tsx` (present, unused). No focus trap, no Escape, no scroll-lock; mixed `modal-card`/`glass-card` styling. This pattern caused the historical modal-clipping bugs. **Fix: one shared `<Modal>` wrapper.**

## Medium

3. **Date formatting chaos:** `format.ts:14` en-GB; `AppLayout.tsx:75` + `pdfExport.ts:191,288` en-PK; bookkeeping tabs (BudgetVsActualTab:89, DashboardTab:101, ReportsTab:19) en-US; SequenceModal:20 en-GB. Users see "07 Jul 2026", "Jul 7, 2026", "Jul 26" on different screens. Standardize on `formatDate()`.
4. **Loading skeletons on only 6 of ~20 pages** (Dashboard, RFQs, Orders, Vendors, Prospects, Clients). Detail pages, Team, Finance, Actions (has `loading` state at :597, no skeleton), and bookkeeping tabs flash empty.
5. **Form validation only on Login** (zod+RHF). All other forms validate ad hoc with alert(); no inline field errors.
6. **Sales users see "Unknown" client names** with no explanation when a client reference dangles — surface "deleted client" or block the dangle at source (see DATABASE_ANALYSIS FKs).

## Low

7. Empty states exist on main lists but text/styling varies per page; bookkeeping tabs and TeamOverview roll their own.
8. Pagination persistence inconsistent (sessionStorage on 2 pages, plain state elsewhere) — back-navigation loses your page on most lists.
9. Negative-profit months overflow the Finance bar chart (`FinancePage.tsx:338-340`).
10. AR/AP aging bucket labels overlap ("0-30" / "30-60").
11. Accessibility: hand-rolled modals + button-based sidebar nav have no ARIA/focus management; not audited exhaustively (flagged for a dedicated a11y pass).

## Positive findings

- `formatPKR` used consistently for money (128 usages, 31 files) — no stray raw formats found.
- Sidebar badge and Actions page overdue count are aligned (verified).
- Detail-page floating Back button is a nice touch; route transitions animated.
- Theme toggle + dark mode implemented consistently through CSS variables.

**UI score: 6/10 · UX score: 5/10** — visually coherent design system undermined by native dialogs, inconsistent dates, and missing loading/validation affordances.
