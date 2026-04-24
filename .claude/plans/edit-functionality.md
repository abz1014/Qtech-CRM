# Admin Edit Functionality Implementation Plan

## Context
The CRM currently has **zero edit capability** for existing records. Admins can only:
- Create new records (RFQs, Orders, Clients, etc.)
- Change status/priority dropdowns
- Add child records (line items, inquiries, quotes)

Users cannot modify core entity details after creation. This is a critical missing feature.

## Requirements
- Add edit capability to: **RFQs, Orders, Clients, Vendors, Prospects**
- Edit access: **Admin-only**
- Edit scope: All fields except auto-generated ones (id, created_at, etc.)
- User experience: Modal dialog pattern (consistent with existing create modals)

## Current Architecture

### Existing Patterns (to reuse)
- **Modal Form Pattern**: RFQsPage, OrdersPage use modal dialogs with `showForm` boolean state
- **Form Input Pattern**: Standard input fields with `onChange` state setters
- **Supabase Update Pattern**: `.update().eq('id').select().single()` with state synchronization
- **Error Handling**: Inconsistent (some throw errors, most silently fail)
- **Admin Check**: Uses `isAdmin` from AuthContext

### What's Missing
- No `updateClient()`, `updateVendor()`, `updateProspect()`, `updateRFQ()`, `updateOrder()` methods in CRMContext
- No edit buttons or modals on detail pages
- No edit UI on entity list pages

## Implementation Strategy

### Phase 1: Backend Update Methods (CRMContext.tsx)

Add 5 new update methods to CRMContextType interface and implementation:

```typescript
updateClient: (clientId: string, updates: Partial<Client>) => Promise<void>;
updateVendor: (vendorId: string, updates: Partial<Vendor>) => Promise<void>;
updateProspect: (prospectId: string, updates: Partial<Prospect>) => Promise<void>;
updateRFQ: (rfqId: string, updates: Partial<RFQ>) => Promise<void>;
updateOrder: (orderId: string, updates: Partial<Order>) => Promise<void>;
```

**Implementation Details:**
- Filter out id, created_at, and special fields from updates
- Use standard Supabase update pattern: `.update(updates).eq('id', id).select().single()`
- Return early if record not found
- Handle errors consistently (throw or user notification)
- Synchronize local state after successful update

**Files to modify:**
- `src/contexts/CRMContext.tsx` (interface + implementation + provider export)

### Phase 2: Edit UI on Detail Pages

Add edit button + edit modal to detail pages:

#### **RFQDetailPage.tsx**
- Add "Edit RFQ" button in header (next to status badge)
- Show modal with form containing:
  - company_name, contact_person, phone, email
  - rfq_date, estimated_value, priority (admin-only field already)
  - notes
- Admin-only check before showing button
- Reuse form field pattern from Add RFQ modal

#### **OrderDetailPage.tsx**
- Add "Edit Order" button in header
- Modal form with:
  - client_id (select), vendor_id (select)
  - product_type, order_value, cost_value
  - notes
- Admin-only check
- Calculate profit dynamically

#### **ClientsPage.tsx**
- Add detail view with client information
- Edit button in detail view
- Modal form with:
  - company_name, industry, contact_person, phone, email, address
- Admin-only check
- Need to create ClientDetailPage.tsx or add detail modal to ClientsPage

#### **VendorsPage.tsx**
- Add detail view with vendor information
- Edit button
- Modal form with:
  - name, country, contact_person, phone, email, products_supplied
- Admin-only check
- Similar to ClientsPage pattern

#### **ProspectsPage.tsx**
- Add detail view or inline edit modal
- Modal form with:
  - company_name, contact_person, phone, email, lead_source
  - status, follow_up_date, assigned_to
- Admin-only check

### Phase 3: List Page Edit Actions (Optional Enhancement)

Add "Edit" action in table rows for quick access:
- Small "Edit" button or link in Actions column
- Opens same modal as detail page edit
- For: RFQsPage, OrdersPage (already have these pages)

### Phase 4: Error Handling & Validation

Standardize error handling:
- Add try-catch to all update methods
- Show toast notifications (using existing Sonner/Toaster)
- Log errors for debugging
- Prevent user from losing unsaved data

Validation:
- Required field checks before submit
- Type validation (numeric fields, emails, dates)
- Business logic validation (e.g., confirmed_date can't be in past)

## File Changes Summary

| File | Changes | Priority |
|------|---------|----------|
| `src/contexts/CRMContext.tsx` | Add 5 update methods | High |
| `src/pages/RFQDetailPage.tsx` | Add edit button + modal | High |
| `src/pages/OrderDetailPage.tsx` | Add edit button + modal | High |
| `src/pages/ClientsPage.tsx` | Add detail view + edit modal | High |
| `src/pages/VendorsPage.tsx` | Add detail view + edit modal | High |
| `src/pages/ProspectsPage.tsx` | Add detail view + edit modal | High |
| `src/pages/RFQsPage.tsx` | Add edit action in table (optional) | Low |
| `src/pages/OrdersPage.tsx` | Add edit action in table (optional) | Low |

## Implementation Order

1. **CRMContext updates** (foundation for all edit operations)
2. **RFQDetailPage edit** (RFQs most critical)
3. **OrderDetailPage edit** (Orders most critical)
4. **ClientsPage detail+edit** (Client management)
5. **VendorsPage detail+edit** (Vendor management)
6. **ProspectsPage detail+edit** (Sales pipeline)
7. **Optional: List page quick-edit actions**

## Modal Pattern (Reuse from RFQsPage/OrdersPage)

```jsx
{showEdit && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
    <div className="glass-card w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Edit [Entity Name]</h2>
        <button onClick={() => setShowEdit(false)} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>
      <form onSubmit={handleEdit} className="space-y-3">
        {/* Form fields */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => setShowEdit(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">
            Cancel
          </button>
          <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

## Admin Permission Pattern

```typescript
if (!isAdmin) return null; // Don't show edit button
// or
if (!isAdmin) return <Navigate to="/" replace />; // Redirect from edit routes
```

## Fields NOT to Edit

- `id` (primary key)
- `created_at` / `updated_at` (timestamps)
- `converted_order_id` (RFQ) - only set via conversion
- `converted_client_id` (Prospect) - only set via conversion
- `rfq_id` (Order) - only set during creation

## Testing Strategy

1. **Login as admin** → verify all edit buttons visible
2. **Edit each entity type** → verify changes persist in list/detail
3. **Check validation** → try invalid inputs (empty required fields, bad emails, etc.)
4. **Test permission** → login as non-admin, verify no edit buttons/access
5. **Test modal** → open/close, submit, cancel, form validation
6. **Verify data types** → numeric fields accept only numbers, dates format correctly

## Notes

- This is foundational work; all entities need it for true CRM functionality
- Edit capability is separate from status/priority changes (which are already inline)
- Consider adding "Last modified by" and "Last modified date" fields in future
- Error handling should show user-friendly messages via toast notifications
- Consider adding confirmation dialog before deleting (not in this phase)
