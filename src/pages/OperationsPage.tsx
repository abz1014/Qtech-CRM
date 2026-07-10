import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { FileText, Send, MessageSquare, ShoppingCart, AlertTriangle, ChevronRight } from 'lucide-react';
import { businessToday } from '@/lib/dates';
import { formatPKR } from '@/lib/format';

const ORDER_STALE_DAYS = 30; // an order not delivered N days after its PO is "stale"

function daysSince(dateStr: string | null | undefined, today: string): number | null {
  if (!dateStr) return null;
  const d = (new Date(today).getTime() - new Date(String(dateStr).slice(0, 10)).getTime()) / 86400000;
  return isNaN(d) ? null : Math.floor(d);
}

const orderStatusLabel: Record<string, string> = {
  po_received: 'PO Received',
  procurement: 'Procurement',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  payment_received: 'Paid',
};

export default function OperationsPage() {
  const navigate = useNavigate();
  const { rfqs, orders, supplierInquiries, supplierQuotes, getClientName } = useCRM();
  const today = businessToday();

  const hasInquiry = useMemo(() => new Set(supplierInquiries.map(i => i.rfq_id)), [supplierInquiries]);
  const hasQuote = useMemo(() => new Set(supplierQuotes.map(q => q.rfq_id)), [supplierQuotes]);

  const lists = useMemo(() => {
    const active = (r: any) => r.status !== 'converted' && r.status !== 'lost';

    // 1. Not floated — received but no supplier inquiry yet
    const notFloated = rfqs.filter(r => active(r) && !hasInquiry.has(r.id))
      .sort((a, b) => a.rfq_date.localeCompare(b.rfq_date));

    // 2. Awaiting supplier response — floated but no quote back
    const awaitingSupplier = rfqs.filter(r => active(r) && hasInquiry.has(r.id) && !hasQuote.has(r.id))
      .sort((a, b) => a.rfq_date.localeCompare(b.rfq_date));

    // 3. Awaiting customer decision — quote sent to client, no order yet
    const awaitingCustomer = rfqs.filter(r => r.status === 'quoted')
      .sort((a, b) => ((a as any).quote_sent_date || a.rfq_date).localeCompare((b as any).quote_sent_date || b.rfq_date));

    // 4. Orders in progress — not delivered/paid; stale if older than threshold
    const ordersInProgress = orders.filter(o => o.status === 'po_received' || o.status === 'procurement' || o.status === 'in_transit')
      .map(o => ({ o, age: daysSince((o as any).customer_po_date || o.confirmed_date, today) }))
      .sort((a, b) => (b.age ?? 0) - (a.age ?? 0));

    // 5. Overdue payments — past payment due date, not yet paid
    const overduePayments = orders.filter(o => o.status !== 'payment_received' && (o as any).payment_due_date && String((o as any).payment_due_date).slice(0, 10) < today)
      .sort((a, b) => String((a as any).payment_due_date).localeCompare(String((b as any).payment_due_date)));

    return { notFloated, awaitingSupplier, awaitingCustomer, ordersInProgress, overduePayments };
  }, [rfqs, orders, hasInquiry, hasQuote, today]);

  const AgeBadge = ({ days, staleAt }: { days: number | null; staleAt?: number }) => {
    if (days === null) return null;
    const stale = staleAt !== undefined && days >= staleAt;
    return (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${stale ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>
        {days}d
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Operations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">What needs attention right now — click any item to open it</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Not floated */}
        <WorklistCard title="Not Floated to Suppliers" count={lists.notFloated.length} icon={FileText} tone="warning"
          empty="Every active RFQ has been floated." >
          {lists.notFloated.map(r => (
            <Row key={r.id} onClick={() => navigate(`/rfqs/${r.id}`)}
              left={<><span className="text-xs font-mono font-semibold text-primary">{r.rfq_number || 'RFQ'}</span><span className="text-xs text-muted-foreground truncate">{r.company_name}</span></>}
              right={<AgeBadge days={daysSince(r.rfq_date, today)} staleAt={3} />} />
          ))}
        </WorklistCard>

        {/* Awaiting supplier */}
        <WorklistCard title="Awaiting Supplier Response" count={lists.awaitingSupplier.length} icon={Send} tone="info"
          empty="No RFQs waiting on suppliers." >
          {lists.awaitingSupplier.map(r => (
            <Row key={r.id} onClick={() => navigate(`/rfqs/${r.id}`)}
              left={<><span className="text-xs font-mono font-semibold text-primary">{r.rfq_number || 'RFQ'}</span><span className="text-xs text-muted-foreground truncate">{r.company_name}</span></>}
              right={<AgeBadge days={daysSince(r.rfq_date, today)} staleAt={5} />} />
          ))}
        </WorklistCard>

        {/* Awaiting customer */}
        <WorklistCard title="Awaiting Customer Decision" count={lists.awaitingCustomer.length} icon={MessageSquare} tone="primary"
          empty="No quotes pending a customer decision." >
          {lists.awaitingCustomer.map(r => {
            const overdue = (r as any).quote_deadline && String((r as any).quote_deadline).slice(0, 10) < today;
            return (
              <Row key={r.id} onClick={() => navigate(`/rfqs/${r.id}`)}
                left={<><span className="text-xs font-mono font-semibold text-primary">{r.rfq_number || 'RFQ'}</span><span className="text-xs text-muted-foreground truncate">{r.company_name}</span>{overdue && <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-destructive/15 text-destructive">DEADLINE PASSED</span>}</>}
                right={<AgeBadge days={daysSince((r as any).quote_sent_date, today)} staleAt={7} />} />
            );
          })}
        </WorklistCard>

        {/* Orders in progress */}
        <WorklistCard title="Orders In Progress" count={lists.ordersInProgress.length} icon={ShoppingCart} tone="info"
          empty="No open orders in fulfillment." >
          {lists.ordersInProgress.map(({ o, age }) => (
            <Row key={o.id} onClick={() => navigate(`/orders/${o.id}`)}
              left={<><span className="text-xs font-medium text-foreground truncate">{getClientName(o.client_id)}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{orderStatusLabel[o.status]}</span></>}
              right={<AgeBadge days={age} staleAt={ORDER_STALE_DAYS} />} />
          ))}
        </WorklistCard>

        {/* Overdue payments */}
        <div className="xl:col-span-2">
          <WorklistCard title="Overdue Payments" count={lists.overduePayments.length} icon={AlertTriangle} tone="destructive"
            empty="No overdue payments." >
            {lists.overduePayments.map(o => (
              <Row key={o.id} onClick={() => navigate(`/orders/${o.id}`)}
                left={<><span className="text-xs font-medium text-foreground truncate">{getClientName(o.client_id)}</span><span className="text-xs text-muted-foreground">{formatPKR(o.order_value)}</span></>}
                right={<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">{daysSince((o as any).payment_due_date, today)}d overdue</span>} />
            ))}
          </WorklistCard>
        </div>

      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
  primary: 'bg-primary/15 text-primary',
  destructive: 'bg-destructive/15 text-destructive',
};

function WorklistCard({ title, count, icon: Icon, tone, empty, children }: {
  title: string; count: number; icon: any; tone: string; empty: string; children: React.ReactNode;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${TONE[tone]}`}><Icon className="w-4 h-4" /></div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <span className={`text-sm font-extrabold px-2 py-0.5 rounded-lg ${count > 0 ? TONE[tone] : 'bg-muted text-muted-foreground'}`}>{count}</span>
      </div>
      {count === 0 ? (
        <p className="text-xs text-muted-foreground py-2">{empty}</p>
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto">{children}</div>
      )}
    </div>
  );
}

function Row({ left, right, onClick }: { left: React.ReactNode; right: React.ReactNode; onClick: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors">
      <div className="flex items-center gap-2 min-w-0">{left}</div>
      <div className="flex items-center gap-1.5 flex-shrink-0">{right}<ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /></div>
    </div>
  );
}
