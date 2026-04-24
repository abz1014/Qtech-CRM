import { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Star, TrendingDown, Clock, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SupplierComparisonTableProps {
  rfqId: string;
  onRecommendationChange?: () => void;
}

export function SupplierComparisonTable({ rfqId, onRecommendationChange }: SupplierComparisonTableProps) {
  const { getQuotesForRFQ, calculateValueScore, updateQuoteRecommendation } = useCRM();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'price' | 'leadtime' | 'moq' | 'score'>('price');

  useEffect(() => {
    loadQuotes();
  }, [rfqId]);

  const loadQuotes = async () => {
    setIsLoading(true);
    const data = await getQuotesForRFQ(rfqId);

    // Calculate value scores
    const quotesWithScores = data.map(q => ({
      ...q,
      valueScore: calculateValueScore(q.unit_price, q.lead_time_days, q.moq)
    }));

    setQuotes(quotesWithScores);
    setIsLoading(false);
  };

  const handleRecommend = async (quoteId: string, isRecommended: boolean) => {
    await updateQuoteRecommendation(quoteId, !isRecommended);
    await loadQuotes();
    onRecommendationChange?.();
  };

  const sortedQuotes = [...quotes].sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return a.unit_price - b.unit_price;
      case 'leadtime':
        return a.lead_time_days - b.lead_time_days;
      case 'moq':
        return a.moq - b.moq;
      case 'score':
        return b.valueScore - a.valueScore;
      default:
        return 0;
    }
  });

  if (isLoading) {
    return <div className="glass-card p-6 text-center text-muted-foreground">Loading quotes...</div>;
  }

  if (quotes.length === 0) {
    return <div className="glass-card p-6 text-center text-muted-foreground">No quotes yet for this RFQ</div>;
  }

  const minPrice = Math.min(...quotes.map(q => q.unit_price));
  const maxLeadTime = Math.max(...quotes.map(q => q.lead_time_days));

  return (
    <div className="space-y-4">
      {/* Sort Controls */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSortBy('price')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            sortBy === 'price'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          <TrendingDown className="w-4 h-4 inline mr-1" />
          Lowest Price
        </button>
        <button
          onClick={() => setSortBy('leadtime')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            sortBy === 'leadtime'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          <Clock className="w-4 h-4 inline mr-1" />
          Fastest
        </button>
        <button
          onClick={() => setSortBy('score')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            sortBy === 'score'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          <Star className="w-4 h-4 inline mr-1" />
          Best Value
        </button>
      </div>

      {/* Comparison Table */}
      <div className="glass-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Vendor</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Unit Price (PKR)</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Lead Time (Days)</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">MOQ</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Value Score</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Recommend</th>
            </tr>
          </thead>
          <tbody>
            {sortedQuotes.map((quote) => {
              const isPriceLeader = quote.unit_price === minPrice;
              const isLeadTimeLeader = quote.lead_time_days === Math.min(...quotes.map(q => q.lead_time_days));
              const topScore = Math.max(...quotes.map(q => q.valueScore));
              const isValueLeader = quote.valueScore === topScore;

              return (
                <tr key={quote.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">
                    {quote.vendors?.name || 'Unknown Vendor'}
                  </td>

                  {/* Unit Price */}
                  <td className={cn(
                    'px-4 py-3 text-sm font-semibold',
                    isPriceLeader ? 'text-green-600 bg-green-50/20 dark:bg-green-900/10' : 'text-foreground'
                  )}>
                    Rs {quote.unit_price.toLocaleString('en-PK')}
                    {isPriceLeader && <span className="text-xs ml-2">💰 Best</span>}
                  </td>

                  {/* Lead Time */}
                  <td className={cn(
                    'px-4 py-3 text-sm font-semibold',
                    isLeadTimeLeader ? 'text-blue-600 bg-blue-50/20 dark:bg-blue-900/10' : 'text-foreground'
                  )}>
                    {quote.lead_time_days} days
                    {isLeadTimeLeader && <span className="text-xs ml-2">⚡ Fastest</span>}
                  </td>

                  {/* MOQ */}
                  <td className="px-4 py-3 text-sm text-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      {quote.moq} units
                    </span>
                  </td>

                  {/* Value Score */}
                  <td className={cn(
                    'px-4 py-3 text-sm font-bold rounded px-2 py-1',
                    isValueLeader
                      ? 'text-white bg-gradient-to-r from-amber-500 to-yellow-500'
                      : 'text-foreground bg-muted/30'
                  )}>
                    {quote.valueScore.toFixed(1)} / 100
                    {isValueLeader && <span className="text-xs ml-2">⭐ Top</span>}
                  </td>

                  {/* Recommend Button */}
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleRecommend(quote.id, quote.is_recommended)}
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all',
                        quote.is_recommended
                          ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      <Star className={cn('w-4 h-4', quote.is_recommended && 'fill-white')} />
                      {quote.is_recommended ? 'Selected' : 'Select'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Recommendation Card */}
      {quotes.some(q => q.is_recommended) && (
        <div className="glass-card p-4 border-2 border-yellow-500/30 bg-yellow-50/10 dark:bg-yellow-900/10">
          <div className="flex items-start gap-3">
            <Star className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground">Recommended Vendor</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {quotes.find(q => q.is_recommended)?.vendors?.name} selected for this RFQ
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
