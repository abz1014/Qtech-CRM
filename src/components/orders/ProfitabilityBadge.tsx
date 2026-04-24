import { AlertCircle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfitabilityBadgeProps {
  profit: number;
  margin: number;
  orderValue: number;
  size?: 'sm' | 'md' | 'lg';
}

export function ProfitabilityBadge({
  profit,
  margin,
  orderValue,
  size = 'md'
}: ProfitabilityBadgeProps) {

  const getMarginColor = (margin: number) => {
    if (margin >= 20) return 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (margin >= 10) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  };

  const getMarginIcon = (margin: number) => {
    if (margin < 10) return <AlertCircle className={cn('w-4 h-4', size === 'sm' && 'w-3 h-3')} />;
    return <TrendingUp className={cn('w-4 h-4', size === 'sm' && 'w-3 h-3')} />;
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-3'
  };

  return (
    <div className={cn(
      'space-y-3',
      size === 'lg' && 'space-y-4'
    )}>
      {/* Profit Display */}
      <div className={cn(
        'rounded-lg border font-semibold flex items-center justify-between',
        profit < 0 ? 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
        sizeClasses[size],
        size === 'lg' && 'px-5 py-4 text-lg'
      )}>
        <span className="flex items-center gap-2">
          {profit < 0 ? '📉' : '💰'}
          Profit
        </span>
        <span className="text-xl font-bold">Rs {Math.abs(profit).toLocaleString('en-PK')}</span>
      </div>

      {/* Margin Badge */}
      <div className={cn(
        'rounded-lg border font-semibold flex items-center justify-between',
        getMarginColor(margin),
        sizeClasses[size],
        size === 'lg' && 'px-5 py-4 text-lg'
      )}>
        <span className="flex items-center gap-2">
          {getMarginIcon(margin)}
          Margin
          {margin < 10 && <span className="ml-1">⚠️</span>}
        </span>
        <span className={cn(
          'font-bold',
          size === 'lg' && 'text-2xl'
        )}>
          {margin.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
