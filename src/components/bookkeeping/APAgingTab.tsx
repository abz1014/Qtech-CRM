import { useMemo, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function APAgingTab() {
  const { getAPAgingBuckets, getVendorName } = useCRM();
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);

  const buckets = getAPAgingBuckets();
  const totalAP = useMemo(() => buckets.reduce((sum, b) => sum + b.total_amount, 0), [buckets]);

  return (
    <div className="space-y-6">
      <div className="glass-card p-4 border border-border">
        <p className="text-sm text-muted-foreground mb-1">Total Outstanding A/P</p>
        <p className="text-3xl font-bold text-orange-600">
          {new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 0,
          }).format(totalAP)}
        </p>
      </div>

      <div className="space-y-3">
        {buckets.map((bucket, idx) => {
          const isExpanded = expandedBucket === bucket.bucket;
          const percentage = totalAP > 0 ? ((bucket.total_amount / totalAP) * 100).toFixed(1) : '0.0';

          return (
            <div key={idx} className="glass-card border border-border overflow-hidden">
              <button
                onClick={() => setExpandedBucket(isExpanded ? null : bucket.bucket)}
                className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between flex-1 gap-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{bucket.bucket}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{bucket.count} payables</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">
                      {new Intl.NumberFormat('en-PK', {
                        style: 'currency',
                        currency: 'PKR',
                        minimumFractionDigits: 0,
                      }).format(bucket.total_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{percentage}% of total</p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground ml-4" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground ml-4" />
                )}
              </button>

              {isExpanded && bucket.invoices.length > 0 && (
                <div className="border-t border-border bg-muted/10 p-4 space-y-2">
                  {bucket.invoices.map((inv) => (
                    <div key={inv.invoice_id} className="p-3 bg-background rounded border border-border/50 text-sm">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-foreground">{inv.invoice_number}</span>
                        <span className="font-bold text-foreground">
                          {new Intl.NumberFormat('en-PK', {
                            style: 'currency',
                            currency: 'PKR',
                            minimumFractionDigits: 0,
                          }).format((inv.invoice_amount ?? 0) - (inv.amount_paid ?? 0))}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        {/* client_id holds vendor_id in the AP aging mock invoice object */}
                        {getVendorName(inv.client_id)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Due: {inv.due_date}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
