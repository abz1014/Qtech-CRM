# Q-Tech CRM Implementation Plan

## Context
The user has reported 4 main issues/requests for the CRM system:
1. **Dashboard metrics**: Track daily RFQ received, not floated to suppliers, floated, and responses
2. **RFQ workflow visualization**: Display timeline showing RFQ lifecycle with current status highlighted
3. **Dropdown bugs**: RFQ Status and Priority dropdowns in table navigate instead of opening
4. **Access control**: Dashboard should be admin-only

## Analysis Summary

### Issue 1: Dropdown Navigation Bug
**Root Cause**: RFQsPage.tsx line 143 has `<tr onClick={() => navigate()}>` that captures clicks from nested select elements due to event bubbling.

**Files**: 
- `src/pages/RFQsPage.tsx` lines 143, 160-189 (status/priority selects)

**Solution**: Add `e.stopPropagation()` to select onChange handlers to prevent bubbling to row click handler.

---

### Issue 2: Cannot Create Orders
**Status**: Button is clickable but modal doesn't open. Form exists but not displaying.
**Root Cause**: Likely issue with `showForm` state not toggling or conditional rendering in lines 105-160.

**Files**: `src/pages/OrdersPage.tsx` lines 24 (state), 61 (button), 105 (conditional render)

---

### Issue 3: Admin-Only Dashboard Access
**Current**: Dashboard is accessible to all authenticated users (no role check).
**Target**: Only admins should see dashboard.

**Pattern to Follow**: TeamPage.tsx shows the pattern - use `if (!isAdmin) return <Navigate to="/" replace />;`

**Files**: 
- `src/pages/DashboardPage.tsx` (add admin check)
- `src/contexts/AuthContext.tsx` (already provides isAdmin)

---

### Issue 4: Dashboard RFQ Metrics
**Metrics Needed** (auto-calculated display):
1. RFQs received today
2. Not floated to suppliers (no SupplierInquiry records)
3. Floated to suppliers (has SupplierInquiry records)
4. With responses (has SupplierQuote records)

**Data Source**: 
- SupplierInquiry tracks "floated" status (sent_at)
- SupplierQuote tracks responses (received_at)
- Filter by today's rfq_date

**Implementation Approach**:
- Add helper function to CRMContext: `getRFQMetrics(dateStr)` that returns daily metrics
- Add 4 metric cards to DashboardPage above existing KPIs (similar styling)
- Auto-calculate from existing data, refresh on data changes

**Files**:
- `src/contexts/CRMContext.tsx` (add getRFQMetrics method)
- `src/pages/DashboardPage.tsx` (add metrics UI and cards)

---

### Issue 5: RFQ Workflow Timeline Visualization (RFQ + Order Integrated)
**Requirement**: Visual timeline showing full RFQ→Order lifecycle:
```
RFQ Received → Sent to Supplier → Got Best Quote → Quote Sent to Client → 
Client Confirmed PO → Product Shipped/Installed → Awaiting Payment
```
Current status should be highlighted.

**Mapping to Data**:
- **Received**: RFQ created (rfq_date, status = 'new')
- **Sent to Supplier**: SupplierInquiry exists with sent_at
- **Got Best Quote**: SupplierQuote exists with is_selected = true
- **Quote Sent to Client**: RFQ status = 'quoted'
- **Client Confirmed PO**: RFQ converted to Order, Order status = 'confirmed'
- **Shipped/Installed**: Order status = 'installation'
- **Awaiting Payment**: Order status = 'completed' (ready for payment)

**Implementation**:
- Create `RFQTimelineVisualization.tsx` component
- Accept RFQ ID and linked Order ID as props
- Display 7 horizontal steps with icons and labels
- Calculate active step from RFQ + Order status
- Show timestamps at each completed step
- Display in RFQDetailPage.tsx

**Files**:
- `src/components/RFQTimelineVisualization.tsx` (new)
- `src/pages/RFQDetailPage.tsx` (integrate timeline)

---

## Implementation Order (Priority)

### Priority 1 (Critical Bugs)
1. **Fix RFQ Status/Priority dropdown navigation bug** (~10 min)
   - Add `e.stopPropagation()` to select onChange
   - Test dropdowns work without navigation

2. **Debug and fix Order creation** (~20 min)
   - Verify form submission works
   - Check console for errors
   - Test end-to-end

3. **Restrict Dashboard to admins only** (~5 min)
   - Add role check in DashboardPage.tsx
   - Add sidebar filtering for dashboard nav

### Priority 2 (Feature Development)
4. **Add RFQ metrics to dashboard** (~40 min)
   - Add helper method to CRMContext
   - Add metric cards to dashboard
   - Test metric calculations

5. **Create RFQ Timeline visualization** (~60 min)
   - Design timeline component
   - Integrate into RFQDetailPage
   - Test with different order statuses

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `src/pages/RFQsPage.tsx` | Add `e.stopPropagation()` to select onChange | 1 |
| `src/pages/DashboardPage.tsx` | Add admin check, add metrics cards | 1, 2 |
| `src/contexts/CRMContext.tsx` | Add `getRFQMetrics()` method | 2 |
| `src/pages/RFQDetailPage.tsx` | Integrate timeline component | 2 |
| `src/components/RFQTimelineVisualization.tsx` | NEW - Timeline component | 2 |
| `src/components/AppSidebar.tsx` | Filter dashboard from non-admins | 1 |
| `src/pages/OrdersPage.tsx` | Debug order creation (if needed) | 1 |

---

## Testing Strategy

1. **Test RFQ Dropdowns**:
   - Open RFQs page, click status dropdown → should open
   - Select new status → should update without navigation
   - Same for priority dropdown (admin only)

2. **Test Order Creation**:
   - Click "Add Order" button → modal appears
   - Fill form with all required fields
   - Submit → order created and visible in table

3. **Test Admin Access**:
   - Login as non-admin user
   - Try accessing `/dashboard` → redirected to home
   - Verify dashboard not in sidebar navigation

4. **Test Metrics**:
   - Create RFQs with today's date
   - Create SupplierInquiries for some
   - Create SupplierQuotes for some
   - Verify metrics card shows correct counts

5. **Test Timeline**:
   - Open RFQ detail page
   - Verify timeline displays 7 stages
   - Verify current status is highlighted
   - Convert RFQ to order, verify timeline updates

---

## Notes
- All changes are isolated to frontend (no backend changes needed)
- Metrics calculation uses existing data structures
- Timeline logic can reuse RFQ status values
- Manual logging mentioned by user suggests they'll update metrics manually via form input
