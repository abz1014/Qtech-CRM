import React, { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Pagination } from '@/components/Pagination';
import { BarChart3, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { RFQ, RFQLineItem } from '@/types/crm';

interface MetricsCard {
  label: string;
  value: number | string;
  color: string;
}

export function DailyRFQReportPage() {
  const { rfqs, rfqLineItems, supplierInquiries, supplierQuotes, getRFQMetricsByDateRange, getClientName, getVendorName } = useCRM();
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [expandedRFQs, setExpandedRFQs] = useState<string[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPageNotFloated, setCurrentPageNotFloated] = useState(1);
  const [currentPageFloated, setCurrentPageFloated] = useState(1);
  const [currentPageResponded, setCurrentPageResponded] = useState(1);
  const [currentPageConverted, setCurrentPageConverted] = useState(1);

  const metrics = useMemo(() => {
    return getRFQMetricsByDateRange(startDate, endDate);
  }, [startDate, endDate, getRFQMetricsByDateRange]);

  const rfqsInRange = useMemo(() => {
    return rfqs.filter(r => {
      const rDate = r.rfq_date;
      return rDate >= startDate && rDate <= endDate;
    });
  }, [rfqs, startDate, endDate]);

  // Count total supplier inquiries (not just unique RFQs)
  const totalInquiries = useMemo(() => {
    return rfqsInRange.reduce((count, rfq) => {
      return count + supplierInquiries.filter(si => si.rfq_id === rfq.id).length;
    }, 0);
  }, [rfqsInRange, supplierInquiries]);

  const rfqsByCategory = useMemo(() => {
    const notFloatedList = rfqsInRange.filter(r => !supplierInquiries.some(si => si.rfq_id === r.id) && r.status !== 'converted');
    const floatedList = rfqsInRange.filter(r => supplierInquiries.some(si => si.rfq_id === r.id) && r.status !== 'converted');
    const respondedList = rfqsInRange.filter(r => supplierQuotes.some(sq => sq.rfq_id === r.id) && r.status !== 'converted');
    const convertedList = rfqsInRange.filter(r => r.status === 'converted');

    const paginatedNotFloated = notFloatedList.slice((currentPageNotFloated - 1) * itemsPerPage, currentPageNotFloated * itemsPerPage);
    const paginatedFloated = floatedList.slice((currentPageFloated - 1) * itemsPerPage, currentPageFloated * itemsPerPage);
    const paginatedResponded = respondedList.slice((currentPageResponded - 1) * itemsPerPage, currentPageResponded * itemsPerPage);
    const paginatedConverted = convertedList.slice((currentPageConverted - 1) * itemsPerPage, currentPageConverted * itemsPerPage);

    return {
      notFloatedList, floatedList, respondedList, convertedList,
      paginatedNotFloated, paginatedFloated, paginatedResponded, paginatedConverted
    };
  }, [rfqsInRange, supplierInquiries, supplierQuotes, itemsPerPage, currentPageNotFloated, currentPageFloated, currentPageResponded, currentPageConverted]);

  const toggleRFQExpand = (rfqId: string) => {
    setExpandedRFQs(prev =>
      prev.includes(rfqId) ? prev.filter(id => id !== rfqId) : [...prev, rfqId]
    );
  };

  const getSupplierInquiriesForRFQ = (rfqId: string) => {
    return supplierInquiries.filter(si => si.rfq_id === rfqId);
  };

  const getQuotesForRFQ = (rfqId: string) => {
    return supplierQuotes.filter(sq => sq.rfq_id === rfqId);
  };

  const cards: MetricsCard[] = [
    { label: 'Total RFQs Received', value: metrics.total, color: 'text-primary' },
    { label: 'Not Yet Floated', value: metrics.notFloated, color: 'text-warning' },
    { label: 'Unique RFQs Floated', value: metrics.floated, color: 'text-info' },
    { label: 'Total Supplier Contacts', value: totalInquiries, color: 'text-info' },
    { label: 'Received Responses', value: metrics.responded, color: 'text-success' },
  ];

  const RFQDetailRow = ({ rfq }: { rfq: RFQ }) => {
    const isExpanded = expandedRFQs.includes(rfq.id);
    const inquiries = getSupplierInquiriesForRFQ(rfq.id);
    const quotes = getQuotesForRFQ(rfq.id);
    const lineItems: RFQLineItem[] = rfqLineItems.filter(li => li.rfq_id === rfq.id);

    return (
      <div key={rfq.id} className="bg-background border border-border rounded-md overflow-hidden">
        <button
          onClick={() => toggleRFQExpand(rfq.id)}
          className="w-full p-3 hover:bg-background/80 transition-colors flex items-center justify-between"
        >
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">RFQ #{rfq.id.slice(0, 8)}</p>
              <span className="text-xs px-2 py-1 bg-primary/15 text-primary rounded">
                {rfq.priority}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Client: {getClientName(rfq.client_id)}</p>
            <p className="text-xs text-muted-foreground">Date: {rfq.rfq_date}</p>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {isExpanded && (
          <div className="border-t border-border p-3 bg-background/50 space-y-3">
            {/* RFQ Details */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">RFQ Details:</p>
              <div className="space-y-1 text-xs">
                <p><span className="text-muted-foreground">Status:</span> <span className="text-foreground capitalize">{rfq.status}</span></p>
                <p><span className="text-muted-foreground">Notes:</span> <span className="text-foreground">{rfq.notes || 'N/A'}</span></p>
              </div>
            </div>

            {/* Line Items */}
            {lineItems.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Line Items:</p>
                <div className="space-y-1 text-xs">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="bg-background border border-border rounded p-2">
                      <p className="text-foreground font-medium">{item.product_type}</p>
                      <p className="text-muted-foreground">Qty: {item.quantity} | Specs: {item.specification || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Supplier Inquiries */}
            {inquiries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Suppliers Contacted ({inquiries.length}):</p>
                <div className="space-y-2">
                  {inquiries.map((inquiry) => {
                    const quote = quotes.find(q => q.inquiry_id === inquiry.id);
                    return (
                      <div key={inquiry.id} className="bg-background border border-border rounded p-2 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-foreground">{getVendorName(inquiry.vendor_id)}</p>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            inquiry.status === 'pending' ? 'bg-warning/15 text-warning' :
                            inquiry.status === 'responded' ? 'bg-success/15 text-success' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {inquiry.status}
                          </span>
                        </div>
                        <p className="text-muted-foreground">Sent: {inquiry.sent_at}</p>

                        {quote && (
                          <div className="bg-background border border-border rounded p-2 mt-2 space-y-0.5">
                            <p className="text-foreground font-medium">Quote Details:</p>
                            <p className="text-muted-foreground">Unit Price: {quote.unit_price || 'N/A'}</p>
                            <p className="text-muted-foreground">Lead Time: {quote.lead_time_days || 'N/A'} days</p>
                            <p className="text-muted-foreground">MOQ: {quote.moq || 'N/A'}</p>
                            <p className="text-muted-foreground">Validity: {quote.validity_days || 'N/A'} days</p>
                            {quote.notes && <p className="text-muted-foreground">Notes: {quote.notes}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Daily RFQ Report</h1>
        <p className="text-muted-foreground mt-1">Comprehensive overview of RFQ status and metrics</p>
      </div>

      {/* Date Range Filter */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Date Range</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => {
              setStartDate(today);
              setEndDate(today);
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map((card) => (
            <div key={card.label} className="glass-card p-5">
              <p className="text-xs text-muted-foreground mb-2">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Not Yet Floated */}
      {rfqsByCategory.notFloatedList.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Not Yet Floated ({rfqsByCategory.notFloatedList.length})</h2>
          <div className="space-y-2">
            {rfqsByCategory.paginatedNotFloated.map((rfq) => (
              <RFQDetailRow key={rfq.id} rfq={rfq} />
            ))}
          </div>
          <Pagination
            currentPage={currentPageNotFloated}
            totalItems={rfqsByCategory.notFloatedList.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPageNotFloated}
            onItemsPerPageChange={(items) => {
              setItemsPerPage(items);
              setCurrentPageNotFloated(1);
            }}
          />
        </div>
      )}

      {/* Floated to Suppliers */}
      {rfqsByCategory.floatedList.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Floated to Suppliers ({rfqsByCategory.floatedList.length} RFQs)</h2>
          <div className="space-y-2">
            {rfqsByCategory.paginatedFloated.map((rfq) => (
              <RFQDetailRow key={rfq.id} rfq={rfq} />
            ))}
          </div>
          <Pagination
            currentPage={currentPageFloated}
            totalItems={rfqsByCategory.floatedList.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPageFloated}
            onItemsPerPageChange={(items) => {
              setItemsPerPage(items);
              setCurrentPageFloated(1);
            }}
          />
        </div>
      )}

      {/* Received Responses */}
      {rfqsByCategory.respondedList.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Received Responses ({rfqsByCategory.respondedList.length} RFQs)</h2>
          <div className="space-y-2">
            {rfqsByCategory.paginatedResponded.map((rfq) => (
              <RFQDetailRow key={rfq.id} rfq={rfq} />
            ))}
          </div>
          <Pagination
            currentPage={currentPageResponded}
            totalItems={rfqsByCategory.respondedList.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPageResponded}
            onItemsPerPageChange={(items) => {
              setItemsPerPage(items);
              setCurrentPageResponded(1);
            }}
          />
        </div>
      )}

      {/* Converted RFQs */}
      {rfqsByCategory.convertedList.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Converted to Orders ({rfqsByCategory.convertedList.length})</h2>
          <div className="space-y-2">
            {rfqsByCategory.paginatedConverted.map((rfq) => (
              <RFQDetailRow key={rfq.id} rfq={rfq} />
            ))}
          </div>
          <Pagination
            currentPage={currentPageConverted}
            totalItems={rfqsByCategory.convertedList.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPageConverted}
            onItemsPerPageChange={(items) => {
              setItemsPerPage(items);
              setCurrentPageConverted(1);
            }}
          />
        </div>
      )}

      {/* Statistics */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Statistics</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total RFQs</p>
            <p className="text-xl font-bold text-primary">{metrics.total}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Not Floated</p>
            <p className="text-xl font-bold text-warning">{metrics.notFloated}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Floated (Unique)</p>
            <p className="text-xl font-bold text-info">{metrics.floated}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Responses</p>
            <p className="text-xl font-bold text-success">{metrics.responded}</p>
          </div>
          {metrics.total > 0 && (
            <>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Floated Rate</p>
                <p className="text-lg font-bold text-info">{((metrics.floated / metrics.total) * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Response Rate</p>
                <p className="text-lg font-bold text-success">{((metrics.responded / metrics.floated) * 100 || 0).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Inquiries</p>
                <p className="text-lg font-bold text-info">{totalInquiries}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Conversion Rate</p>
                <p className="text-lg font-bold text-success">{((rfqsByCategory.convertedList.length / metrics.total) * 100 || 0).toFixed(1)}%</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
