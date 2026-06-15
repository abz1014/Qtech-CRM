import { LossReason } from '@/types/crm';

/** Shared loss-reason metadata used by the modal, RFQ list, and lost-RFQ analytics */
export const LOSS_REASONS: { value: LossReason; label: string; icon: string }[] = [
  { value: 'price_too_high',          label: 'Price too high',                 icon: '💰' },
  { value: 'delivery_too_slow',       label: 'Delivery time too slow',         icon: '⏱️' },
  { value: 'competitor_won',          label: 'Competitor won the deal',        icon: '🏆' },
  { value: 'client_budget_cut',       label: 'Client budget cut / cancelled',  icon: '❌' },
  { value: 'specs_changed',           label: 'Client specs changed',           icon: '📋' },
  { value: 'went_direct_to_supplier', label: 'Client went direct to supplier', icon: '🔄' },
  { value: 'poor_follow_up',          label: 'Poor follow-up on our end',      icon: '📞' },
  { value: 'other',                   label: 'Other reason',                   icon: '✏️' },
];

const LABEL_MAP: Record<string, { label: string; icon: string }> = Object.fromEntries(
  LOSS_REASONS.map(r => [r.value, { label: r.label, icon: r.icon }])
);

export function lossReasonLabel(reason: string | null | undefined): string {
  if (!reason) return 'Not specified';
  return LABEL_MAP[reason]?.label ?? reason.replace(/_/g, ' ');
}

export function lossReasonIcon(reason: string | null | undefined): string {
  if (!reason) return '❓';
  return LABEL_MAP[reason]?.icon ?? '✏️';
}
