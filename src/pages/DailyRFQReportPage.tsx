import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { BarChart3, Calendar, Download, Filter, ChevronRight } from 'lucide-react';
import { formatDate, formatPKR } from '@/lib/format';

interface FilterState {
  status: string;
  priority: string;
  client: string;
  dateRange: 'today' | 'week' | 'month' | 'custom';
}

export function DailyRFQReportPage() {
  const navigate = useNavigate();
  const { rfqs, supplierInquiries, supplierQuotes, orders, getClientName, getUserName } = useCRM();
  const today = new Date().toISOString().split('T')[0];

  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    priority: 'all',
    client: 'all',
    dateRange: 'today'
  });
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Get filtered RFQs
  const filteredRFQs = useMemo(() => {
    let result = rfqs;

    // Date range filter
    if (filters.dateRange === 'today') {
      result = result.filter(r => r.rfq_date === today);
    } else if (filters.dateRange === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];
      result = result.filter(r => r.rfq_date >= weekAgoStr && r.rfq_date <= today);
    } else if (filters.dateRange === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      const monthAgoStr = monthAgo.toISOString().split('T')[0];
      result = result.filter(r => r.rfq_date >= monthAgoStr && r.rfq_date <= today);
    } else if (filters.dateRange === 'custom') {
      result = result.filter(r => r.rfq_date >= startDate && r.rfq_date <= endDate);
    }

    // Status filter
    if (filters.status !== 'all') {
      if (filters.status === 'not_floated') {
        result = result.filter(r => !supplierInquiries.some(si => si.rfq_id === r.id) && r.status !== 'converted');
      } else if (filters.status === 'floated') {
        result = result.filter(r => supplierInquiries.some(si => si.rfq_id === r.id) && r.status !== 'converted');
      } else if (filters.status === 'responded') {
        result = result.filter(r => supplierQuotes.some(sq => sq.rfq_id === r.id));
      } else if (filters.status === 'converted') {
        result = result.filter(r => r.status === 'converted');
      }
    }

    // Priority filter
    if (filters.priority !== 'all') {
      result = result.filter(r => r.priority === filters.priority);
    }

    // Client filter
    if (filters.client !== 'all') {
      result = result.filter(r => r.client_id === filters.client);
    }

    return result;
  }, [rfqs, filters, startDate, endDate, today, supplierInquiries, supplierQuotes]);

  // Get unique clients for filter dropdown
  const uniqueClients = useMemo(() => {
    return Array.from(new Set(rfqs.map(r => r.client_id)))
      .map(id => ({ id, name: getClientName(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rfqs, getClientName]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const notFloated = filteredRFQs.filter(r => !supplierInquiries.some(si => si.rfq_id === r.id) && r.status !== 'converted');
    const floated = filteredRFQs.filter(r => supplierInquiries.some(si => si.rfq_id === r.id) && r.status !== 'converted');
    const responded = filteredRFQs.filter(r => supplierQuotes.some(sq => sq.rfq_id === r.id) && r.status !== 'converted');
    const converted = filteredRFQs.filter(r => r.status === 'converted');

    return { notFloated, floated, responded, converted };
  }, [filteredRFQs, supplierInquiries, supplierQuotes]);

  // Sanitize cell values to prevent CSV formula injection
  const sanitizeCSVCell = (cell: any): string => {
    const str = String(cell ?? '');
    // Escape cells that start with =, +, @, or - (formula injection risk)
    if (str.match(/^[=+@\-]/)) {
      return `'${str}`;
    }
    return str;
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    if (format === 'csv') {
      const headers = [
        'RFQ Date', 'Client', 'Contact Person', 'Phone', 'Email',
        'Status', 'Priority', 'Assigned To',
        'Inquiries Sent', 'Quotes Received',
        'Quoted Price (PKR)', 'Quote Sent Date', 'Quote Expiry Date',
        'Loss Reason', 'Loss Notes', 'Notes',
      ];
      const rows = filteredRFQs.map(rfq => [
        rfq.rfq_date,
        getClientName(rfq.client_id),
        rfq.contact_person,
        rfq.phone,
        rfq.email,
        rfq.status.replace(/_/g, ' ').toUpperCase(),
        rfq.priority.toUpperCase(),
        getUserName(rfq.assigned_to),
        supplierInquiries.filter(si => si.rfq_id === rfq.id).length,
        supplierQuotes.filter(sq => sq.rfq_id === rfq.id).length,
        (rfq as any).quoted_price ?? '',
        (rfq as any).quote_sent_date ?? '',
        (rfq as any).quote_expiry_date ?? '',
        (rfq as any).loss_reason?.replace(/_/g, ' ') ?? '',
        (rfq as any).loss_notes ?? '',
        rfq.notes || '',
      ]);

      // Sanitize all cells to prevent formula injection
      const sanitizedRows = rows.map(row =>
        row.map(cell => sanitizeCSVCell(cell))
      );

      const csv = [headers, ...sanitizedRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
      element.setAttribute('download', `rfq-report-${today}.csv`);
      element.click();
    } else if (format === 'pdf') {
      alert('PDF export coming soon!');
    }
  };

  const RFQTable = ({ rfqs, title, isConverted }: { rfqs: any[]; title: string; isConverted?: boolean }) => (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium">{rfqs.length}</span>
      </div>

      {rfqs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No RFQs in this category</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">RFQ ID</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Client</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Priority</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Date</th>
                <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Est. Value</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Inquiries</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Responses</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {rfqs.map(rfq => {
                const relatedOrder = orders.find(o => o.rfq_id === rfq.id);
                return (
                  <tr
                    key={rfq.id}
                    onClick={() => {
                      if (isConverted && relatedOrder) {
                        navigate(`/orders/${relatedOrder.id}`);
                      } else {
                        navigate(`/rfqs/${rfq.id}`);
                      }
                    }}
                    className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-medium text-foreground">RFQ #{rfq.id.slice(0, 8)}</td>
                    <td className="py-3 px-4 text-foreground">{getClientName(rfq.client_id)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        rfq.priority === 'high' ? 'bg-destructive/20 text-destructive' :
                        rfq.priority === 'medium' ? 'bg-warning/20 text-warning' :
                        'bg-info/20 text-info'
                      }`}>
                        {rfq.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{rfq.rfq_date}</td>
                    <td className="py-3 px-4 text-right font-semibold text-foreground">{formatPKR(rfq.estimated_value)}</td>
                    <td className="py-3 px-4 text-center font-medium text-foreground">
                      {supplierInquiries.filter(si => si.rfq_id === rfq.id).length}
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-success">
                      {supplierQuotes.filter(sq => sq.rfq_id === rfq.id).length}
                    </td>
                    <td className="py-3 px-4 text-center text-muted-foreground">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-8 h-8" />
          Daily RFQ Report
        </h1>
        <p className="text-muted-foreground mt-1">Track RFQ status and progression through the sales pipeline</p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Total RFQs</p>
          <p className="text-3xl font-bold text-primary mt-2">{filteredRFQs.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Not Floated</p>
          <p className="text-3xl font-bold text-warning mt-2">{metrics.notFloated.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Floated</p>
          <p className="text-3xl font-bold text-info mt-2">{metrics.floated.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Responses</p>
          <p className="text-3xl font-bold text-success mt-2">{metrics.responded.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filters
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters(f => ({ ...f, dateRange: e.target.value as any }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {filters.dateRange === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Client</label>
            <select
              value={filters.client}
              onChange={(e) => setFilters(f => ({ ...f, client: e.target.value }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Clients</option>
              {uniqueClients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2 pt-4 border-t border-border">
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-success text-success-foreground rounded-lg text-sm font-medium hover:bg-success/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export PDF (Coming Soon)
          </button>
        </div>
      </div>

      {/* RFQ Tables by Status */}
      <div className="space-y-6">
        <RFQTable rfqs={metrics.converted} title="✅ Converted to Orders" isConverted={true} />
        <RFQTable rfqs={metrics.responded} title="🟢 Responses Received" />
        <RFQTable rfqs={metrics.floated} title="🟡 Floated - Awaiting Response" />
        <RFQTable rfqs={metrics.notFloated} title="🔴 Not Yet Floated to Suppliers" />
      </div>
    </div>
  );
}

export default DailyRFQReportPage;
