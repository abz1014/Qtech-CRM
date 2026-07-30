import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { businessToday, businessDaysFromNow } from '@/lib/dates';
import { useAuth } from '@/contexts/AuthContext';
import {
  Client, Prospect, Vendor, Order, OrderEngineer, RFQ, User,
  OrderStatus, CommissioningStatus, RFQStatus, RFQPriority,
  SupplierInquiry, SupplierQuote, RFQLineItem, SupplierInquiryStatus,
  FollowUpAction, RealtimePayload, OrderPayment, SupplierPayment, CostLine,
  CostingConfig, CostingConfigValues,
} from '@/types/crm';
import {
  Invoice, Expense, PaymentRecord, Payable, CreateInvoiceInput, UpdateInvoiceInput,
  CreateExpenseInput, UpdateExpenseInput, CreatePaymentInput, CreatePayableInput,
  UpdatePayableInput, CreatePayablePaymentInput, DashboardMetrics,
  MonthlySummary, ProjectProfitability, CashflowMonth, ARAgingBucket,
  RecurringExpense, CreateRecurringExpenseInput, UpdateRecurringExpenseInput,
  GstInvoice, CreateGstInvoiceInput, UpdateGstInvoiceInput,
} from '@/types/bookkeeping';
import {
  Employee, CreateEmployeeInput, UpdateEmployeeInput,
  AttendanceRecord, MarkAttendanceInput,
} from '@/types/hr';

// Narrow projection returned by getQuotesForRFQ/getRecommendedQuote -- NOT
// `SupplierQuote`, since this select omits received_at/currency/is_selected.
interface RFQQuote {
  id: string;
  rfq_id: string;
  vendor_id: string;
  unit_price: number;
  lead_time_days: number;
  moq: number;
  validity_days: number;
  notes: string | null;
  is_recommended: boolean;
  value_score: number | null;
  vendors: unknown;
  inquiry_id: string;
}

// Narrow projection returned by getOrderWithProfitability/getOrdersWithProfitability
// -- deliberately NOT `Order`, since these select only the costing-relevant
// columns, not a full order row.
interface OrderProfitability {
  id: string;
  order_value: number;
  status: OrderStatus;
  product_type: string;
  material_cost: number | null;
  engineering_cost: number | null;
  logistics_cost: number | null;
  overhead_cost: number | null;
  total_cost: number | null;
  profit: number | null;
  profit_margin: number | null;
  vendor_id: string;
  vendors: unknown;
  created_at?: string;
}

// Realtime INSERT events echo back our own optimistic inserts (Supabase
// broadcasts postgres_changes to the originating client too). Only add the
// row if it isn't already in state, otherwise every created row appears twice.
function addUnique<T>(prev: T[], row: T, key: keyof T, prepend = false): T[] {
  if (prev.some(x => x[key] === row[key])) return prev;
  return prepend ? [row, ...prev] : [...prev, row];
}

const allowedTransitions: Record<OrderStatus, OrderStatus | null> = {
  po_received:      'procurement',
  procurement:      'in_transit',
  in_transit:       'delivered',
  delivered:        'payment_received',
  payment_received: null,
};

interface CRMContextType {
  loading: boolean;
  users: User[];
  clients: Client[];
  prospects: Prospect[];
  vendors: Vendor[];
  orders: Order[];
  orderEngineers: OrderEngineer[];
  rfqs: RFQ[];
  supplierInquiries: SupplierInquiry[];
  supplierQuotes: SupplierQuote[];
  rfqLineItems: RFQLineItem[];
  getUserName: (userId: string) => string;
  getClientName: (clientId: string) => string;
  getVendorName: (vendorId: string) => string;
  addClient: (client: Omit<Client, 'id'>) => Promise<void>;
  addProspect: (prospect: Omit<Prospect, 'id' | 'converted_client_id'>) => Promise<void>;
  addVendor: (vendor: Omit<Vendor, 'id'>) => Promise<Vendor>;
  addOrder: (order: Omit<Order, 'id'>) => Promise<Order>;
  addOrderEngineer: (oe: Omit<OrderEngineer, 'id'>) => Promise<void>;
  convertProspect: (prospectId: string, createdBy: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  updateCommissioningStatus: (oeId: string, status: CommissioningStatus) => Promise<void>;
  addRFQ: (rfq: Omit<RFQ, 'id' | 'converted_order_id'>) => Promise<void>;
  updateRFQStatus: (rfqId: string, status: RFQStatus) => Promise<void>;
  updateRFQPriority: (rfqId: string, priority: RFQPriority) => Promise<void>;
  convertRFQToOrder: (rfqId: string, orderData: Omit<Order, 'id' | 'rfq_id'>) => Promise<void>;
  getNextOrderStatus: (currentStatus: OrderStatus) => OrderStatus | null;
  addSupplierInquiry: (inquiry: Omit<SupplierInquiry, 'id'>) => Promise<void>;
  addSupplierQuote: (quote: Omit<SupplierQuote, 'id'>) => Promise<void>;
  updateSupplierQuote: (quoteId: string, updates: Partial<Omit<SupplierQuote, 'id'>>) => Promise<void>;
  addRFQLineItem: (item: Omit<RFQLineItem, 'id'>) => Promise<void>;
  updateRFQLineItem: (id: string, updates: Partial<Pick<RFQLineItem, 'product_type' | 'quantity' | 'specification'>>) => Promise<void>;
  deleteRFQLineItem: (id: string) => Promise<void>;
  updateInquiryStatus: (inquiryId: string, status: SupplierInquiryStatus) => Promise<void>;
  updateSupplierInquiry: (inquiryId: string, updates: Partial<Omit<SupplierInquiry, 'id'>>) => Promise<void>;
  getRFQMetrics: (dateStr: string) => { receivedToday: number; notFloated: number; floated: number; responded: number };
  getRFQMetricsByDateRange: (startDate: string, endDate: string) => { total: number; notFloated: number; floated: number; responded: number };
  updateClient: (clientId: string, updates: Partial<Omit<Client, 'id'>>) => Promise<void>;
  updateVendor: (vendorId: string, updates: Partial<Omit<Vendor, 'id'>>) => Promise<void>;
  updateProspect: (prospectId: string, updates: Partial<Omit<Prospect, 'id' | 'converted_client_id'>>) => Promise<void>;
  updateRFQ: (rfqId: string, updates: Partial<Omit<RFQ, 'id' | 'converted_order_id'>>) => Promise<void>;
  updateOrder: (orderId: string, updates: Partial<Omit<Order, 'id' | 'rfq_id'>>) => Promise<void>;
  deleteRFQ: (rfqId: string) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;
  deleteVendor: (vendorId: string) => Promise<void>;
  deleteProspect: (prospectId: string) => Promise<void>;

  // Bookkeeping Methods
  invoices: Invoice[];
  expenses: Expense[];
  paymentRecords: PaymentRecord[];
  payables: Payable[];
  addInvoice: (invoice: CreateInvoiceInput, createdBy: string) => Promise<Invoice>;
  updateInvoice: (invoiceId: string, updates: UpdateInvoiceInput) => Promise<void>;
  deleteInvoice: (invoiceId: string) => Promise<void>;
  addExpense: (expense: CreateExpenseInput, createdBy: string) => Promise<Expense>;
  updateExpense: (expenseId: string, updates: UpdateExpenseInput) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  // Recurring monthly expenses (admin-only)
  recurringExpenses: RecurringExpense[];
  addRecurringExpense: (input: CreateRecurringExpenseInput, createdBy: string) => Promise<RecurringExpense>;
  updateRecurringExpense: (id: string, updates: UpdateRecurringExpenseInput) => Promise<void>;
  deleteRecurringExpense: (id: string) => Promise<void>;
  /** Post the given templates into `expenses` for a YYYY-MM period. Idempotent. Returns count posted. */
  postRecurringExpenses: (period: string, items: { id: string; amount: number }[], createdBy: string) => Promise<number>;
  // GST invoice register (admin + sales)
  gstInvoices: GstInvoice[];
  addGstInvoice: (input: CreateGstInvoiceInput, createdBy: string) => Promise<GstInvoice>;
  updateGstInvoice: (id: string, updates: UpdateGstInvoiceInput) => Promise<void>;
  deleteGstInvoice: (id: string) => Promise<void>;
  // Employee management + attendance (admin-only)
  employees: Employee[];
  attendance: AttendanceRecord[];
  addEmployee: (input: CreateEmployeeInput, createdBy: string) => Promise<Employee>;
  updateEmployee: (id: string, updates: UpdateEmployeeInput) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  markAttendance: (input: MarkAttendanceInput, createdBy: string) => Promise<AttendanceRecord>;
  deleteAttendance: (id: string) => Promise<void>;
  recordPayment: (payment: CreatePaymentInput, recordedBy: string) => Promise<PaymentRecord>;
  addPayable: (payable: CreatePayableInput, createdBy: string) => Promise<Payable>;
  updatePayable: (payableId: string, updates: UpdatePayableInput) => Promise<void>;
  deletePayable: (payableId: string) => Promise<void>;
  recordPayablePayment: (payment: CreatePayablePaymentInput, recordedBy: string) => Promise<void>;
  getDashboardMetrics: () => DashboardMetrics;
  getMonthlySummary: (month: string) => MonthlySummary;
  getProjectProfitability: (rfqId: string) => ProjectProfitability;
  getCashflowStatement: (months: number) => CashflowMonth[];
  getARAgingBuckets: () => ARAgingBucket[];
  getAPAgingBuckets: () => ARAgingBucket[];
  getNextInvoiceNumber: () => Promise<string>;

  // Profitability Methods
  updateOrderCosts: (
    orderId: string,
    costs: {
      material_cost?: number;
      engineering_cost?: number;
      logistics_cost?: number;
      overhead_cost?: number;
    }
  ) => Promise<{ success: boolean; error?: unknown }>;
  getOrderWithProfitability: (orderId: string) => Promise<OrderProfitability | null>;
  getOrdersWithProfitability: () => Promise<OrderProfitability[]>;
  getProfitabilityMetrics: () => Promise<{
    totalProfit: number;
    avgMargin: number;
    topProfitable: Pick<OrderProfitability, 'order_value' | 'total_cost' | 'profit' | 'profit_margin' | 'status'>[];
    totalOrders: number;
    lowMarginOrders: number;
  }>;

  // Supplier Comparison Methods
  getQuotesForRFQ: (rfqId: string) => Promise<RFQQuote[]>;
  calculateValueScore: (unitPrice: number, leadTime: number, moq: number) => number;
  updateQuoteRecommendation: (quoteId: string, isRecommended: boolean) => Promise<void>;
  getRecommendedQuote: (rfqId: string) => Promise<RFQQuote | null>;

  // Live action state (pre-loaded, reactive)
  followUpActions: FollowUpAction[];

  // Finance rebuild (admin-only)
  orderPayments: OrderPayment[];
  costLines: CostLine[];
  saveCostLines: (parent: { rfq_id: string } | { order_id: string }, lines: Omit<CostLine, 'id' | 'created_at' | 'rfq_id' | 'order_id'>[]) => Promise<void>;
  costingConfig: CostingConfig | null;
  updateCostingConfig: (values: CostingConfigValues) => Promise<void>;
  supplierPayments: SupplierPayment[];
  addOrderPayment: (payment: Omit<OrderPayment, 'id' | 'created_at' | 'recorded_by'>, recordedBy: string) => Promise<OrderPayment>;
  deleteOrderPayment: (paymentId: string) => Promise<void>;
  addSupplierPayment: (payment: Omit<SupplierPayment, 'id' | 'created_at' | 'recorded_by'>, recordedBy: string) => Promise<SupplierPayment>;
  deleteSupplierPayment: (paymentId: string) => Promise<void>;

  // Follow-Up Automation Methods
  createFollowUp: (followUp: {
    action_type: 'rfq_followup' | 'supplier_response' | 'overdue_invoice' | 'order_status' | 'custom';
    entity_type: string;
    entity_id: string;
    title: string;
    description?: string;
    due_date: string;
    priority: 'low' | 'medium' | 'high';
    assigned_to?: string;
  }) => Promise<FollowUpAction | null>;
  getPendingFollowUps: (userId?: string) => Promise<FollowUpAction[]>;
  getAllFollowUps: () => Promise<FollowUpAction[]>;
  completeFollowUp: (followUpId: string, outcomeNote?: string) => Promise<void>;
  snoozeFollowUp: (followUpId: string, newDueDate: string) => Promise<void>;
  deleteFollowUp: (followUpId: string) => Promise<void>;
  getOverdueFollowUps: () => Promise<FollowUpAction[]>;
  getFollowUpsForEntity: (entityType: string, entityId: string) => Promise<FollowUpAction[]>;
  getUserWorkload: (userId: string) => Promise<number>;
  applySequence: (steps: Array<{ title: string; action_type: string; daysFromNow: number; priority: 'low'|'medium'|'high'; notes?: string }>, entityType: string, entityId: string | null, assignedTo: string | null) => Promise<void>;
  getRecentActivity: (limit?: number) => Promise<FollowUpAction[]>;
  getPatternInsights: () => { actionType: string; avgDays: number; label: string }[];
}

const CRMContext = createContext<CRMContextType | null>(null);

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser, isAdmin, isSales } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderEngineers, setOrderEngineers] = useState<OrderEngineer[]>([]);
  const [rfqs, setRFQs] = useState<RFQ[]>([]);
  const [supplierInquiries, setSupplierInquiries] = useState<SupplierInquiry[]>([]);
  const [supplierQuotes, setSupplierQuotes] = useState<SupplierQuote[]>([]);
  const [rfqLineItems, setRFQLineItems] = useState<RFQLineItem[]>([]);
  const [followUpActions, setFollowUpActions] = useState<FollowUpAction[]>([]);

  // Bookkeeping state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [gstInvoices, setGstInvoices] = useState<GstInvoice[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [orderPayments, setOrderPayments] = useState<OrderPayment[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [costLines, setCostLines] = useState<CostLine[]>([]);
  const [costingConfig, setCostingConfig] = useState<CostingConfig | null>(null);

  useEffect(() => {
    // Don't load anything until a user is logged in; financial tables load
    // only for admins (sales/engineer sessions never receive that data).
    if (!authUser) return;
    const emptyResult = Promise.resolve({ data: null });
    const load = async () => {
      const [
        { data: usersData },
        { data: clientsData },
        { data: prospectsData },
        { data: vendorsData },
        { data: ordersData },
        { data: oeData },
        { data: rfqsData },
        { data: inquiriesData },
        { data: quotesData },
        { data: lineItemsData },
        { data: actionsData },
        { data: invoicesData },
        { data: expensesData },
        { data: paymentsData },
        { data: payablesData },
        { data: orderPaymentsData },
        { data: supplierPaymentsData },
        { data: costLinesData },
        { data: costingConfigData },
        { data: recurringExpensesData },
        { data: gstInvoicesData },
        { data: employeesData },
        { data: attendanceData },
      ] = await Promise.all([
        supabase.from('users').select('*').order('name'),
        supabase.from('clients').select('*').order('company_name'),
        supabase.from('prospects').select('*').order('company_name'),
        supabase.from('vendors').select('*').order('name'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('order_engineers').select('*'),
        supabase.from('rfqs').select('*').order('created_at', { ascending: false }),
        supabase.from('supplier_inquiries').select('*').order('sent_at', { ascending: false }),
        supabase.from('supplier_quotes').select('*').order('received_at', { ascending: false }),
        supabase.from('rfq_line_items').select('*'),
        // Load ALL actions (not just pending) — completed ones feed
        // getPatternInsights; every UI consumer filters status itself.
        supabase.from('follow_up_actions').select('*').order('due_date', { ascending: true }),
        isAdmin ? supabase.from('invoices').select('*').order('issued_date', { ascending: false }).then(res => res, () => ({ data: null })) : emptyResult,
        isAdmin ? supabase.from('expenses').select('*').order('date', { ascending: false }).then(res => res, () => ({ data: null })) : emptyResult,
        isAdmin ? supabase.from('payment_records').select('*').order('payment_date', { ascending: false }).then(res => res, () => ({ data: null })) : emptyResult,
        isAdmin ? supabase.from('payables').select('*').order('due_date', { ascending: false }).then(res => res, () => ({ data: null })) : emptyResult,
        isAdmin ? supabase.from('order_payments').select('*').order('payment_date', { ascending: false }).then(res => res, () => ({ data: null })) : emptyResult,
        isAdmin ? supabase.from('supplier_payments').select('*').order('payment_date', { ascending: false }).then(res => res, () => ({ data: null })) : emptyResult,
        (isAdmin || isSales) ? supabase.from('cost_lines').select('*').order('sort_order', { ascending: true }).then(res => res, () => ({ data: null })) : emptyResult,
        (isAdmin || isSales) ? supabase.from('costing_config').select('*').eq('id', 1).maybeSingle().then(res => res, () => ({ data: null })) : emptyResult,
        isAdmin ? supabase.from('recurring_expenses').select('*').order('label').then(res => res, () => ({ data: null })) : emptyResult,
        (isAdmin || isSales) ? supabase.from('gst_invoices').select('*').order('invoice_date', { ascending: false }).then(res => res, () => ({ data: null })) : emptyResult,
        isAdmin ? supabase.from('employees').select('*').order('name').then(res => res, () => ({ data: null })) : emptyResult,
        isAdmin ? supabase.from('attendance').select('*').order('date', { ascending: false }).then(res => res, () => ({ data: null })) : emptyResult,
      ]);
      setUsers((usersData ?? []) as unknown as User[]);
      setClients((clientsData ?? []) as unknown as Client[]);
      setProspects((prospectsData ?? []) as unknown as Prospect[]);
      setVendors((vendorsData ?? []) as unknown as Vendor[]);
      // Safety net: the historical import used a legacy status 'completed'
      // (settled orders) that isn't in the app lifecycle. Normalize it to
      // 'payment_received' on load so it isn't counted as payment-pending.
      // No-op once the 20260711_fix_legacy_order_statuses migration has run.
      setOrders(((ordersData ?? []) as unknown as Order[]).map(o =>
        (o.status as string) === 'completed' ? { ...o, status: 'payment_received' as OrderStatus } : o
      ));
      setOrderEngineers((oeData ?? []) as unknown as OrderEngineer[]);
      setRFQs((rfqsData ?? []) as unknown as RFQ[]);
      setSupplierInquiries((inquiriesData ?? []) as unknown as SupplierInquiry[]);
      setSupplierQuotes((quotesData ?? []) as unknown as SupplierQuote[]);
      setRFQLineItems((lineItemsData ?? []) as unknown as RFQLineItem[]);
      setFollowUpActions((actionsData ?? []) as unknown as FollowUpAction[]);
      setInvoices((invoicesData ?? []) as unknown as Invoice[]);
      setExpenses((expensesData ?? []) as unknown as Expense[]);
      setPaymentRecords((paymentsData ?? []) as unknown as PaymentRecord[]);
      setPayables((payablesData ?? []) as unknown as Payable[]);
      setOrderPayments((orderPaymentsData ?? []) as unknown as OrderPayment[]);
      setSupplierPayments((supplierPaymentsData ?? []) as unknown as SupplierPayment[]);
      setCostLines((costLinesData ?? []) as unknown as CostLine[]);
      setCostingConfig((costingConfigData ?? null) as unknown as CostingConfig | null);
      setRecurringExpenses((recurringExpensesData ?? []) as unknown as RecurringExpense[]);
      setGstInvoices((gstInvoicesData ?? []) as unknown as GstInvoice[]);
      setEmployees((employeesData ?? []) as unknown as Employee[]);
      setAttendance((attendanceData ?? []) as unknown as AttendanceRecord[]);
      setLoading(false);

      // ===== SUPABASE REALTIME SUBSCRIPTIONS =====
      const channel = supabase.channel('crm-changes');

      // Subscribe to clients changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setClients(prev => addUnique(prev, payload.new as unknown as Client, 'id'));
          } else if (payload.eventType === 'UPDATE') {
            setClients(prev => prev.map(c => c.id === payload.new.id ? payload.new as unknown as Client : c));
          } else if (payload.eventType === 'DELETE') {
            setClients(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      );

      // Subscribe to prospects changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prospects' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setProspects(prev => addUnique(prev, payload.new as unknown as Prospect, 'id'));
          } else if (payload.eventType === 'UPDATE') {
            setProspects(prev => prev.map(p => p.id === payload.new.id ? payload.new as unknown as Prospect : p));
          } else if (payload.eventType === 'DELETE') {
            setProspects(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      );

      // Subscribe to vendors changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendors' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setVendors(prev => addUnique(prev, payload.new as unknown as Vendor, 'id'));
          } else if (payload.eventType === 'UPDATE') {
            setVendors(prev => prev.map(v => v.id === payload.new.id ? payload.new as unknown as Vendor : v));
          } else if (payload.eventType === 'DELETE') {
            setVendors(prev => prev.filter(v => v.id !== payload.old.id));
          }
        }
      );

      // Subscribe to orders changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setOrders(prev => addUnique(prev, payload.new as unknown as Order, 'id', true));
          } else if (payload.eventType === 'UPDATE') {
            setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new as unknown as Order : o));
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== payload.old.id));
          }
        }
      );

      // Subscribe to order_engineers changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_engineers' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setOrderEngineers(prev => addUnique(prev, payload.new as unknown as OrderEngineer, 'id'));
          } else if (payload.eventType === 'UPDATE') {
            setOrderEngineers(prev => prev.map(oe => oe.id === payload.new.id ? payload.new as unknown as OrderEngineer : oe));
          } else if (payload.eventType === 'DELETE') {
            setOrderEngineers(prev => prev.filter(oe => oe.id !== payload.old.id));
          }
        }
      );

      // Subscribe to rfqs changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rfqs' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setRFQs(prev => addUnique(prev, payload.new as unknown as RFQ, 'id', true));
          } else if (payload.eventType === 'UPDATE') {
            setRFQs(prev => prev.map(r => r.id === payload.new.id ? payload.new as unknown as RFQ : r));
          } else if (payload.eventType === 'DELETE') {
            setRFQs(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      );

      // Subscribe to supplier_inquiries changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'supplier_inquiries' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setSupplierInquiries(prev => addUnique(prev, payload.new as unknown as SupplierInquiry, 'id', true));
          } else if (payload.eventType === 'UPDATE') {
            setSupplierInquiries(prev => prev.map(si => si.id === payload.new.id ? payload.new as unknown as SupplierInquiry : si));
          } else if (payload.eventType === 'DELETE') {
            setSupplierInquiries(prev => prev.filter(si => si.id !== payload.old.id));
          }
        }
      );

      // Subscribe to supplier_quotes changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'supplier_quotes' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setSupplierQuotes(prev => addUnique(prev, payload.new as unknown as SupplierQuote, 'id', true));
          } else if (payload.eventType === 'UPDATE') {
            setSupplierQuotes(prev => prev.map(sq => sq.id === payload.new.id ? payload.new as unknown as SupplierQuote : sq));
          } else if (payload.eventType === 'DELETE') {
            setSupplierQuotes(prev => prev.filter(sq => sq.id !== payload.old.id));
          }
        }
      );

      // Subscribe to rfq_line_items changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rfq_line_items' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setRFQLineItems(prev => addUnique(prev, payload.new as unknown as RFQLineItem, 'id'));
          } else if (payload.eventType === 'UPDATE') {
            setRFQLineItems(prev => prev.map(li => li.id === payload.new.id ? payload.new as unknown as RFQLineItem : li));
          } else if (payload.eventType === 'DELETE') {
            setRFQLineItems(prev => prev.filter(li => li.id !== payload.old.id));
          }
        }
      );

      // Subscribe to follow_up_actions changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follow_up_actions' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setFollowUpActions(prev => addUnique(prev, payload.new as unknown as FollowUpAction, 'id', true));
          } else if (payload.eventType === 'UPDATE') {
            setFollowUpActions(prev => prev.map(fa => fa.id === payload.new.id ? payload.new as unknown as FollowUpAction : fa));
          } else if (payload.eventType === 'DELETE') {
            setFollowUpActions(prev => prev.filter(fa => fa.id !== payload.old.id));
          }
        }
      );

      // Financial tables: subscribe only for admins (matching the load gate)
      if (isAdmin) {

      // Subscribe to invoices changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setInvoices(prev => addUnique(prev, payload.new as unknown as Invoice, 'invoice_id', true));
          } else if (payload.eventType === 'UPDATE') {
            setInvoices(prev => prev.map(inv => inv.invoice_id === payload.new.invoice_id ? payload.new as unknown as Invoice : inv));
          } else if (payload.eventType === 'DELETE') {
            setInvoices(prev => prev.filter(inv => inv.invoice_id !== payload.old.invoice_id));
          }
        }
      );

      // Subscribe to expenses changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setExpenses(prev => addUnique(prev, payload.new as unknown as Expense, 'expense_id', true));
          } else if (payload.eventType === 'UPDATE') {
            setExpenses(prev => prev.map(exp => exp.expense_id === payload.new.expense_id ? payload.new as unknown as Expense : exp));
          } else if (payload.eventType === 'DELETE') {
            setExpenses(prev => prev.filter(exp => exp.expense_id !== payload.old.expense_id));
          }
        }
      );

      // Subscribe to recurring expense templates
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recurring_expenses' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setRecurringExpenses(prev => addUnique(prev, payload.new as unknown as RecurringExpense, 'id'));
          } else if (payload.eventType === 'UPDATE') {
            setRecurringExpenses(prev => prev.map(r => r.id === payload.new.id ? payload.new as unknown as RecurringExpense : r));
          } else if (payload.eventType === 'DELETE') {
            setRecurringExpenses(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      );

      // Subscribe to the employee roster
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setEmployees(prev => addUnique(prev, payload.new as unknown as Employee, 'id'));
          } else if (payload.eventType === 'UPDATE') {
            setEmployees(prev => prev.map(e => e.id === payload.new.id ? payload.new as unknown as Employee : e));
          } else if (payload.eventType === 'DELETE') {
            setEmployees(prev => prev.filter(e => e.id !== payload.old.id));
          }
        }
      );

      // Subscribe to attendance records
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setAttendance(prev => addUnique(prev, payload.new as unknown as AttendanceRecord, 'id'));
          } else if (payload.eventType === 'UPDATE') {
            setAttendance(prev => prev.map(a => a.id === payload.new.id ? payload.new as unknown as AttendanceRecord : a));
          } else if (payload.eventType === 'DELETE') {
            setAttendance(prev => prev.filter(a => a.id !== payload.old.id));
          }
        }
      );

      // Subscribe to payment_records changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_records' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setPaymentRecords(prev => addUnique(prev, payload.new as unknown as PaymentRecord, 'payment_id', true));
          } else if (payload.eventType === 'UPDATE') {
            setPaymentRecords(prev => prev.map(pr => pr.payment_id === payload.new.payment_id ? payload.new as unknown as PaymentRecord : pr));
          } else if (payload.eventType === 'DELETE') {
            setPaymentRecords(prev => prev.filter(pr => pr.payment_id !== payload.old.payment_id));
          }
        }
      );

      // Subscribe to payables changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payables' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setPayables(prev => addUnique(prev, payload.new as unknown as Payable, 'payable_id', true));
          } else if (payload.eventType === 'UPDATE') {
            setPayables(prev => prev.map(p => p.payable_id === payload.new.payable_id ? payload.new as unknown as Payable : p));
          } else if (payload.eventType === 'DELETE') {
            setPayables(prev => prev.filter(p => p.payable_id !== payload.old.payable_id));
          }
        }
      );

      // Subscribe to customer payments (finance rebuild)
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_payments' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setOrderPayments(prev => addUnique(prev, payload.new as unknown as OrderPayment, 'id', true));
          } else if (payload.eventType === 'UPDATE') {
            setOrderPayments(prev => prev.map(p => p.id === payload.new.id ? payload.new as unknown as OrderPayment : p));
          } else if (payload.eventType === 'DELETE') {
            setOrderPayments(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      );

      // Subscribe to supplier payments (finance rebuild)
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'supplier_payments' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setSupplierPayments(prev => addUnique(prev, payload.new as unknown as SupplierPayment, 'id', true));
          } else if (payload.eventType === 'UPDATE') {
            setSupplierPayments(prev => prev.map(p => p.id === payload.new.id ? payload.new as unknown as SupplierPayment : p));
          } else if (payload.eventType === 'DELETE') {
            setSupplierPayments(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      );

      } // end isAdmin financial subscriptions

      // Subscribe to costing lines (admin + sales; RLS enforces access)
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cost_lines' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setCostLines(prev => addUnique(prev, payload.new as unknown as CostLine, 'id'));
          } else if (payload.eventType === 'UPDATE') {
            setCostLines(prev => prev.map(c => c.id === payload.new.id ? payload.new as unknown as CostLine : c));
          } else if (payload.eventType === 'DELETE') {
            setCostLines(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      );

      // Subscribe to the shared costing config (singleton row; admin + sales read)
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'costing_config' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'DELETE') {
            setCostingConfig(null);
          } else {
            setCostingConfig(payload.new as unknown as CostingConfig);
          }
        }
      );

      // Subscribe to GST invoice register (admin + sales; RLS enforces access)
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gst_invoices' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            setGstInvoices(prev => addUnique(prev, payload.new as unknown as GstInvoice, 'id'));
          } else if (payload.eventType === 'UPDATE') {
            setGstInvoices(prev => prev.map(g => g.id === payload.new.id ? payload.new as unknown as GstInvoice : g));
          } else if (payload.eventType === 'DELETE') {
            setGstInvoices(prev => prev.filter(g => g.id !== payload.old.id));
          }
        }
      );

      // Subscribe to the channel
      await channel.subscribe();
      return channel;
    };

    // Keep a handle to the channel so the effect cleanup can actually
    // unsubscribe — returning the cleanup from inside the async load()
    // does nothing and leaks a channel on every unmount/HMR.
    const channelPromise = load();
    return () => {
      channelPromise.then(channel => {
        if (channel) supabase.removeChannel(channel);
      }).catch(() => { /* load failed; nothing to clean up */ });
    };
  }, [authUser?.id, isAdmin, isSales]);

  // O(1) Map lookups — rebuilt only when the source array changes
  const userMap   = useMemo(() => new Map(users.map(u   => [u.id, u.name])),              [users]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.company_name])),       [clients]);
  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v.name])),               [vendors]);

  const getUserName   = useCallback((id: string) => userMap.get(id)   ?? 'Unknown', [userMap]);
  const getClientName = useCallback((id: string) => clientMap.get(id) ?? 'Unknown', [clientMap]);
  const getVendorName = useCallback((id: string) => vendorMap.get(id) ?? 'Unknown', [vendorMap]);

  const addClient = useCallback(async (c: Omit<Client, 'id'>) => {
    const { data } = await supabase.from('clients').insert(c).select().single();
    if (data) setClients(prev => [...prev, data as Client]);
  }, []);

  // ── autoFollowUp MUST be defined before any callback that lists it in deps ──
  // Defining it AFTER causes a Temporal Dead Zone crash in production builds.
  const autoFollowUp = useCallback(async (params: {
    title: string;
    action_type: string;
    entity_type: string;
    entity_id: string;
    assigned_to?: string | null;
    priority?: 'low' | 'medium' | 'high';
    daysFromNow?: number;
  }) => {
    try {
      // Dedup: skip if a pending action of the same type already exists for
      // this entity — re-toggling a status or sending multiple inquiries used
      // to spawn a duplicate action every time.
      const { data: existing } = await supabase
        .from('follow_up_actions')
        .select('id')
        .eq('entity_id', params.entity_id)
        .eq('entity_type', params.entity_type)
        .eq('action_type', params.action_type)
        .eq('status', 'pending')
        .limit(1);
      if (existing && existing.length > 0) return;

      const due_date = businessDaysFromNow(params.daysFromNow ?? 2);
      const { data, error } = await supabase
        .from('follow_up_actions')
        .insert([{
          action_type: params.action_type,
          entity_type: params.entity_type,
          entity_id: params.entity_id,
          title: params.title,
          description: 'Auto-created by system',
          due_date,
          priority: params.priority ?? 'medium',
          assigned_to: params.assigned_to ?? null,
          status: 'pending',
        }])
        .select()
        .single();
      if (!error && data) setFollowUpActions(prev => addUnique(prev, data, 'id', true));
    } catch {
      // Auto-triggers are best-effort — never block the main action
    }
  }, []);

  // ── Stall detection (Sprint 11) ──────────────────────────────────────────
  // With no scheduled job, we scan once per session after data loads and
  // raise a follow-up for anything stuck too long. autoFollowUp dedups, so a
  // stalled item gets exactly one pending action no matter how often we scan.
  const stallScanned = useRef(false);
  useEffect(() => {
    if (loading || stallScanned.current || !authUser || authUser.role === 'engineer') return;
    stallScanned.current = true;

    const today = businessToday();
    const daysSince = (d?: string | null): number | null =>
      d ? Math.floor((new Date(today).getTime() - new Date(String(d).slice(0, 10)).getTime()) / 86400000) : null;
    const inquired = new Set(supplierInquiries.map(i => i.rfq_id));
    const quoted = new Set(supplierQuotes.map(q => q.rfq_id));

    rfqs.forEach(r => {
      if (r.status === 'converted' || r.status === 'lost') return;
      // Floated but no supplier response after 7 days
      if (inquired.has(r.id) && !quoted.has(r.id)) {
        const age = daysSince(r.rfq_date);
        if (age !== null && age > 7) {
          autoFollowUp({ title: `Chase supplier response — ${r.company_name}${r.rfq_number ? ` · ${r.rfq_number}` : ''}`, action_type: 'supplier_response', entity_type: 'rfq', entity_id: r.id, assigned_to: r.assigned_to ?? null, priority: 'high', daysFromNow: 0 });
        }
      }
      // Quote sent to customer but no decision after 7 days
      if (r.status === 'quoted') {
        const age = daysSince(r.quote_sent_date ?? r.rfq_date);
        if (age !== null && age > 7) {
          autoFollowUp({ title: `Follow up on quote — ${r.company_name}${r.rfq_number ? ` · ${r.rfq_number}` : ''}`, action_type: 'rfq_followup', entity_type: 'rfq', entity_id: r.id, assigned_to: r.assigned_to ?? null, priority: 'high', daysFromNow: 0 });
        }
      }
    });

    // Order stuck in an early stage more than 30 days since its PO
    orders.forEach(o => {
      if (o.status === 'po_received' || o.status === 'procurement' || o.status === 'in_transit') {
        const age = daysSince(o.customer_po_date ?? o.confirmed_date);
        if (age !== null && age > 30) {
          autoFollowUp({ title: `Stalled order — check ${getClientName(o.client_id)}${o.product_type ? ` · ${o.product_type}` : ''}`, action_type: 'order_status', entity_type: 'order', entity_id: o.id, assigned_to: o.sales_person_id ?? null, priority: 'medium', daysFromNow: 0 });
        }
      }
    });
  }, [loading, authUser, rfqs, orders, supplierInquiries, supplierQuotes, autoFollowUp, getClientName]);

  const addProspect = useCallback(async (p: Omit<Prospect, 'id' | 'converted_client_id'>) => {
    const { data } = await supabase.from('prospects').insert({ ...p, converted_client_id: null }).select().single();
    if (data) {
      setProspects(prev => [...prev, data as Prospect]);
      // Auto-trigger: new prospect → schedule initial outreach
      autoFollowUp({
        title: `Initial outreach to ${p.company_name}`,
        action_type: 'rfq_followup',
        entity_type: 'prospect',
        entity_id: data.id,
        assigned_to: p.assigned_to as string ?? null,
        priority: p.status === 'hot' ? 'high' : 'medium',
        daysFromNow: 1,
      });
    }
  }, [autoFollowUp]);

  const addVendor = useCallback(async (v: Omit<Vendor, 'id'>): Promise<Vendor> => {
    const { data, error } = await supabase.from('vendors').insert(v).select().single();
    if (error || !data) throw new Error('Failed to create vendor');
    const vendor = data as Vendor;
    setVendors(prev => [...prev, vendor]);
    return vendor;
  }, []);

  const addOrder = useCallback(async (o: Omit<Order, 'id'>): Promise<Order> => {
    // Validate client_id exists
    if (o.client_id && !clients.find(c => c.id === o.client_id)) {
      throw new Error(`Client with ID ${o.client_id} does not exist`);
    }
    const { data, error } = await supabase.from('orders').insert(o).select().single();
    if (error || !data) throw new Error('Failed to create order');
    const order = data as Order;
    setOrders(prev => [order, ...prev]);
    return order;
  }, [clients]);

  const addOrderEngineer = useCallback(async (oe: Omit<OrderEngineer, 'id'>) => {
    const { data } = await supabase.from('order_engineers').insert(oe).select().single();
    if (data) setOrderEngineers(prev => [...prev, data as OrderEngineer]);
  }, []);

  const convertProspect = useCallback(async (prospectId: string, createdBy: string) => {
    const prospect = prospects.find(p => p.id === prospectId);
    if (!prospect) return;
    const { data: clientData } = await supabase.from('clients').insert({
      company_name: prospect.company_name,
      industry: '',
      contact_person: prospect.contact_person,
      phone: prospect.phone,
      email: prospect.email,
      address: '',
      created_by: createdBy || null,
    }).select().single();
    if (!clientData) return;
    setClients(prev => [...prev, clientData as Client]);
    const { data: updatedProspect } = await supabase
      .from('prospects')
      .update({ converted_client_id: clientData.id })
      .eq('id', prospectId)
      .select()
      .single();
    if (updatedProspect) {
      setProspects(prev => prev.map(p => p.id === prospectId ? updatedProspect as Prospect : p));
    }
  }, [prospects]);

  const getNextOrderStatus = useCallback((currentStatus: OrderStatus): OrderStatus | null => {
    return allowedTransitions[currentStatus];
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    if (allowedTransitions[order.status] !== status) return;

    const today = businessToday();
    const updates: Partial<Order> = { status };

    if (status === 'po_received') updates.confirmed_date = today;

    // When delivered: record delivery date + auto-calculate payment due date
    if (status === 'delivered') {
      updates.delivery_date = today;
      const paymentTerms = order.payment_terms_days ?? 30;
      updates.payment_due_date = businessDaysFromNow(paymentTerms);
    }

    const { data } = await supabase.from('orders').update(updates).eq('id', orderId).select().single();
    if (data) {
      setOrders(prev => prev.map(o => o.id === orderId ? data as Order : o));

      // Auto-trigger: delivered → follow up on payment after payment terms window
      if (status === 'delivered') {
        const paymentTerms = order.payment_terms_days ?? 30;
        autoFollowUp({
          title: `Follow up on payment from ${order.product_type} — payment due`,
          action_type: 'overdue_invoice',
          entity_type: 'order',
          entity_id: orderId,
          assigned_to: order.sales_person_id ?? null,
          priority: 'high',
          daysFromNow: paymentTerms,
        });
      }
    }
  }, [orders, autoFollowUp]);

  const updateCommissioningStatus = useCallback(async (oeId: string, status: CommissioningStatus) => {
    const { data } = await supabase
      .from('order_engineers')
      .update({ commissioning_status: status })
      .eq('id', oeId)
      .select()
      .single();
    if (data) setOrderEngineers(prev => prev.map(oe => oe.id === oeId ? data as OrderEngineer : oe));
  }, []);

  const addRFQ = useCallback(async (rfq: Omit<RFQ, 'id' | 'converted_order_id'>) => {
    const { data } = await supabase.from('rfqs').insert({ ...rfq, converted_order_id: null }).select().single();
    if (data) {
      setRFQs(prev => [data as RFQ, ...prev]);
      // Auto-trigger: new RFQ received → float to supplier
      autoFollowUp({
        title: `Float RFQ to supplier — ${rfq.company_name}`,
        action_type: 'supplier_response',
        entity_type: 'rfq',
        entity_id: data.id,
        assigned_to: rfq.assigned_to ?? null,
        priority: rfq.priority === 'high' ? 'high' : 'medium',
        daysFromNow: 1,
      });
    }
  }, [autoFollowUp]);

  const updateRFQStatus = useCallback(async (rfqId: string, status: RFQStatus) => {
    const rfq = rfqs.find(r => r.id === rfqId);
    const updates: Record<string, unknown> = { status };
    if (status === 'quoted' && rfq && !rfq.quote_sent_date) {
      updates.quote_sent_date = businessToday();
    }
    const { data } = await supabase.from('rfqs').update(updates).eq('id', rfqId).select().single();
    if (data) {
      setRFQs(prev => prev.map(r => r.id === rfqId ? data as RFQ : r));
      // Auto-trigger: RFQ quoted → follow up with client in 3 days
      if (status === 'quoted' && rfq) {
        autoFollowUp({
          title: `Follow up with ${rfq.company_name} on submitted quote`,
          action_type: 'rfq_followup',
          entity_type: 'rfq',
          entity_id: rfqId,
          assigned_to: rfq.assigned_to ?? null,
          priority: rfq.priority === 'high' ? 'high' : 'medium',
          daysFromNow: 3,
        });
      }
    }
  }, [rfqs, autoFollowUp]);

  const updateRFQPriority = useCallback(async (rfqId: string, priority: RFQPriority) => {
    const { data } = await supabase.from('rfqs').update({ priority }).eq('id', rfqId).select().single();
    if (data) setRFQs(prev => prev.map(r => r.id === rfqId ? data as RFQ : r));
  }, []);

  const convertRFQToOrder = useCallback(async (
    rfqId: string,
    orderData: Omit<Order, 'id' | 'rfq_id'>,
  ) => {
    // T1-1: order insert + RFQ status update happen atomically in one
    // Postgres function (convert_rfq_to_order) instead of two separate
    // network calls — previously, a failure between the two left a real
    // order in the database whose RFQ still showed as 'quoted', letting a
    // second order get created from the same RFQ. See
    // supabase/migrations/20260730_t1_convert_rfq_to_order_rpc.sql.
    const { data: newOrder, error: orderError } = await supabase.rpc('convert_rfq_to_order', {
      p_rfq_id: rfqId,
      p_client_id: orderData.client_id,
      p_vendor_id: orderData.vendor_id,
      p_sales_person_id: orderData.sales_person_id,
      p_product_type: orderData.product_type,
      p_order_value: orderData.order_value,
      p_cost_value: orderData.cost_value,
      p_status: orderData.status,
      p_notes: orderData.notes,
      p_customer_po_number: orderData.customer_po_number,
      p_customer_po_date: orderData.customer_po_date,
      p_payment_terms_days: orderData.payment_terms_days,
      p_delivery_date: orderData.delivery_date,
      p_payment_due_date: orderData.payment_due_date,
    }).single();
    if (orderError || !newOrder) throw new Error(orderError?.message || 'Failed to create order');
    const order = newOrder as unknown as Order;
    setOrders(prev => [order, ...prev]);
    setRFQs(prev => prev.map(r => r.id === rfqId ? { ...r, status: 'converted' as const, converted_order_id: order.id } : r));
    // Auto-trigger: order created → pay supplier within 5 days to move to procurement
    const vendor = vendors.find(v => v.id === orderData.vendor_id);
    autoFollowUp({
      title: `Pay supplier ${vendor?.name ?? 'vendor'} to initiate procurement — ${order.product_type}`,
      action_type: 'order_status',
      entity_type: 'order',
      entity_id: order.id,
      assigned_to: orderData.sales_person_id ?? null,
      priority: 'high',
      daysFromNow: 5,
    });
  }, [vendors, autoFollowUp]);

  const addSupplierInquiry = useCallback(async (inquiry: Omit<SupplierInquiry, 'id'>) => {
    const { data } = await supabase.from('supplier_inquiries').insert(inquiry).select().single();
    if (data) {
      setSupplierInquiries(prev => [data as SupplierInquiry, ...prev]);
      // Auto-trigger: inquiry sent → follow up for supplier response in 48 hours
      const vendor = vendors.find(v => v.id === inquiry.vendor_id);
      const rfq = rfqs.find(r => r.id === inquiry.rfq_id);
      autoFollowUp({
        title: `Follow up with ${vendor?.name ?? 'supplier'} for quote — ${rfq?.company_name ?? 'RFQ'}`,
        action_type: 'supplier_response',
        entity_type: 'rfq',
        entity_id: inquiry.rfq_id,
        assigned_to: rfq?.assigned_to ?? null,
        priority: 'high',
        daysFromNow: 2, // 48 hours
      });
    }
  }, [vendors, rfqs, autoFollowUp]);

  const addSupplierQuote = useCallback(async (quote: Omit<SupplierQuote, 'id'>) => {
    const { data } = await supabase.from('supplier_quotes').insert(quote).select().single();
    if (data) setSupplierQuotes(prev => [data as SupplierQuote, ...prev]);
  }, []);

  const updateSupplierQuote = useCallback(async (quoteId: string, updates: Partial<Omit<SupplierQuote, 'id'>>) => {
    const { data } = await supabase
      .from('supplier_quotes')
      .update(updates)
      .eq('id', quoteId)
      .select()
      .single();
    if (data) setSupplierQuotes(prev => prev.map(sq => sq.id === quoteId ? data as SupplierQuote : sq));
  }, []);

  const addRFQLineItem = useCallback(async (item: Omit<RFQLineItem, 'id'>) => {
    const { data } = await supabase.from('rfq_line_items').insert(item).select().single();
    if (data) setRFQLineItems(prev => [...prev, data as RFQLineItem]);
  }, []);

  const updateRFQLineItem = useCallback(async (id: string, updates: Partial<Pick<RFQLineItem, 'product_type' | 'quantity' | 'specification'>>) => {
    const { data } = await supabase.from('rfq_line_items').update(updates).eq('id', id).select().single();
    if (data) setRFQLineItems(prev => prev.map(li => li.id === id ? data as RFQLineItem : li));
  }, []);

  const deleteRFQLineItem = useCallback(async (id: string) => {
    const { error } = await supabase.from('rfq_line_items').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete line item: ${error.message}`);
    setRFQLineItems(prev => prev.filter(li => li.id !== id));
  }, []);

  const updateInquiryStatus = useCallback(async (inquiryId: string, status: SupplierInquiryStatus) => {
    const { data } = await supabase
      .from('supplier_inquiries')
      .update({ status })
      .eq('id', inquiryId)
      .select()
      .single();
    if (data) setSupplierInquiries(prev => prev.map(si => si.id === inquiryId ? data as SupplierInquiry : si));
  }, []);

  const updateSupplierInquiry = useCallback(async (inquiryId: string, updates: Partial<Omit<SupplierInquiry, 'id'>>) => {
    const { data } = await supabase
      .from('supplier_inquiries')
      .update(updates)
      .eq('id', inquiryId)
      .select()
      .single();
    if (data) setSupplierInquiries(prev => prev.map(si => si.id === inquiryId ? data as SupplierInquiry : si));
  }, []);

  const getRFQMetrics = useCallback((dateStr: string) => {
    const rfqsToday = rfqs.filter(r => r.rfq_date === dateStr);
    const notFloated = rfqsToday.filter(r => !supplierInquiries.some(si => si.rfq_id === r.id)).length;
    const floated = rfqsToday.filter(r => supplierInquiries.some(si => si.rfq_id === r.id)).length;
    const responded = rfqsToday.filter(r => supplierQuotes.some(sq => sq.rfq_id === r.id)).length;
    return { receivedToday: rfqsToday.length, notFloated, floated, responded };
  }, [rfqs, supplierInquiries, supplierQuotes]);

  const getRFQMetricsByDateRange = useCallback((startDate: string, endDate: string) => {
    const rfqsInRange = rfqs.filter(r => {
      const rDate = r.rfq_date;
      return rDate >= startDate && rDate <= endDate;
    });
    const notFloated = rfqsInRange.filter(r => !supplierInquiries.some(si => si.rfq_id === r.id)).length;
    const floated = rfqsInRange.filter(r => supplierInquiries.some(si => si.rfq_id === r.id)).length;
    const responded = rfqsInRange.filter(r => supplierQuotes.some(sq => sq.rfq_id === r.id)).length;
    return { total: rfqsInRange.length, notFloated, floated, responded };
  }, [rfqs, supplierInquiries, supplierQuotes]);

  const updateClient = useCallback(async (clientId: string, updates: Partial<Omit<Client, 'id'>>) => {
    const { data } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', clientId)
      .select()
      .single();
    if (data) setClients(prev => prev.map(c => c.id === clientId ? data as Client : c));
  }, []);

  const updateVendor = useCallback(async (vendorId: string, updates: Partial<Omit<Vendor, 'id'>>) => {
    const { data } = await supabase
      .from('vendors')
      .update(updates)
      .eq('id', vendorId)
      .select()
      .single();
    if (data) setVendors(prev => prev.map(v => v.id === vendorId ? data as Vendor : v));
  }, []);

  const updateProspect = useCallback(async (prospectId: string, updates: Partial<Omit<Prospect, 'id' | 'converted_client_id'>>) => {
    const { data } = await supabase
      .from('prospects')
      .update(updates)
      .eq('id', prospectId)
      .select()
      .single();
    if (data) setProspects(prev => prev.map(p => p.id === prospectId ? data as Prospect : p));
  }, []);

  const updateRFQ = useCallback(async (rfqId: string, updates: Partial<Omit<RFQ, 'id' | 'converted_order_id'>>) => {
    const { data } = await supabase
      .from('rfqs')
      .update(updates)
      .eq('id', rfqId)
      .select()
      .single();
    if (data) setRFQs(prev => prev.map(r => r.id === rfqId ? data as RFQ : r));
  }, []);

  const updateOrder = useCallback(async (orderId: string, updates: Partial<Omit<Order, 'id' | 'rfq_id'>>) => {
    const { data } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();
    if (data) setOrders(prev => prev.map(o => o.id === orderId ? data as Order : o));
  }, []);

  const deleteRFQ = useCallback(async (rfqId: string) => {
    // Delete all follow-up actions for this RFQ from database
    const { error: faError } = await supabase.from('follow_up_actions').delete().eq('entity_id', rfqId).eq('entity_type', 'rfq');
    if (faError) throw new Error(`Failed to delete RFQ follow-ups: ${faError.message}`);

    const { error } = await supabase.from('rfqs').delete().eq('id', rfqId);
    if (error) throw new Error(`Failed to delete RFQ: ${error.message}`);

    setRFQs(prev => prev.filter(r => r.id !== rfqId));
    setFollowUpActions(prev => prev.filter(a => !(a.entity_id === rfqId && a.entity_type === 'rfq')));
  }, []);

  const deleteOrder = useCallback(async (orderId: string) => {
    // Delete all follow-up actions for this order from database
    const { error: faError } = await supabase.from('follow_up_actions').delete().eq('entity_id', orderId).eq('entity_type', 'order');
    if (faError) throw new Error(`Failed to delete order follow-ups: ${faError.message}`);

    // Delete the order FIRST, then reset the linked RFQ — so a failed delete
    // never leaves an RFQ reset to 'quoted' while its order still exists.
    const order = orders.find(o => o.id === orderId);
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) throw new Error(`Failed to delete order: ${error.message}`);

    if (order?.rfq_id) {
      // Only reset the RFQ if no sibling order still references it
      const siblingExists = orders.some(o => o.rfq_id === order.rfq_id && o.id !== orderId);
      if (!siblingExists) {
        const { error: rfqError } = await supabase
          .from('rfqs')
          .update({ status: 'quoted', converted_order_id: null })
          .eq('id', order.rfq_id);
        if (rfqError) console.error('Failed to reset RFQ after order delete:', rfqError.message);
        else setRFQs(prev => prev.map(r => r.id === order.rfq_id ? { ...r, status: 'quoted' as RFQStatus, converted_order_id: null } : r));
      }
    }

    setOrders(prev => prev.filter(o => o.id !== orderId));
    setFollowUpActions(prev => prev.filter(a => !(a.entity_id === orderId && a.entity_type === 'order')));
  }, [orders]);

  const deleteClient = useCallback(async (clientId: string) => {
    // Get IDs before deleting
    const clientRFQIds = rfqs.filter(r => r.client_id === clientId).map(r => r.id);
    const clientOrderIds = orders.filter(o => o.client_id === clientId).map(o => o.id);

    // Delete cascade: follow-up actions → RFQs, orders → client (batched)
    const relatedIds = [...clientRFQIds, ...clientOrderIds];
    if (relatedIds.length > 0) {
      const { error: faError } = await supabase.from('follow_up_actions').delete().in('entity_id', relatedIds);
      if (faError) throw new Error(`Failed to delete client follow-ups: ${faError.message}`);
    }

    const { error: rfqError } = await supabase.from('rfqs').delete().eq('client_id', clientId);
    if (rfqError) throw new Error(`Failed to delete client RFQs: ${rfqError.message}`);
    const { error: orderError } = await supabase.from('orders').delete().eq('client_id', clientId);
    if (orderError) throw new Error(`Failed to delete client orders: ${orderError.message}`);
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) throw new Error(`Failed to delete client: ${error.message}`);

    // Update local state only after every DB delete succeeded
    setClients(prev => prev.filter(c => c.id !== clientId));
    setRFQs(prev => prev.filter(r => r.client_id !== clientId));
    setOrders(prev => prev.filter(o => o.client_id !== clientId));
    setFollowUpActions(prev => prev.filter(a =>
      !(clientRFQIds.includes(a.entity_id) || clientOrderIds.includes(a.entity_id))
    ));
  }, [rfqs, orders]);

  const deleteVendor = useCallback(async (vendorId: string) => {
    const { error } = await supabase.from('vendors').delete().eq('id', vendorId);
    if (error) throw new Error(`Failed to delete vendor: ${error.message}`);
    setVendors(prev => prev.filter(v => v.id !== vendorId));
  }, []);

  const deleteProspect = useCallback(async (prospectId: string) => {
    const { error } = await supabase.from('prospects').delete().eq('id', prospectId);
    if (error) throw new Error(`Failed to delete prospect: ${error.message}`);
    setProspects(prev => prev.filter(p => p.id !== prospectId));
  }, []);

  // ============================================
  // BOOKKEEPING METHODS
  // ============================================

  const getNextInvoiceNumber = useCallback(async (): Promise<string> => {
    // Derive the sequence from the DATABASE, not local state — two users
    // creating invoices concurrently used to get the same number, and
    // deleting an invoice caused number reuse.
    const monthPrefix = businessToday().slice(0, 7).replace('-', '');
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', `INV-${monthPrefix}%`)
      .order('invoice_number', { ascending: false })
      .limit(1);
    let seq = 1;
    if (data && data.length > 0) {
      const m = data[0].invoice_number.match(/-(\d+)$/);
      if (m) seq = parseInt(m[1]) + 1;
    }
    const date = businessToday().replace(/-/g, '');
    return `INV-${date}-${String(seq).padStart(3, '0')}`;
  }, []);

  const addInvoice = useCallback(async (inv: CreateInvoiceInput, createdBy: string): Promise<Invoice> => {
    // Retry once on a UNIQUE(invoice_number) collision (concurrent creates)
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          ...inv,
          created_by: createdBy,
          updated_by: null,
          updated_at: null,
        })
        .select()
        .single();
      if (!error && data) {
        const invoice = data as Invoice;
        setInvoices(prev => addUnique(prev, invoice, 'invoice_id', true));
        return invoice;
      }
      if (error?.code === '23505' && attempt === 0) {
        // Duplicate invoice number — regenerate and retry
        inv = { ...inv, invoice_number: await getNextInvoiceNumber() };
        continue;
      }
      throw new Error(`Failed to create invoice: ${error?.message ?? 'unknown error'}`);
    }
    throw new Error('Failed to create invoice after retry');
  }, [getNextInvoiceNumber]);

  const updateInvoice = useCallback(async (invoiceId: string, updates: UpdateInvoiceInput) => {
    const { data } = await supabase
      .from('invoices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('invoice_id', invoiceId)
      .select()
      .single();
    if (data) setInvoices(prev => prev.map(inv => inv.invoice_id === invoiceId ? data as Invoice : inv));
  }, []);

  const deleteInvoice = useCallback(async (invoiceId: string) => {
    const { error } = await supabase.from('invoices').delete().eq('invoice_id', invoiceId);
    if (error) throw new Error(`Failed to delete invoice: ${error.message}`);
    setInvoices(prev => prev.filter(inv => inv.invoice_id !== invoiceId));
  }, []);

  const addExpense = useCallback(async (exp: CreateExpenseInput, createdBy: string): Promise<Expense> => {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        ...exp,
        created_by: createdBy,
        updated_by: null,
        updated_at: null,
      })
      .select()
      .single();
    if (error || !data) throw new Error('Failed to create expense');
    const expense = data as Expense;
    setExpenses(prev => [expense, ...prev]);
    return expense;
  }, []);

  const updateExpense = useCallback(async (expenseId: string, updates: UpdateExpenseInput) => {
    const { data } = await supabase
      .from('expenses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('expense_id', expenseId)
      .select()
      .single();
    if (data) setExpenses(prev => prev.map(exp => exp.expense_id === expenseId ? data as Expense : exp));
  }, []);

  const deleteExpense = useCallback(async (expenseId: string) => {
    const { error } = await supabase.from('expenses').delete().eq('expense_id', expenseId);
    if (error) throw new Error(`Failed to delete expense: ${error.message}`);
    setExpenses(prev => prev.filter(exp => exp.expense_id !== expenseId));
  }, []);

  // ── Recurring monthly expense templates ─────────────────────────────────────
  const addRecurringExpense = useCallback(async (input: CreateRecurringExpenseInput, createdBy: string): Promise<RecurringExpense> => {
    const { data, error } = await supabase
      .from('recurring_expenses')
      .insert({
        label: input.label,
        category: input.category,
        amount: input.amount,
        day_of_month: input.day_of_month ?? 1,
        active: input.active ?? true,
        start_month: input.start_month ?? '',
        notes: input.notes ?? null,
        created_by: createdBy,
      })
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to create recurring expense: ${error?.message ?? 'unknown error'}`);
    const rec = data as RecurringExpense;
    setRecurringExpenses(prev => addUnique(prev, rec, 'id'));
    return rec;
  }, []);

  const updateRecurringExpense = useCallback(async (id: string, updates: UpdateRecurringExpenseInput) => {
    const { data, error } = await supabase
      .from('recurring_expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update recurring expense: ${error?.message ?? 'unknown error'}`);
    setRecurringExpenses(prev => prev.map(r => r.id === id ? data as RecurringExpense : r));
  }, []);

  const deleteRecurringExpense = useCallback(async (id: string) => {
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete recurring expense: ${error.message}`);
    setRecurringExpenses(prev => prev.filter(r => r.id !== id));
  }, []);

  // Post the given templates into `expenses` for a YYYY-MM period. Idempotent:
  // the (recurring_id, period) unique index guarantees at most one per month, so
  // re-posting (or a concurrent post) silently skips the ones already there.
  const postRecurringExpenses = useCallback(async (
    period: string,
    items: { id: string; amount: number }[],
    createdBy: string,
  ): Promise<number> => {
    if (!/^\d{4}-\d{2}$/.test(period)) throw new Error('Invalid period (expected YYYY-MM)');
    if (items.length === 0) return 0;

    const templates = new Map(recurringExpenses.map(r => [r.id, r]));
    const rows = items.map(({ id, amount }) => {
      const t = templates.get(id);
      if (!t) throw new Error('Unknown recurring template');
      const day = String(Math.min(28, Math.max(1, t.day_of_month || 1))).padStart(2, '0');
      return {
        date: `${period}-${day}`,
        amount,
        category: t.category,
        description: t.label,
        order_id: null,
        recurring_id: t.id,
        period,
        created_by: createdBy,
        updated_by: null,
        updated_at: null,
      };
    });

    // ignoreDuplicates so a re-post is a no-op rather than an error.
    const { data, error } = await supabase
      .from('expenses')
      .upsert(rows, { onConflict: 'recurring_id,period', ignoreDuplicates: true })
      .select();
    if (error) throw new Error(`Failed to post recurring expenses: ${error.message}`);

    const inserted = (data ?? []) as Expense[];
    if (inserted.length) setExpenses(prev => [...inserted, ...prev]);
    return inserted.length;
  }, [recurringExpenses]);

  // ── GST invoice register ────────────────────────────────────────────────────
  const addGstInvoice = useCallback(async (input: CreateGstInvoiceInput, createdBy: string): Promise<GstInvoice> => {
    const { data, error } = await supabase
      .from('gst_invoices')
      .insert({ ...input, created_by: createdBy })
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to create GST invoice: ${error?.message ?? 'unknown error'}`);
    const gi = data as GstInvoice;
    setGstInvoices(prev => addUnique(prev, gi, 'id'));
    return gi;
  }, []);

  const updateGstInvoice = useCallback(async (id: string, updates: UpdateGstInvoiceInput) => {
    const { data, error } = await supabase
      .from('gst_invoices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update GST invoice: ${error?.message ?? 'unknown error'}`);
    setGstInvoices(prev => prev.map(g => g.id === id ? data as GstInvoice : g));
  }, []);

  const deleteGstInvoice = useCallback(async (id: string) => {
    const { error } = await supabase.from('gst_invoices').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete GST invoice: ${error.message}`);
    setGstInvoices(prev => prev.filter(g => g.id !== id));
  }, []);

  // ── Employees + attendance ──────────────────────────────────────────────────
  const addEmployee = useCallback(async (input: CreateEmployeeInput, createdBy: string): Promise<Employee> => {
    const { data, error } = await supabase
      .from('employees')
      .insert({ ...input, created_by: createdBy })
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to add employee: ${error?.message ?? 'unknown error'}`);
    const emp = data as Employee;
    setEmployees(prev => addUnique(prev, emp, 'id'));
    return emp;
  }, []);

  const updateEmployee = useCallback(async (id: string, updates: UpdateEmployeeInput) => {
    const { data, error } = await supabase
      .from('employees')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update employee: ${error?.message ?? 'unknown error'}`);
    setEmployees(prev => prev.map(e => e.id === id ? data as Employee : e));
  }, []);

  const deleteEmployee = useCallback(async (id: string) => {
    // attendance rows cascade in the DB (ON DELETE CASCADE)
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete employee: ${error.message}`);
    setEmployees(prev => prev.filter(e => e.id !== id));
    setAttendance(prev => prev.filter(a => a.employee_id !== id));
  }, []);

  // Mark a day for an employee. Upsert on (employee_id, date) so re-marking the
  // same day updates it instead of creating a duplicate.
  const markAttendance = useCallback(async (input: MarkAttendanceInput, createdBy: string): Promise<AttendanceRecord> => {
    const { data, error } = await supabase
      .from('attendance')
      .upsert({ ...input, created_by: createdBy }, { onConflict: 'employee_id,date' })
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to mark attendance: ${error?.message ?? 'unknown error'}`);
    const rec = data as AttendanceRecord;
    setAttendance(prev => {
      const without = prev.filter(a => !(a.employee_id === rec.employee_id && a.date === rec.date));
      return [rec, ...without];
    });
    return rec;
  }, []);

  const deleteAttendance = useCallback(async (id: string) => {
    const { error } = await supabase.from('attendance').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete attendance: ${error.message}`);
    setAttendance(prev => prev.filter(a => a.id !== id));
  }, []);

  const recordPayment = useCallback(async (payment: CreatePaymentInput, recordedBy: string): Promise<PaymentRecord> => {
    // T1-2 (part 2/3): insert + recompute amount_paid + status update happen
    // atomically in one Postgres function (record_invoice_payment), which
    // locks the invoice row first so two concurrent payments on the same
    // invoice can't race. Previously three separate calls (insert, sum,
    // updateInvoice) with the same partial-failure exposure as
    // record_order_payment. See
    // supabase/migrations/20260730_t1_record_invoice_payment_rpc.sql.
    const { data, error } = await supabase.rpc('record_invoice_payment', {
      p_invoice_id: payment.invoice_id,
      p_amount: payment.amount,
      p_payment_date: payment.payment_date,
      p_payment_method: payment.payment_method ?? null,
      p_notes: payment.notes ?? null,
      p_recorded_by: recordedBy,
    }).single();
    if (error || !data) throw new Error(`Failed to record payment: ${error?.message ?? 'unknown error'}`);
    const paymentRecord = data as PaymentRecord;
    setPaymentRecords(prev => addUnique(prev, paymentRecord, 'payment_id', true));
    // The invoice's amount_paid/payment_status update is reflected via the
    // existing `invoices` realtime subscription (isAdmin-gated, but the only
    // caller of recordPayment is FinancePage, which is itself
    // RequireRole ['admin'] — so the calling session is always subscribed).
    return paymentRecord;
  }, []);

  const getDashboardMetrics = useCallback((): DashboardMetrics => {
    const todayStr = businessToday();
    const currentMonth = todayStr.slice(0, 7);
    const currentYear = parseInt(todayStr.slice(0, 4));

    // MTD metrics
    const mtdInvoices = invoices.filter(inv => inv.issued_date.startsWith(currentMonth));
    const mtdExpenses = expenses.filter(exp => exp.date.startsWith(currentMonth));
    const mtdRevenue = mtdInvoices.reduce((sum, inv) => sum + inv.invoice_amount, 0);
    const mtdExpensesTotal = mtdExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const mtdProfit = mtdRevenue - mtdExpensesTotal;

    // YTD metrics
    const ytdInvoices = invoices.filter(inv => inv.issued_date.startsWith(String(currentYear)));
    const ytdExpenses = expenses.filter(exp => exp.date.startsWith(String(currentYear)));
    const ytdRevenue = ytdInvoices.reduce((sum, inv) => sum + inv.invoice_amount, 0);
    const ytdExpensesTotal = ytdExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const ytdProfit = ytdRevenue - ytdExpensesTotal;

    // AR metrics
    const outstandingInvoices = invoices.filter(inv => inv.payment_status !== 'Paid');
    const outstandingAR = outstandingInvoices.reduce((sum, inv) => sum + (inv.invoice_amount - inv.amount_paid), 0);

    // Overdue metrics (an invoice due today is not overdue until tomorrow)
    const overdueInvoices = invoices.filter(inv => {
      if (inv.payment_status === 'Paid' || !inv.due_date) return false;
      return inv.due_date.slice(0, 10) < todayStr;
    });
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.invoice_amount - inv.amount_paid), 0);

    // AP metrics — real outstanding payables (was hardcoded 0)
    const outstandingAP = payables
      .filter(p => p.payment_status !== 'Paid')
      .reduce((sum, p) => sum + (p.amount - p.amount_paid), 0);

    return {
      mtd_revenue: mtdRevenue,
      mtd_expenses: mtdExpensesTotal,
      mtd_profit: mtdProfit,
      ytd_revenue: ytdRevenue,
      ytd_expenses: ytdExpensesTotal,
      ytd_profit: ytdProfit,
      outstanding_ar: outstandingAR,
      outstanding_ap: outstandingAP,
      overdue_invoices_count: overdueInvoices.length,
      overdue_invoices_amount: overdueAmount,
    };
  }, [invoices, expenses, payables]);

  const getMonthlySummary = useCallback((month: string): MonthlySummary => {
    const monthInvoices = invoices.filter(inv => inv.issued_date.startsWith(month));
    const monthExpenses = expenses.filter(exp => exp.date.startsWith(month));
    const totalRevenue = monthInvoices.reduce((sum, inv) => sum + inv.invoice_amount, 0);
    const totalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    return {
      month,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_profit: totalRevenue - totalExpenses,
      invoice_count: monthInvoices.length,
      expense_count: monthExpenses.length,
    };
  }, [invoices, expenses]);

  const getProjectProfitability = useCallback((rfqId: string): ProjectProfitability => {
    const rfq = rfqs.find(r => r.id === rfqId);
    const projectInvoices = invoices.filter(inv => inv.rfq_id === rfqId);
    const projectExpenses = expenses.filter(exp => exp.rfq_id === rfqId);
    const totalRevenue = projectInvoices.reduce((sum, inv) => sum + inv.invoice_amount, 0);
    // Include order-level procurement costs (cost_value) for orders born from
    // this RFQ — previously ignored, which overstated project margins.
    const orderCosts = orders
      .filter(o => o.rfq_id === rfqId)
      .reduce((sum, o) => sum + (o.cost_value || 0), 0);
    const totalExpenses = projectExpenses.reduce((sum, exp) => sum + exp.amount, 0) + orderCosts;
    const profit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      rfq_id: rfqId,
      client_name: rfq?.company_name ?? 'Unknown',
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_profit: profit,
      margin_percent: margin,
      invoice_count: projectInvoices.length,
      expense_count: projectExpenses.length,
    };
  }, [rfqs, invoices, expenses, orders]);

  const getCashflowStatement = useCallback((months: number): CashflowMonth[] => {
    // True cashflow: inflow = actual payments received (payment_records, by
    // payment_date — includes partial payments, booked in the month the cash
    // arrived, not the invoice issue month); outflow = expenses by date.
    const result: CashflowMonth[] = [];
    let closingBalance = 0;
    const [ty, tm] = businessToday().split('-').map(Number);

    for (let i = months - 1; i >= 0; i--) {
      // Pure calendar arithmetic — no Date/timezone conversion
      const total = ty * 12 + (tm - 1) - i;
      const month = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;

      const inflow = paymentRecords
        .filter(pr => pr.payment_date?.startsWith(month))
        .reduce((sum, pr) => sum + pr.amount, 0);
      const outflow = expenses
        .filter(exp => exp.date.startsWith(month))
        .reduce((sum, exp) => sum + exp.amount, 0);

      const openingBalance = result.length > 0 ? result[result.length - 1].closing_balance : 0;
      closingBalance = openingBalance + inflow - outflow;

      result.push({
        month,
        opening_balance: openingBalance,
        total_inflow: inflow,
        total_outflow: outflow,
        closing_balance: closingBalance,
      });
    }

    return result;
  }, [paymentRecords, expenses]);

  const getARAgingBuckets = useCallback((): ARAgingBucket[] => {
    const now = new Date();
    const pending = invoices.filter(inv => inv.payment_status !== 'Paid');

    const buckets: ARAgingBucket[] = [
      { bucket: 'Not yet due', count: 0, total_amount: 0, invoices: [] },
      { bucket: '0-30 days', count: 0, total_amount: 0, invoices: [] },
      { bucket: '30-60 days', count: 0, total_amount: 0, invoices: [] },
      { bucket: '60+ days', count: 0, total_amount: 0, invoices: [] },
    ];

    pending.forEach(inv => {
      const dueDateMs = inv.due_date ? new Date(inv.due_date).getTime() : NaN;
      const daysOverdue = isNaN(dueDateMs) ? 0 : Math.floor((now.getTime() - dueDateMs) / (1000 * 60 * 60 * 24));
      const outstanding = (inv.invoice_amount ?? 0) - (inv.amount_paid ?? 0);
      let bucketIndex = 0;

      if (isNaN(dueDateMs) || daysOverdue < 0) {
        bucketIndex = 0; // Not yet due
      } else if (daysOverdue <= 30) {
        bucketIndex = 1;
      } else if (daysOverdue <= 60) {
        bucketIndex = 2;
      } else {
        bucketIndex = 3;
      }

      buckets[bucketIndex].count++;
      buckets[bucketIndex].total_amount += outstanding;
      buckets[bucketIndex].invoices.push(inv);
    });

    return buckets;
  }, [invoices]);

  // ===== FINANCE REBUILD (admin-only): payments attached to orders =====

  /** Record a payment received FROM the customer. If it completes a delivered
   *  order's full value, the order auto-advances to payment_received. */
  const addOrderPayment = useCallback(async (payment: Omit<OrderPayment, 'id' | 'created_at' | 'recorded_by'>, recordedBy: string): Promise<OrderPayment> => {
    // T1-2: insert + recompute total + conditional status advance happen
    // atomically in one Postgres function (record_order_payment), which also
    // locks the order row first so two concurrent payments on the same order
    // can't race on the status-advance decision. Previously three separate
    // calls; a failure between them could record the payment but leave a
    // fully-paid order stuck at 'delivered' with no advance and no error.
    // See supabase/migrations/20260730_t1_record_order_payment_rpc.sql.
    const { data, error } = await supabase.rpc('record_order_payment', {
      p_order_id: payment.order_id,
      p_amount: payment.amount,
      p_payment_date: payment.payment_date,
      p_payment_method: payment.payment_method,
      p_reference: payment.reference,
      p_notes: payment.notes,
      p_recorded_by: recordedBy,
    }).single();
    if (error || !data) throw new Error(`Failed to record payment: ${error?.message ?? 'unknown error'}`);
    const rec = data as OrderPayment;
    setOrderPayments(prev => addUnique(prev, rec, 'id', true));
    // If the RPC advanced the order to 'payment_received', the existing
    // `orders` realtime subscription (unconditional UPDATE handler, not
    // admin-gated — see the channel setup above) picks up the authoritative
    // new row and updates local state — no need to guess it here.
    return rec;
  }, []);

  const deleteOrderPayment = useCallback(async (paymentId: string) => {
    const { error } = await supabase.from('order_payments').delete().eq('id', paymentId);
    if (error) throw new Error(`Failed to delete payment: ${error.message}`);
    setOrderPayments(prev => prev.filter(p => p.id !== paymentId));
  }, []);

  /** Record a payment made TO the supplier against an order (incl. advances). */
  const addSupplierPayment = useCallback(async (payment: Omit<SupplierPayment, 'id' | 'created_at' | 'recorded_by'>, recordedBy: string): Promise<SupplierPayment> => {
    const { data, error } = await supabase
      .from('supplier_payments')
      .insert({ ...payment, recorded_by: recordedBy })
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to record supplier payment: ${error?.message ?? 'unknown error'}`);
    const rec = data as SupplierPayment;
    setSupplierPayments(prev => addUnique(prev, rec, 'id', true));
    return rec;
  }, []);

  const deleteSupplierPayment = useCallback(async (paymentId: string) => {
    const { error } = await supabase.from('supplier_payments').delete().eq('id', paymentId);
    if (error) throw new Error(`Failed to delete supplier payment: ${error.message}`);
    setSupplierPayments(prev => prev.filter(p => p.id !== paymentId));
  }, []);

  // Save a full costing for an RFQ or order — replaces all its existing lines.
  const saveCostLines = useCallback(async (
    parent: { rfq_id: string } | { order_id: string },
    lines: Omit<CostLine, 'id' | 'created_at' | 'rfq_id' | 'order_id'>[],
  ) => {
    const parentCol: 'rfq_id' | 'order_id' = 'rfq_id' in parent ? 'rfq_id' : 'order_id';
    const parentId = 'rfq_id' in parent ? parent.rfq_id : parent.order_id;

    const { error: delErr } = await supabase.from('cost_lines').delete().eq(parentCol, parentId);
    if (delErr) throw new Error(`Failed to update costing: ${delErr.message}`);

    let inserted: CostLine[] = [];
    if (lines.length > 0) {
      const rows = lines.map((l, i) => ({ ...l, [parentCol]: parentId, sort_order: i }));
      const { data, error } = await supabase.from('cost_lines').insert(rows).select();
      if (error) throw new Error(`Failed to save costing: ${error.message}`);
      inserted = (data ?? []) as CostLine[];
    }
    setCostLines(prev => [
      ...prev.filter(c => c[parentCol] !== parentId),
      ...inserted,
    ]);
  }, []);

  // Update the shared costing config (singleton row id=1). Admin only (RLS).
  const updateCostingConfig = useCallback(async (values: CostingConfigValues) => {
    const { data, error } = await supabase
      .from('costing_config')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to save costing settings: ${error?.message ?? 'unknown error'}`);
    setCostingConfig(data as CostingConfig);
  }, []);

  const addPayable = useCallback(async (payable: CreatePayableInput, createdBy: string): Promise<Payable> => {
    const { data, error } = await supabase
      .from('payables')
      .insert({
        ...payable,
        amount_paid: 0,
        payment_status: 'Pending',
        created_by: createdBy,
      })
      .select()
      .single();

    if (error || !data) throw new Error('Failed to create payable');
    const newPayable = data as Payable;
    setPayables(prev => [newPayable, ...prev]);
    return newPayable;
  }, []);

  const updatePayable = useCallback(async (payableId: string, updates: UpdatePayableInput) => {
    const { data, error } = await supabase
      .from('payables')
      .update(updates)
      .eq('payable_id', payableId)
      .select()
      .single();

    if (error || !data) throw new Error('Failed to update payable');
    setPayables(prev => prev.map(p => p.payable_id === payableId ? data as Payable : p));
  }, []);

  const deletePayable = useCallback(async (payableId: string) => {
    const { error } = await supabase
      .from('payables')
      .delete()
      .eq('payable_id', payableId);

    if (error) throw new Error('Failed to delete payable');
    setPayables(prev => prev.filter(p => p.payable_id !== payableId));
  }, []);

  const recordPayablePayment = useCallback(async (payment: CreatePayablePaymentInput, recordedBy: string) => {
    const { data: updatedPayable, error } = await supabase.rpc('record_payable_payment', {
      p_payable_id: payment.payable_id,
      p_amount: payment.amount,
      p_payment_date: payment.payment_date,
      p_payment_method: payment.payment_method ?? null,
      p_reference_number: payment.reference_number ?? null,
      p_notes: payment.notes ?? null,
      p_recorded_by: recordedBy,
    }).single();

    if (error || !updatedPayable) throw new Error(error?.message || 'Failed to record payment');

    setPayables(prev =>
      prev.map(p => (p.payable_id === payment.payable_id ? (updatedPayable as Payable) : p))
    );
  }, []);

  const getAPAgingBuckets = useCallback((): ARAgingBucket[] => {
    const now = new Date();
    const pending = payables.filter(p => p.payment_status !== 'Paid');

    const buckets: ARAgingBucket[] = [
      { bucket: 'Not yet due', count: 0, total_amount: 0, invoices: [] },
      { bucket: '0-30 days', count: 0, total_amount: 0, invoices: [] },
      { bucket: '30-60 days', count: 0, total_amount: 0, invoices: [] },
      { bucket: '60+ days', count: 0, total_amount: 0, invoices: [] },
    ];

    pending.forEach(payable => {
      const dueDateMs = payable.due_date ? new Date(payable.due_date).getTime() : NaN;
      const daysOverdue = isNaN(dueDateMs) ? 0 : Math.floor((now.getTime() - dueDateMs) / (1000 * 60 * 60 * 24));
      const outstanding = (payable.amount ?? 0) - (payable.amount_paid ?? 0);
      let bucketIndex = 0;

      if (isNaN(dueDateMs) || daysOverdue < 0) {
        bucketIndex = 0; // Not yet due
      } else if (daysOverdue <= 30) {
        bucketIndex = 1;
      } else if (daysOverdue <= 60) {
        bucketIndex = 2;
      } else {
        bucketIndex = 3;
      }

      buckets[bucketIndex].count++;
      buckets[bucketIndex].total_amount += outstanding;
      // Mock invoice object for compatibility
      buckets[bucketIndex].invoices.push({
        invoice_id: payable.payable_id,
        invoice_number: payable.invoice_reference || `AP-${payable.payable_id.slice(0, 8)}`,
        client_id: payable.vendor_id,
        order_id: null,
        rfq_id: null,
        invoice_amount: payable.amount,
        issued_date: payable.created_at ? payable.created_at.split('T')[0] : payable.due_date,
        due_date: payable.due_date,
        payment_status: payable.payment_status,
        amount_paid: payable.amount_paid,
        payment_method: payable.payment_method,
        created_by: payable.created_by,
        created_at: payable.created_at,
        updated_by: payable.updated_by,
        updated_at: payable.updated_at,
        notes: null,
      } as Invoice);
    });

    return buckets;
  }, [payables]);

  // ===== PROFITABILITY ENGINE =====

  const updateOrderCosts = useCallback(async (
    orderId: string,
    costs: {
      material_cost?: number;
      engineering_cost?: number;
      logistics_cost?: number;
      overhead_cost?: number;
    }
  ) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update(costs)
        .eq('id', orderId);

      if (error) throw error;

      // Update local state
      setOrders(prev => prev.map(o =>
        o.id === orderId
          ? { ...o, ...costs }
          : o
      ));

      return { success: true };
    } catch (error) {
      console.error('Error updating order costs:', error);
      return { success: false, error };
    }
  }, []);

  const getOrderWithProfitability = useCallback(async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_value,
          status,
          product_type,
          material_cost,
          engineering_cost,
          logistics_cost,
          overhead_cost,
          total_cost,
          profit,
          profit_margin,
          vendor_id,
          vendors(id, name)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data as unknown as OrderProfitability;
    } catch (error) {
      console.error('Error fetching order with profitability:', error);
      return null;
    }
  }, []);

  const getOrdersWithProfitability = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_value,
          status,
          product_type,
          material_cost,
          engineering_cost,
          logistics_cost,
          overhead_cost,
          total_cost,
          profit,
          profit_margin,
          vendor_id,
          vendors(id, name),
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as OrderProfitability[];
    } catch (error) {
      console.error('Error fetching orders with profitability:', error);
      return [];
    }
  }, []);

  const getProfitabilityMetrics = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('order_value, total_cost, profit, profit_margin, status')
        .neq('status', 'po_received'); // exclude brand-new orders not yet in procurement

      if (error) throw error;

      const orders = data || [];
      const totalProfit = orders.reduce((sum, o) => sum + (o.profit || 0), 0);
      const avgMargin = orders.length > 0
        ? (orders.reduce((sum, o) => sum + (o.profit_margin || 0), 0) / orders.length)
        : 0;

      const topProfitable = orders
        .sort((a, b) => (b.profit || 0) - (a.profit || 0))
        .slice(0, 3);

      const lowMarginOrders = orders.filter(o => (o.profit_margin || 0) < 10).length;

      return {
        totalProfit,
        avgMargin: parseFloat(avgMargin.toFixed(2)),
        topProfitable,
        totalOrders: orders.length,
        lowMarginOrders,
      };
    } catch (error) {
      console.error('Error fetching profitability metrics:', error);
      return {
        totalProfit: 0,
        avgMargin: 0,
        topProfitable: [],
        totalOrders: 0,
        lowMarginOrders: 0,
      };
    }
  }, []);

  // ===== SUPPLIER COMPARISON ENGINE =====

  const getQuotesForRFQ = useCallback(async (rfqId: string) => {
    try {
      const { data, error } = await supabase
        .from('supplier_quotes')
        .select(`
          id,
          rfq_id,
          vendor_id,
          unit_price,
          lead_time_days,
          moq,
          validity_days,
          notes,
          is_recommended,
          value_score,
          vendors(id, name),
          inquiry_id
        `)
        .eq('rfq_id', rfqId)
        .order('unit_price', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as RFQQuote[];
    } catch (error) {
      console.error('Error fetching quotes for RFQ:', error);
      return [];
    }
  }, []);

  const calculateValueScore = useCallback((unitPrice: number, leadTime: number, moq: number) => {
    // Value score, weighted for a price-driven industrial business:
    //   price 50% · lead time 30% · MOQ 20%
    // Soft hyperbolic curves (100 / (1 + x/scale)) instead of linear clamps —
    // the old formula scored 0 for ANY price ≥ Rs 500k, so at typical
    // industrial prices every quote tied on price and MOQ (50%) decided the
    // "recommended" badge, sometimes picking the most expensive quote.
    // These curves never saturate, so cheaper/faster/smaller always wins.
    const priceScore = 100 / (1 + unitPrice / 1_000_000); // Rs 1M → 50
    const leadTimeScore = 100 / (1 + leadTime / 30);      // 30 days → 50
    const moqScore = 100 / (1 + moq / 50);                // 50 units → 50

    const score = (priceScore * 0.50) + (leadTimeScore * 0.30) + (moqScore * 0.20);
    return parseFloat(score.toFixed(2));
  }, []);

  const updateQuoteRecommendation = useCallback(async (quoteId: string, isRecommended: boolean) => {
    try {
      const { error } = await supabase
        .from('supplier_quotes')
        .update({ is_recommended: isRecommended })
        .eq('id', quoteId);

      if (error) throw error;

      setSupplierQuotes(prev => prev.map(q =>
        q.id === quoteId ? { ...q, is_recommended: isRecommended } : q
      ));
    } catch (error) {
      console.error('Error updating quote recommendation:', error);
    }
  }, []);

  const getRecommendedQuote = useCallback(async (rfqId: string) => {
    try {
      const quotes = await getQuotesForRFQ(rfqId);

      // Find manually recommended quote
      let recommended = quotes.find(q => q.is_recommended);

      // If none, recommend based on value score
      if (!recommended && quotes.length > 0) {
        recommended = quotes.reduce((best, current) => {
          const bestScore = calculateValueScore(best.unit_price, best.lead_time_days, best.moq);
          const currentScore = calculateValueScore(current.unit_price, current.lead_time_days, current.moq);
          return currentScore > bestScore ? current : best;
        });
      }

      return recommended || null;
    } catch (error) {
      console.error('Error getting recommended quote:', error);
      return null;
    }
  }, [getQuotesForRFQ, calculateValueScore]);

  // ===== FOLLOW-UP AUTOMATION =====

  const createFollowUp = useCallback(async (followUp: Partial<FollowUpAction> & { title: string; due_date: string }) => {
    try {
      // Ensure entity_id is omitted entirely when null/undefined
      // so the DB doesn't receive null for a possibly NOT NULL column
      const payload = { ...followUp };
      if (!payload.entity_id) delete payload.entity_id;

      const { data, error } = await supabase
        .from('follow_up_actions')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      setFollowUpActions(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Error creating follow-up:', error);
      throw error;
    }
  }, []);


  const getPendingFollowUps = useCallback(async (userId?: string) => {
    try {
      let query = supabase
        .from('follow_up_actions')
        .select('*')
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

      if (userId) {
        query = query.eq('assigned_to', userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching pending follow-ups:', error);
      return [];
    }
  }, []);

  const completeFollowUp = useCallback(async (followUpId: string, outcomeNote?: string) => {
    try {
      // Find the action to check for recurrence
      const action = followUpActions.find(fa => fa.id === followUpId);

      const completedAt = new Date().toISOString();
      const updates: Record<string, unknown> = {
        status: 'completed',
        completed_at: completedAt,
      };
      // APPEND the outcome — overwriting destroyed the original description
      if (outcomeNote) {
        updates.description = action?.description
          ? `${action.description}\n\nOutcome: ${outcomeNote}`
          : `Outcome: ${outcomeNote}`;
      }

      const { error } = await supabase
        .from('follow_up_actions')
        .update(updates)
        .eq('id', followUpId);

      if (error) throw error;

      setFollowUpActions(prev => prev.map(fa =>
        fa.id === followUpId
          ? { ...fa, ...updates }
          : fa
      ));

      // Handle recurring: auto-create next action if recurrence is set.
      // Prefer the recurrence_days column; fall back to the legacy
      // __recur:N__ tag embedded in older actions' descriptions.
      if (action) {
        const recurMatch = action.description?.match(/__recur:(\d+)__/);
        const recurDays: number | null =
          (action.recurrence_days && Number(action.recurrence_days) > 0)
            ? Number(action.recurrence_days)
            : (recurMatch ? parseInt(recurMatch[1]) : null);

        if (recurDays) {
          const nextDueStr = businessDaysFromNow(recurDays);

          await supabase.from('follow_up_actions').insert([{
            action_type: action.action_type,
            entity_type: action.entity_type,
            entity_id: action.entity_id,
            title: action.title,
            description: action.description, // original description, not the outcome
            due_date: nextDueStr,
            priority: action.priority,
            assigned_to: action.assigned_to,
            status: 'pending',
            recurrence_days: recurDays,
          }]).select().then(({ data }) => {
            if (data?.[0]) setFollowUpActions(prev => addUnique(prev, data[0], 'id', true));
          });
        }
      }
    } catch (error) {
      console.error('Error completing follow-up:', error);
    }
  }, [followUpActions]);

  // Snooze: push due_date to a later date, action resurfaces then
  const snoozeFollowUp = useCallback(async (followUpId: string, newDueDate: string) => {
    try {
      const { error } = await supabase
        .from('follow_up_actions')
        .update({ due_date: newDueDate, status: 'pending' })
        .eq('id', followUpId);
      if (error) throw error;
      setFollowUpActions(prev => prev.map(fa =>
        fa.id === followUpId ? { ...fa, due_date: newDueDate, status: 'pending' } : fa
      ));
    } catch (err) {
      console.error('Error snoozing follow-up:', err);
    }
  }, []);

  // Get ALL pending actions regardless of user (for admin oversight)
  const getAllFollowUps = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('follow_up_actions')
        .select('*')
        .eq('status', 'pending')
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  }, []);

  // Count open actions for a user (for workload indicator)
  const getUserWorkload = useCallback(async (userId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('follow_up_actions')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', userId)
        .eq('status', 'pending');
      if (error) return 0;
      return count ?? 0;
    } catch {
      return 0;
    }
  }, []);

  // Apply a sequence — creates multiple follow-up actions in one call
  const applySequence = useCallback(async (
    steps: Array<{ title: string; action_type: string; daysFromNow: number; priority: 'low'|'medium'|'high'; notes?: string }>,
    entityType: string,
    entityId: string | null,
    assignedTo: string | null,
  ) => {
    const inserts = steps.map(step => {
      return {
        action_type: step.action_type,
        entity_type: entityType,
        entity_id: entityId,
        title: step.title,
        description: step.notes || null,
        due_date: businessDaysFromNow(step.daysFromNow),
        priority: step.priority,
        assigned_to: assignedTo,
        status: 'pending',
      };
    });
    const { data, error } = await supabase
      .from('follow_up_actions')
      .insert(inserts)
      .select();
    if (!error && data) {
      setFollowUpActions(prev => [...data, ...prev]);
    }
  }, []);

  // Get recently completed actions for the activity feed
  const getRecentActivity = useCallback(async (limit = 20): Promise<FollowUpAction[]> => {
    try {
      const { data, error } = await supabase
        .from('follow_up_actions')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(limit);
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  }, []);

  // Pattern insights — average days to completion per action type
  const getPatternInsights = useCallback((): { actionType: string; avgDays: number; label: string }[] => {
    const completed = followUpActions.filter(a =>
      a.status === 'completed' && a.completed_at && a.created_at
    );
    const byType: Record<string, number[]> = {};
    completed.forEach(a => {
      const created = new Date(a.created_at).getTime();
      const done    = new Date(a.completed_at).getTime();
      const days    = Math.round((done - created) / 86400000);
      if (!byType[a.action_type]) byType[a.action_type] = [];
      byType[a.action_type].push(days);
    });
    const LABELS: Record<string, string> = {
      rfq_followup:      'RFQ follow-ups',
      supplier_response: 'Supplier follow-ups',
      order_status:      'Order status checks',
      overdue_invoice:   'Invoice follow-ups',
      custom:            'Custom actions',
    };
    return Object.entries(byType)
      .map(([actionType, days]) => ({
        actionType,
        avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
        label: LABELS[actionType] || actionType,
      }))
      .filter(i => i.avgDays >= 0) // same-day completions (0 days) are valid data
      .sort((a, b) => b.avgDays - a.avgDays);
  }, [followUpActions]);

  const deleteFollowUp = useCallback(async (followUpId: string) => {
    try {
      const { error } = await supabase
        .from('follow_up_actions')
        .delete()
        .eq('id', followUpId);

      if (error) throw error;

      setFollowUpActions(prev => prev.filter(fa => fa.id !== followUpId));
    } catch (error) {
      console.error('Error deleting follow-up:', error);
    }
  }, []);

  const getOverdueFollowUps = useCallback(async () => {
    try {
      const today = businessToday();
      const { data, error } = await supabase
        .from('follow_up_actions')
        .select('*')
        .eq('status', 'pending')
        .lt('due_date', today)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching overdue follow-ups:', error);
      return [];
    }
  }, []);

  const getFollowUpsForEntity = useCallback(async (entityType: string, entityId: string) => {
    try {
      const { data, error } = await supabase
        .from('follow_up_actions')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching follow-ups for entity:', error);
      return [];
    }
  }, []);

  // Memoize the context value — a fresh object literal here re-renders EVERY
  // consumer in the app on EVERY render of the provider. All functions are
  // useCallback-wrapped, so listing them as deps keeps this stable.
  const contextValue = useMemo(() => ({
    loading, users, clients, prospects, vendors, orders, orderEngineers, rfqs,
    supplierInquiries, supplierQuotes, rfqLineItems,
    getUserName, getClientName, getVendorName,
    addClient, addProspect, addVendor, addOrder, addOrderEngineer,
    convertProspect, updateOrderStatus, updateCommissioningStatus,
    addRFQ, updateRFQStatus, updateRFQPriority, convertRFQToOrder,
    getNextOrderStatus,
    addSupplierInquiry, addSupplierQuote, updateSupplierQuote, addRFQLineItem, updateRFQLineItem, deleteRFQLineItem, updateInquiryStatus, updateSupplierInquiry,
    getRFQMetrics, getRFQMetricsByDateRange,
    updateClient, updateVendor, updateProspect, updateRFQ, updateOrder,
    deleteRFQ, deleteOrder, deleteClient, deleteVendor, deleteProspect,
    invoices, expenses, paymentRecords, payables,
    orderPayments, supplierPayments, addOrderPayment, deleteOrderPayment, addSupplierPayment, deleteSupplierPayment,
    costLines, saveCostLines, costingConfig, updateCostingConfig,
    addInvoice, updateInvoice, deleteInvoice,
    addExpense, updateExpense, deleteExpense,
    recurringExpenses, addRecurringExpense, updateRecurringExpense, deleteRecurringExpense, postRecurringExpenses,
    gstInvoices, addGstInvoice, updateGstInvoice, deleteGstInvoice,
    employees, attendance, addEmployee, updateEmployee, deleteEmployee, markAttendance, deleteAttendance,
    recordPayment,
    addPayable, updatePayable, deletePayable, recordPayablePayment,
    getDashboardMetrics, getMonthlySummary, getProjectProfitability,
    getCashflowStatement, getARAgingBuckets, getAPAgingBuckets, getNextInvoiceNumber,
    updateOrderCosts, getOrderWithProfitability, getOrdersWithProfitability, getProfitabilityMetrics,
    getQuotesForRFQ, calculateValueScore, updateQuoteRecommendation, getRecommendedQuote,
    followUpActions,
    createFollowUp, getPendingFollowUps, getAllFollowUps, completeFollowUp, snoozeFollowUp,
    deleteFollowUp, getOverdueFollowUps, getFollowUpsForEntity, getUserWorkload,
    applySequence, getRecentActivity, getPatternInsights,
  }), [
    loading, users, clients, prospects, vendors, orders, orderEngineers, rfqs,
    supplierInquiries, supplierQuotes, rfqLineItems,
    getUserName, getClientName, getVendorName,
    addClient, addProspect, addVendor, addOrder, addOrderEngineer,
    convertProspect, updateOrderStatus, updateCommissioningStatus,
    addRFQ, updateRFQStatus, updateRFQPriority, convertRFQToOrder,
    getNextOrderStatus,
    addSupplierInquiry, addSupplierQuote, updateSupplierQuote, addRFQLineItem, updateRFQLineItem, deleteRFQLineItem, updateInquiryStatus, updateSupplierInquiry,
    getRFQMetrics, getRFQMetricsByDateRange,
    updateClient, updateVendor, updateProspect, updateRFQ, updateOrder,
    deleteRFQ, deleteOrder, deleteClient, deleteVendor, deleteProspect,
    invoices, expenses, paymentRecords, payables,
    orderPayments, supplierPayments, addOrderPayment, deleteOrderPayment, addSupplierPayment, deleteSupplierPayment,
    costLines, saveCostLines, costingConfig, updateCostingConfig,
    addInvoice, updateInvoice, deleteInvoice,
    addExpense, updateExpense, deleteExpense,
    recurringExpenses, addRecurringExpense, updateRecurringExpense, deleteRecurringExpense, postRecurringExpenses,
    gstInvoices, addGstInvoice, updateGstInvoice, deleteGstInvoice,
    employees, attendance, addEmployee, updateEmployee, deleteEmployee, markAttendance, deleteAttendance,
    recordPayment,
    addPayable, updatePayable, deletePayable, recordPayablePayment,
    getDashboardMetrics, getMonthlySummary, getProjectProfitability,
    getCashflowStatement, getARAgingBuckets, getAPAgingBuckets, getNextInvoiceNumber,
    updateOrderCosts, getOrderWithProfitability, getOrdersWithProfitability, getProfitabilityMetrics,
    getQuotesForRFQ, calculateValueScore, updateQuoteRecommendation, getRecommendedQuote,
    followUpActions,
    createFollowUp, getPendingFollowUps, getAllFollowUps, completeFollowUp, snoozeFollowUp,
    deleteFollowUp, getOverdueFollowUps, getFollowUpsForEntity, getUserWorkload,
    applySequence, getRecentActivity, getPatternInsights,
  ]);

  return (
    <CRMContext.Provider value={contextValue}>
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM(): CRMContextType {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error('useCRM must be used within CRMProvider');
  return ctx;
}
