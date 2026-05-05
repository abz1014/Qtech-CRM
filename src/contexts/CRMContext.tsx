import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Client, Prospect, Vendor, Order, OrderEngineer, RFQ, User,
  OrderStatus, CommissioningStatus, RFQStatus, RFQPriority,
  SupplierInquiry, SupplierQuote, RFQLineItem, SupplierInquiryStatus,
} from '@/types/crm';
import {
  Invoice, Expense, PaymentRecord, Payable, CreateInvoiceInput, UpdateInvoiceInput,
  CreateExpenseInput, UpdateExpenseInput, CreatePaymentInput, CreatePayableInput,
  UpdatePayableInput, CreatePayablePaymentInput, DashboardMetrics,
  MonthlySummary, ProjectProfitability, CashflowMonth, ARAgingBucket,
} from '@/types/bookkeeping';

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
  convertRFQToOrder: (rfqId: string, orderData: Omit<Order, 'id' | 'rfq_id' | 'confirmed_date'>) => Promise<void>;
  getNextOrderStatus: (currentStatus: OrderStatus) => OrderStatus | null;
  addSupplierInquiry: (inquiry: Omit<SupplierInquiry, 'id'>) => Promise<void>;
  addSupplierQuote: (quote: Omit<SupplierQuote, 'id'>) => Promise<void>;
  updateSupplierQuote: (quoteId: string, updates: Partial<Omit<SupplierQuote, 'id'>>) => Promise<void>;
  addRFQLineItem: (item: Omit<RFQLineItem, 'id'>) => Promise<void>;
  updateInquiryStatus: (inquiryId: string, status: SupplierInquiryStatus) => Promise<void>;
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
  ) => Promise<{ success: boolean; error?: any }>;
  getOrderWithProfitability: (orderId: string) => Promise<any>;
  getOrdersWithProfitability: () => Promise<any[]>;
  getProfitabilityMetrics: () => Promise<{
    totalProfit: number;
    avgMargin: number;
    topProfitable: any[];
    totalOrders: number;
    lowMarginOrders: number;
  }>;

  // Supplier Comparison Methods
  getQuotesForRFQ: (rfqId: string) => Promise<any[]>;
  calculateValueScore: (unitPrice: number, leadTime: number, moq: number) => number;
  updateQuoteRecommendation: (quoteId: string, isRecommended: boolean) => Promise<void>;
  getRecommendedQuote: (rfqId: string) => Promise<any | null>;

  // Follow-Up Automation Methods
  createFollowUp: (followUp: {
    action_type: 'rfq_followup' | 'supplier_response' | 'overdue_invoice' | 'order_status';
    entity_type: string;
    entity_id: string;
    title: string;
    description?: string;
    due_date: string;
    priority: 'low' | 'medium' | 'high';
    assigned_to?: string;
  }) => Promise<any>;
  getPendingFollowUps: (userId?: string) => Promise<any[]>;
  getAllFollowUps: () => Promise<any[]>;
  completeFollowUp: (followUpId: string, outcomeNote?: string) => Promise<void>;
  snoozeFollowUp: (followUpId: string, newDueDate: string) => Promise<void>;
  deleteFollowUp: (followUpId: string) => Promise<void>;
  getOverdueFollowUps: () => Promise<any[]>;
  getFollowUpsForEntity: (entityType: string, entityId: string) => Promise<any[]>;
  getUserWorkload: (userId: string) => Promise<number>;
  applySequence: (steps: Array<{ title: string; action_type: string; daysFromNow: number; priority: 'low'|'medium'|'high'; notes?: string }>, entityType: string, entityId: string | null, assignedTo: string | null) => Promise<void>;
  getRecentActivity: (limit?: number) => Promise<any[]>;
  getPatternInsights: () => { actionType: string; avgDays: number; label: string }[];
}

const CRMContext = createContext<CRMContextType | null>(null);

export function CRMProvider({ children }: { children: React.ReactNode }) {
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
  const [followUpActions, setFollowUpActions] = useState<any[]>([]);

  // Bookkeeping state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);

  useEffect(() => {
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
        { data: invoicesData },
        { data: expensesData },
        { data: paymentsData },
        { data: payablesData },
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
        supabase.from('invoices').select('*').order('issued_date', { ascending: false }).then(res => res).catch(() => ({ data: null })),
        supabase.from('expenses').select('*').order('date', { ascending: false }).then(res => res).catch(() => ({ data: null })),
        supabase.from('payment_records').select('*').order('payment_date', { ascending: false }).then(res => res).catch(() => ({ data: null })),
        supabase.from('payables').select('*').order('due_date', { ascending: false }).then(res => res).catch(() => ({ data: null })),
      ]);
      setUsers((usersData ?? []) as User[]);
      setClients((clientsData ?? []) as Client[]);
      setProspects((prospectsData ?? []) as Prospect[]);
      setVendors((vendorsData ?? []) as Vendor[]);
      setOrders((ordersData ?? []) as Order[]);
      setOrderEngineers((oeData ?? []) as OrderEngineer[]);
      setRFQs((rfqsData ?? []) as RFQ[]);
      setSupplierInquiries((inquiriesData ?? []) as SupplierInquiry[]);
      setSupplierQuotes((quotesData ?? []) as SupplierQuote[]);
      setRFQLineItems((lineItemsData ?? []) as RFQLineItem[]);
      setInvoices((invoicesData ?? []) as Invoice[]);
      setExpenses((expensesData ?? []) as Expense[]);
      setPaymentRecords((paymentsData ?? []) as PaymentRecord[]);
      setPayables((payablesData ?? []) as Payable[]);
      setLoading(false);

      // ===== SUPABASE REALTIME SUBSCRIPTIONS =====
      const channel = supabase.channel('crm-changes');

      // Subscribe to clients changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setClients(prev => [...prev, payload.new as Client]);
          } else if (payload.eventType === 'UPDATE') {
            setClients(prev => prev.map(c => c.id === payload.new.id ? payload.new as Client : c));
          } else if (payload.eventType === 'DELETE') {
            setClients(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      );

      // Subscribe to prospects changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prospects' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setProspects(prev => [...prev, payload.new as Prospect]);
          } else if (payload.eventType === 'UPDATE') {
            setProspects(prev => prev.map(p => p.id === payload.new.id ? payload.new as Prospect : p));
          } else if (payload.eventType === 'DELETE') {
            setProspects(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      );

      // Subscribe to vendors changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendors' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setVendors(prev => [...prev, payload.new as Vendor]);
          } else if (payload.eventType === 'UPDATE') {
            setVendors(prev => prev.map(v => v.id === payload.new.id ? payload.new as Vendor : v));
          } else if (payload.eventType === 'DELETE') {
            setVendors(prev => prev.filter(v => v.id !== payload.old.id));
          }
        }
      );

      // Subscribe to orders changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setOrders(prev => [payload.new as Order, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new as Order : o));
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== payload.old.id));
          }
        }
      );

      // Subscribe to order_engineers changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_engineers' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setOrderEngineers(prev => [...prev, payload.new as OrderEngineer]);
          } else if (payload.eventType === 'UPDATE') {
            setOrderEngineers(prev => prev.map(oe => oe.id === payload.new.id ? payload.new as OrderEngineer : oe));
          } else if (payload.eventType === 'DELETE') {
            setOrderEngineers(prev => prev.filter(oe => oe.id !== payload.old.id));
          }
        }
      );

      // Subscribe to rfqs changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rfqs' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setRFQs(prev => [payload.new as RFQ, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setRFQs(prev => prev.map(r => r.id === payload.new.id ? payload.new as RFQ : r));
          } else if (payload.eventType === 'DELETE') {
            setRFQs(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      );

      // Subscribe to supplier_inquiries changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'supplier_inquiries' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setSupplierInquiries(prev => [payload.new as SupplierInquiry, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setSupplierInquiries(prev => prev.map(si => si.id === payload.new.id ? payload.new as SupplierInquiry : si));
          } else if (payload.eventType === 'DELETE') {
            setSupplierInquiries(prev => prev.filter(si => si.id !== payload.old.id));
          }
        }
      );

      // Subscribe to supplier_quotes changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'supplier_quotes' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setSupplierQuotes(prev => [payload.new as SupplierQuote, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setSupplierQuotes(prev => prev.map(sq => sq.id === payload.new.id ? payload.new as SupplierQuote : sq));
          } else if (payload.eventType === 'DELETE') {
            setSupplierQuotes(prev => prev.filter(sq => sq.id !== payload.old.id));
          }
        }
      );

      // Subscribe to rfq_line_items changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rfq_line_items' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setRFQLineItems(prev => [...prev, payload.new as RFQLineItem]);
          } else if (payload.eventType === 'UPDATE') {
            setRFQLineItems(prev => prev.map(li => li.id === payload.new.id ? payload.new as RFQLineItem : li));
          } else if (payload.eventType === 'DELETE') {
            setRFQLineItems(prev => prev.filter(li => li.id !== payload.old.id));
          }
        }
      );

      // Subscribe to follow_up_actions changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follow_up_actions' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setFollowUpActions(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setFollowUpActions(prev => prev.map(fa => fa.id === payload.new.id ? payload.new : fa));
          } else if (payload.eventType === 'DELETE') {
            setFollowUpActions(prev => prev.filter(fa => fa.id !== payload.old.id));
          }
        }
      );

      // Subscribe to invoices changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setInvoices(prev => [payload.new as Invoice, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setInvoices(prev => prev.map(inv => inv.invoice_id === payload.new.invoice_id ? payload.new as Invoice : inv));
          } else if (payload.eventType === 'DELETE') {
            setInvoices(prev => prev.filter(inv => inv.invoice_id !== payload.old.invoice_id));
          }
        }
      );

      // Subscribe to expenses changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setExpenses(prev => [payload.new as Expense, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setExpenses(prev => prev.map(exp => exp.expense_id === payload.new.expense_id ? payload.new as Expense : exp));
          } else if (payload.eventType === 'DELETE') {
            setExpenses(prev => prev.filter(exp => exp.expense_id !== payload.old.expense_id));
          }
        }
      );

      // Subscribe to payment_records changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_records' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setPaymentRecords(prev => [payload.new as PaymentRecord, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setPaymentRecords(prev => prev.map(pr => pr.payment_id === payload.new.payment_id ? payload.new as PaymentRecord : pr));
          } else if (payload.eventType === 'DELETE') {
            setPaymentRecords(prev => prev.filter(pr => pr.payment_id !== payload.old.payment_id));
          }
        }
      );

      // Subscribe to payables changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payables' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setPayables(prev => [payload.new as Payable, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setPayables(prev => prev.map(p => p.payable_id === payload.new.payable_id ? payload.new as Payable : p));
          } else if (payload.eventType === 'DELETE') {
            setPayables(prev => prev.filter(p => p.payable_id !== payload.old.payable_id));
          }
        }
      );

      // Subscribe to the channel
      await channel.subscribe();

      // Cleanup: unsubscribe when component unmounts
      return () => {
        supabase.removeChannel(channel);
      };
    };
    load();
  }, []);

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
      const due = new Date();
      due.setDate(due.getDate() + (params.daysFromNow ?? 2));
      const due_date = due.toISOString().split('T')[0];
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
      if (!error && data) setFollowUpActions(prev => [data, ...prev]);
    } catch {
      // Auto-triggers are best-effort — never block the main action
    }
  }, []);

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
    const { data, error } = await supabase.from('orders').insert(o).select().single();
    if (error || !data) throw new Error('Failed to create order');
    const order = data as Order;
    setOrders(prev => [order, ...prev]);
    return order;
  }, []);

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

    const today = new Date().toISOString().split('T')[0];
    const updates: Partial<Order> = { status };

    if (status === 'po_received') updates.confirmed_date = today;

    // When delivered: record delivery date + auto-calculate payment due date
    if (status === 'delivered') {
      updates.delivery_date = today;
      const paymentTerms = order.payment_terms_days ?? 30;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + paymentTerms);
      updates.payment_due_date = dueDate.toISOString().split('T')[0];
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
    const { data } = await supabase.from('rfqs').update({ status }).eq('id', rfqId).select().single();
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
    orderData: Omit<Order, 'id' | 'rfq_id' | 'confirmed_date'>,
  ) => {
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({ ...orderData, rfq_id: rfqId, confirmed_date: null })
      .select()
      .single();
    if (orderError || !newOrder) throw new Error(orderError?.message || 'Failed to create order');
    setOrders(prev => [newOrder as Order, ...prev]);
    const { data: updatedRFQ, error: rfqError } = await supabase
      .from('rfqs')
      .update({ status: 'converted', converted_order_id: newOrder.id })
      .eq('id', rfqId)
      .select()
      .single();
    if (rfqError) throw new Error(rfqError.message);
    if (updatedRFQ) setRFQs(prev => prev.map(r => r.id === rfqId ? updatedRFQ as RFQ : r));
    // Auto-trigger: order created → pay supplier within 5 days to move to procurement
    const vendor = vendors.find(v => v.id === orderData.vendor_id);
    autoFollowUp({
      title: `Pay supplier ${vendor?.name ?? 'vendor'} to initiate procurement — ${newOrder.product_type}`,
      action_type: 'order_status',
      entity_type: 'order',
      entity_id: newOrder.id,
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

  const updateInquiryStatus = useCallback(async (inquiryId: string, status: SupplierInquiryStatus) => {
    const { data } = await supabase
      .from('supplier_inquiries')
      .update({ status })
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
    await supabase.from('rfqs').delete().eq('id', rfqId);
    setRFQs(prev => prev.filter(r => r.id !== rfqId));
  }, []);

  const deleteOrder = useCallback(async (orderId: string) => {
    await supabase.from('orders').delete().eq('id', orderId);
    setOrders(prev => prev.filter(o => o.id !== orderId));
  }, []);

  const deleteClient = useCallback(async (clientId: string) => {
    await supabase.from('clients').delete().eq('id', clientId);
    setClients(prev => prev.filter(c => c.id !== clientId));
  }, []);

  const deleteVendor = useCallback(async (vendorId: string) => {
    await supabase.from('vendors').delete().eq('id', vendorId);
    setVendors(prev => prev.filter(v => v.id !== vendorId));
  }, []);

  const deleteProspect = useCallback(async (prospectId: string) => {
    await supabase.from('prospects').delete().eq('id', prospectId);
    setProspects(prev => prev.filter(p => p.id !== prospectId));
  }, []);

  // ============================================
  // BOOKKEEPING METHODS
  // ============================================

  const getNextInvoiceNumber = useCallback(async (): Promise<string> => {
    const today = new Date().toISOString().split('-').slice(0, 2).join('');
    const invoicesThisMonth = invoices.filter(inv =>
      inv.invoice_number.startsWith(`INV-${today}`)
    );
    const seq = invoicesThisMonth.length + 1;
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return `INV-${date}-${String(seq).padStart(3, '0')}`;
  }, [invoices]);

  const addInvoice = useCallback(async (inv: CreateInvoiceInput, createdBy: string): Promise<Invoice> => {
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
    if (error || !data) throw new Error('Failed to create invoice');
    const invoice = data as Invoice;
    setInvoices(prev => [invoice, ...prev]);
    return invoice;
  }, []);

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
    await supabase.from('invoices').delete().eq('invoice_id', invoiceId);
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
    await supabase.from('expenses').delete().eq('expense_id', expenseId);
    setExpenses(prev => prev.filter(exp => exp.expense_id !== expenseId));
  }, []);

  const recordPayment = useCallback(async (payment: CreatePaymentInput, recordedBy: string): Promise<PaymentRecord> => {
    const { data: paymentData, error: paymentError } = await supabase
      .from('payment_records')
      .insert({
        ...payment,
        recorded_by: recordedBy,
      })
      .select()
      .single();
    if (paymentError || !paymentData) throw new Error('Failed to record payment');

    const paymentRecord = paymentData as PaymentRecord;
    setPaymentRecords(prev => [paymentRecord, ...prev]);

    // Update invoice amount_paid
    const totalPaid = paymentRecords
      .filter(p => p.invoice_id === payment.invoice_id)
      .reduce((sum, p) => sum + p.amount, payment.amount);

    let newStatus: 'Pending' | 'Paid' | 'Overdue' | 'Partial' = 'Pending';
    const invoice = invoices.find(inv => inv.invoice_id === payment.invoice_id);
    if (invoice) {
      if (totalPaid >= invoice.invoice_amount) {
        newStatus = 'Paid';
      } else if (totalPaid > 0) {
        newStatus = 'Partial';
      } else if (new Date(invoice.due_date) < new Date()) {
        newStatus = 'Overdue';
      }
    }

    await updateInvoice(payment.invoice_id, {
      amount_paid: totalPaid,
      payment_status: newStatus,
      payment_method: payment.payment_method,
    });

    return paymentRecord;
  }, [invoices, paymentRecords, updateInvoice]);

  const getDashboardMetrics = useCallback((): DashboardMetrics => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentYear = now.getFullYear();

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

    // Overdue metrics
    const overdueInvoices = invoices.filter(inv => {
      if (inv.payment_status === 'Paid' || !inv.due_date) return false;
      const d = new Date(inv.due_date);
      return !isNaN(d.getTime()) && d < now;
    });
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.invoice_amount - inv.amount_paid), 0);

    return {
      mtd_revenue: mtdRevenue,
      mtd_expenses: mtdExpensesTotal,
      mtd_profit: mtdProfit,
      ytd_revenue: ytdRevenue,
      ytd_expenses: ytdExpensesTotal,
      ytd_profit: ytdProfit,
      outstanding_ar: outstandingAR,
      outstanding_ap: 0,
      overdue_invoices_count: overdueInvoices.length,
      overdue_invoices_amount: overdueAmount,
    };
  }, [invoices, expenses]);

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
    const totalExpenses = projectExpenses.reduce((sum, exp) => sum + exp.amount, 0);
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
  }, [rfqs, invoices, expenses]);

  const getCashflowStatement = useCallback((months: number): CashflowMonth[] => {
    const result: CashflowMonth[] = [];
    let closingBalance = 0;

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const monthInvoices = invoices.filter(inv =>
        inv.issued_date.startsWith(month) && inv.payment_status === 'Paid'
      );
      const monthExpenses = expenses.filter(exp => exp.date.startsWith(month));

      const inflow = monthInvoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
      const outflow = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
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
  }, [invoices, expenses]);

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
    const payable = payables.find(p => p.payable_id === payment.payable_id);
    if (!payable) throw new Error('Payable not found');

    const newAmountPaid = payable.amount_paid + payment.amount;
    if (newAmountPaid > payable.amount) throw new Error('Payment amount exceeds payable amount');

    const paymentStatus = newAmountPaid === payable.amount ? 'Paid' : 'Partial';

    const { error } = await supabase
      .from('payables')
      .update({
        amount_paid: newAmountPaid,
        payment_status: paymentStatus,
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
      })
      .eq('payable_id', payment.payable_id);

    if (error) throw new Error('Failed to record payment');

    setPayables(prev =>
      prev.map(p =>
        p.payable_id === payment.payable_id
          ? {
              ...p,
              amount_paid: newAmountPaid,
              payment_status: paymentStatus,
              payment_date: payment.payment_date,
              payment_method: payment.payment_method,
            }
          : p
      )
    );
  }, [payables]);

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
      return data;
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
      return data || [];
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
      return data || [];
    } catch (error) {
      console.error('Error fetching quotes for RFQ:', error);
      return [];
    }
  }, []);

  const calculateValueScore = useCallback((unitPrice: number, leadTime: number, moq: number) => {
    // Value score = weighted calculation
    // Lower price = higher score (25% weight)
    // Shorter lead time = higher score (25% weight)
    // Lower MOQ = higher score (50% weight)

    const priceScore = Math.max(0, 100 - (unitPrice / 500000) * 100);
    const leadTimeScore = Math.max(0, 100 - (leadTime / 60) * 100);
    const moqScore = Math.max(0, 100 - (moq / 100) * 100);

    const score = (priceScore * 0.25) + (leadTimeScore * 0.25) + (moqScore * 0.50);
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

  const createFollowUp = useCallback(async (followUp: any) => {
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

      const updates: Record<string, any> = {
        status: 'completed',
        completed_at: new Date().toISOString(),
      };
      if (outcomeNote) updates.description = outcomeNote;

      const { error } = await supabase
        .from('follow_up_actions')
        .update(updates)
        .eq('id', followUpId);

      if (error) throw error;

      setFollowUpActions(prev => prev.map(fa =>
        fa.id === followUpId
          ? { ...fa, status: 'completed', completed_at: new Date().toISOString() }
          : fa
      ));

      // Handle recurring: auto-create next action if recurrence is set
      if (action) {
        // Check description for __recur:N__ pattern
        const recurMatch = action.description?.match(/__recur:(\d+)__/);
        const recurDays = recurMatch ? parseInt(recurMatch[1]) : null;

        if (recurDays) {
          const nextDue = new Date();
          nextDue.setDate(nextDue.getDate() + recurDays);
          const nextDueStr = nextDue.toISOString().split('T')[0];

          await supabase.from('follow_up_actions').insert([{
            action_type: action.action_type,
            entity_type: action.entity_type,
            entity_id: action.entity_id,
            title: action.title,
            description: action.description, // preserve recur tag
            due_date: nextDueStr,
            priority: action.priority,
            assigned_to: action.assigned_to,
            status: 'pending',
          }]).select().then(({ data }) => {
            if (data?.[0]) setFollowUpActions(prev => [data[0], ...prev]);
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
        fa.id === followUpId ? { ...fa, due_date: newDueDate } : fa
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
    const today = new Date();
    const inserts = steps.map(step => {
      const due = new Date(today);
      due.setDate(due.getDate() + step.daysFromNow);
      return {
        action_type: step.action_type,
        entity_type: entityType,
        entity_id: entityId,
        title: step.title,
        description: step.notes || null,
        due_date: due.toISOString().split('T')[0],
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
  const getRecentActivity = useCallback(async (limit = 20): Promise<any[]> => {
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
      .filter(i => i.avgDays > 0)
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
      const today = new Date().toISOString().split('T')[0];
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

  return (
    <CRMContext.Provider value={{
      loading, users, clients, prospects, vendors, orders, orderEngineers, rfqs,
      supplierInquiries, supplierQuotes, rfqLineItems,
      getUserName, getClientName, getVendorName,
      addClient, addProspect, addVendor, addOrder, addOrderEngineer,
      convertProspect, updateOrderStatus, updateCommissioningStatus,
      addRFQ, updateRFQStatus, updateRFQPriority, convertRFQToOrder,
      getNextOrderStatus,
      addSupplierInquiry, addSupplierQuote, updateSupplierQuote, addRFQLineItem, updateInquiryStatus,
      getRFQMetrics, getRFQMetricsByDateRange,
      updateClient, updateVendor, updateProspect, updateRFQ, updateOrder,
      deleteRFQ, deleteOrder, deleteClient, deleteVendor, deleteProspect,
      invoices, expenses, paymentRecords, payables,
      addInvoice, updateInvoice, deleteInvoice,
      addExpense, updateExpense, deleteExpense,
      recordPayment,
      addPayable, updatePayable, deletePayable, recordPayablePayment,
      getDashboardMetrics, getMonthlySummary, getProjectProfitability,
      getCashflowStatement, getARAgingBuckets, getAPAgingBuckets, getNextInvoiceNumber,
      updateOrderCosts, getOrderWithProfitability, getOrdersWithProfitability, getProfitabilityMetrics,
      getQuotesForRFQ, calculateValueScore, updateQuoteRecommendation, getRecommendedQuote,
      createFollowUp, getPendingFollowUps, getAllFollowUps, completeFollowUp, snoozeFollowUp,
      deleteFollowUp, getOverdueFollowUps, getFollowUpsForEntity, getUserWorkload,
      applySequence, getRecentActivity, getPatternInsights,
    }}>
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM(): CRMContextType {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error('useCRM must be used within CRMProvider');
  return ctx;
}
