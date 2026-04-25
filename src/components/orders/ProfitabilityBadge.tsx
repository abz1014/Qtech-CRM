import { TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
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

  const getMarginStatus = (margin: number) => {
    if (margin >= 30) return { label: 'Excellent margin - Strong profitability', color: 'border-success/30 bg-success/5 text-success', icon: CheckCircle2 };
    if (margin >= 20) return { label: 'Good margin - Healthy profitability', color: 'border-primary/30 bg-primary/5 text-primary', icon: TrendingUp };
    if (margin >= 10) return { label: 'Moderate margin - Acceptable profitability', color: 'border-warning/30 bg-warning/5 text-warning', icon: AlertCircle };
    return { label: 'Low margin - Review profitability', color: 'border-destructive/30 bg-destructive/5 text-destructive', icon: AlertCircle };
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-3'
  };

  const status = getMarginStatus(margin);
  const StatusIcon = status.icon;

  return (
    <div className={cn(
      'space-y-3',
      size === 'lg' && 'space-y-4'
    )}>
      {/* Profit Display */}
      <div className={cn(
        'rounded-lg border font-semibold flex items-center justify-between',
        profit < 0
          ? 'border-destructive/30 bg-destructive/5 text-destructive'
          : 'border-success/30 bg-success/5 text-success',
        sizeClasses[size],
        size === 'lg' && 'px-5 py-4 text-lg'
      )}>
        <span className="flex items-center gap-2">
          🔥
          Profit
        </span>
        <span className={cn('font-bold', size === 'lg' && 'text-xl')}>
          Rs {Math.abs(profit).toLocaleString('en-PK')}
        </span>
      </div>

      {/* Margin Badge */}
      <div className={cn(
        'rounded-lg border font-semibold flex items-center justify-between',
        status.color,
        sizeClasses[size],
        size === 'lg' && 'px-5 py-4 text-lg'
      )}>
        <span className="flex items-center gap-2">
          <StatusIcon className={cn('w-4 h-4', size === 'sm' && 'w-3 h-3', size === 'lg' && 'w-5 h-5')} />
          Margin
        </span>
        <span className={cn(
          'font-bold',
          size === 'lg' && 'text-2xl'
        )}>
          {margin.toFixed(1)}%
        </span>
      </div>

      {/* Status Message */}
      <div className={cn(
        'rounded-lg border flex items-center gap-2 p-3',
        status.color,
        'text-sm'
      )}>
        <StatusIcon className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">{status.label}</span>
      </div>
    </div>
  );
}
