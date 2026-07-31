import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useOrders } from '@/hooks/useOrders';
import { useRFQs } from '@/hooks/useRFQs';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  CheckCircle, AlertCircle, Clock, Trash2, Bell,
  RotateCcw, AlarmClock, Users, ChevronDown, ChevronUp,
} from 'lucide-react';
import React from 'react';
import { FollowUpAction, User } from '@/types/crm';
import { cn } from '@/lib/utils';
import { businessToday } from '@/lib/dates';
import { FollowUpForm } from '@/components/followup/FollowUpForm';
import { OutcomeModal, OutcomeResult } from '@/components/followup/OutcomeModal';
import { SnoozePopover } from '@/components/followup/SnoozePopover';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTION_TYPE_LABELS: Record<string, string> = {
  rfq_followup:      '📋 RFQ Follow-up',
  supplier_response: '📬 Supplier Follow-up',
  overdue_invoice:   '💰 Invoice Follow-up',
  order_status:      '📦 Order Status',
  custom:            '✏️ Custom',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  rfq: 'RFQ', order: 'Order', client: 'Client', prospect: 'Prospect', vendor: 'Vendor',
};

const PRIORITY_STYLES: Record<string, string> = {
  high:   'border-red-500/50 bg-red-500/10 text-red-500',
  medium: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  low:    'border-blue-500/50 bg-blue-500/10 text-blue-500',
};

// Tailwind's build-time scanner can't see classes assembled from a runtime
// variable (`text-${accent}`), so it never generates them — the section
// headings rendered unstyled. This map keeps every class string static and
// literal so the scanner picks them up.
type SectionAccent = 'destructive' | 'warning' | 'muted-foreground';
const ACCENT_STYLES: Record<SectionAccent, { heading: string; badge: string }> = {
  destructive:        { heading: 'text-destructive',      badge: 'bg-destructive/15 text-destructive' },
  warning:             { heading: 'text-warning',          badge: 'bg-warning/15 text-warning' },
  'muted-foreground':  { heading: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground' },
};

function getDaysOverdue(due_date: string): number {
  // Compare in the business timezone (same date source as the tab filters)
  // so a card's "overdue" badge never disagrees with which tab it's in.
  const today = new Date(businessToday() + 'T00:00:00Z');
  const due   = new Date(due_date.slice(0, 10) + 'T00:00:00Z');
  return Math.floor((today.getTime() - due.getTime()) / 86400000);
}

/** Returns urgency tier: 0=upcoming, 1=due today, 2=overdue 1d, 3=overdue 3+d */
function getTier(due_date: string): 0 | 1 | 2 | 3 {
  const days = getDaysOverdue(due_date);
  if (days >= 3) return 3;
  if (days >= 1) return 2;
  if (days === 0) return 1;
  return 0;
}

const TIER_CARD: Record<number, string> = {
  0: 'border-l-primary/30',
  1: 'border-l-yellow-500',
  2: 'border-l-red-500',
  3: 'border-l-red-600 animate-pulse-border',
};

const TIER_BADGE: Record<number, { text: string; cls: string }> = {
  0: { text: '',           cls: '' },
  1: { text: 'Due today',  cls: 'bg-yellow-500/10 text-yellow-600' },
  2: { text: 'OVERDUE',    cls: 'bg-red-500/10 text-red-500 font-bold' },
  3: { text: 'URGENT',     cls: 'bg-red-600/20 text-red-600 font-bold ring-1 ring-red-600/40' },
};

function DueLabel({ due_date }: { due_date: string }) {
  const tier  = getTier(due_date);
  const days  = getDaysOverdue(due_date);
  const badge = TIER_BADGE[tier];

  const text =
    tier === 0 ? `${-days}d left` :
    tier === 1 ? 'Due today' :
    `${days}d overdue`;

  return (
    <div className={cn('flex items-center gap-1 px-2 py-1 rounded text-xs flex-shrink-0', badge.cls || 'bg-muted text-muted-foreground')}>
      <Clock className="w-3 h-3" />
      {text}
      {(tier === 2 || tier === 3) && (
        <span className="ml-1 text-[11px] font-bold tracking-wide">{badge.text}</span>
      )}
    </div>
  );
}

// ─── Action Card ──────────────────────────────────────────────────────────────

interface ActionCardProps {
  action: FollowUpAction;
  entityLabel?: string;
  entityPath?: string;
  assignedName?: string;
  onCompleteClick: (id: string, title: string) => void;
  onSnooze: (id: string, date: string) => void;
  onDelete: (id: string) => void;
  completing: string | null;
}

function ActionCard({ action, entityLabel, entityPath, assignedName, onCompleteClick, onSnooze, onDelete, completing }: ActionCardProps) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const navigate = useNavigate();
  const tier = getTier(action.due_date);

  return (
    <div className={cn('glass-card p-4 border-l-4 transition-all relative', TIER_CARD[tier])}>
      <div className="flex items-start gap-3">
        {/* Priority badge */}
        <div className={cn('mt-0.5 px-2 py-0.5 rounded text-xs font-semibold border flex-shrink-0 capitalize', PRIORITY_STYLES[action.priority])}>
          {action.priority}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{action.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {ACTION_TYPE_LABELS[action.action_type] || action.action_type}
                </span>
                {/* Entity reference — clickable link to the RFQ or Order */}
                {entityLabel && entityPath && (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(entityPath); }}
                    className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors"
                  >
                    → {ENTITY_TYPE_LABELS[action.entity_type] || action.entity_type}: {entityLabel}
                  </button>
                )}
                {/* Assigned sales person */}
                {assignedName && (
                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded flex items-center gap-1">
                    👤 {assignedName}
                  </span>
                )}
                {action.description === 'Auto-created by system' && (
                  <span className="text-xs text-muted-foreground italic">· Auto-created</span>
                )}
                {action.description && action.description !== 'Auto-created by system' &&
                  !action.description.startsWith('✅') &&
                  !action.description.startsWith('📵') &&
                  !action.description.startsWith('💬') && (
                  <span className="text-xs text-muted-foreground">· {action.description}</span>
                )}
              </div>
            </div>
            <DueLabel due_date={action.due_date} />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <button
              onClick={() => onCompleteClick(action.id, action.title)}
              disabled={completing === action.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-3 h-3" />
              {completing === action.id ? 'Completing...' : 'Complete'}
            </button>

            {/* Snooze */}
            <div className="relative">
              <button
                onClick={() => setSnoozeOpen(p => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 hover:text-foreground transition-colors"
              >
                <AlarmClock className="w-3 h-3" />
                Snooze
              </button>
              {snoozeOpen && (
                <SnoozePopover
                  onSnooze={(date) => { onSnooze(action.id, date); setSnoozeOpen(false); }}
                  onClose={() => setSnoozeOpen(false)}
                />
              )}
            </div>

            <button
              onClick={() => onDelete(action.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Team Overview Tab (admin only) ──────────────────────────────────────────

interface TeamOverviewProps {
  allActions: FollowUpAction[];
  users: User[];
  onCompleteClick: (id: string, title: string) => void;
  onSnooze: (id: string, date: string) => void;
  onDelete: (id: string) => void;
  completing: string | null;
}

function TeamOverview({ allActions, users, onCompleteClick, onSnooze, onDelete, completing }: TeamOverviewProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const byUser = useMemo(() => {
    const map: Record<string, FollowUpAction[]> = {};
    allActions.forEach(a => {
      const uid = a.assigned_to || 'unassigned';
      if (!map[uid]) map[uid] = [];
      map[uid].push(a);
    });
    return Object.entries(map).sort((a, b) => {
      // Sort: most overdue first
      const overdueA = a[1].filter(x => getDaysOverdue(x.due_date) > 0).length;
      const overdueB = b[1].filter(x => getDaysOverdue(x.due_date) > 0).length;
      return overdueB - overdueA;
    });
  }, [allActions]);

  const getName = (uid: string) => {
    if (uid === 'unassigned') return 'Unassigned';
    return users.find(u => u.id === uid)?.name || 'Unknown';
  };

  if (allActions.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="text-foreground font-semibold text-lg">All clear! 🎉</p>
        <p className="text-sm text-muted-foreground mt-1">No pending actions across the team.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {byUser.map(([uid, actions]) => {
        const overdueCount = actions.filter(a => getDaysOverdue(a.due_date) > 0).length;
        const todayCount   = actions.filter(a => getDaysOverdue(a.due_date) === 0).length;
        const isOpen = expanded === uid;

        return (
          <div key={uid} className={cn('glass-card border', overdueCount > 0 ? 'border-red-500/30' : 'border-border')}>
            {/* User header row */}
            <button
              onClick={() => setExpanded(isOpen ? null : uid)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                  {getName(uid).split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">{getName(uid)}</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{actions.length} open</span>
                    {overdueCount > 0 && (
                      <span className="text-xs text-red-500 font-semibold">{overdueCount} overdue</span>
                    )}
                    {todayCount > 0 && (
                      <span className="text-xs text-yellow-600">{todayCount} today</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Workload indicator */}
                <div className={cn('flex gap-0.5 items-end h-5')}>
                  {Array.from({ length: Math.min(actions.length, 10) }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-1.5 rounded-sm',
                        i < overdueCount
                          ? 'bg-red-500 h-5'
                          : i < overdueCount + todayCount
                          ? 'bg-yellow-500 h-3.5'
                          : 'bg-primary/40 h-2.5'
                      )}
                    />
                  ))}
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {/* Expanded action list */}
            {isOpen && (
              <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                {actions.map(action => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    onCompleteClick={onCompleteClick}
                    onSnooze={onSnooze}
                    onDelete={onDelete}
                    completing={completing}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ActionsPage() {
  const { followUpActions, getAllFollowUps, completeFollowUp, snoozeFollowUp, deleteFollowUp, users, getClientName } = useCRM();
  const { data: rfqs = [] } = useRFQs();
  const { data: orders = [] } = useOrders();
  const { user, isAdmin } = useAuth();
  const confirm = useConfirm();

  type Tab = 'all' | 'team';
  const [tab, setTab]         = useState<Tab>('all');
  const [allActions, setAllActions] = useState<FollowUpAction[]>([]);
  const [loading, setLoading] = useState(false);

  // Derive myActions from live CRMContext state — same source as sidebar badge
  // so counts are ALWAYS in sync. Filter: pending + (mine or unassigned)
  const myActions = useMemo(
    () => followUpActions.filter(a =>
      a.status === 'pending' &&
      (!a.assigned_to || a.assigned_to === user?.id)
    ),
    [followUpActions, user?.id]
  );
  const [showForm, setShowForm]         = useState(false);
  const [showNextForm, setShowNextForm] = useState(false);
  const [completing, setCompleting]     = useState<string | null>(null);
  const [outcomeAction, setOutcomeAction] = useState<{ id: string; title: string } | null>(null);

  // Only fetch the team view; myActions comes from live state
  const load = async () => {
    setLoading(true);
    const all = isAdmin ? await getAllFollowUps() : [];
    if (isAdmin) setAllActions(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const todayStr = businessToday();

  // Resolve a human-readable label + navigation path for an action's linked entity
  const resolveEntity = (action: FollowUpAction): { label: string; path: string } | null => {
    if (!action.entity_id || !action.entity_type) return null;
    if (action.entity_type === 'rfq') {
      const rfq = rfqs.find(r => r.id === action.entity_id);
      if (!rfq) return null;
      return { label: rfq.company_name, path: `/rfqs/${rfq.id}` };
    }
    if (action.entity_type === 'order') {
      const order = orders.find(o => o.id === action.entity_id);
      if (!order) return null;
      return { label: `${getClientName(order.client_id)} — ${order.product_type}`, path: `/orders/${order.id}` };
    }
    return null;
  };

  const handleCompleteClick = (id: string, title: string) => setOutcomeAction({ id, title });

  const handleOutcomeConfirm = async (outcome: OutcomeResult, note: string, createNext: boolean) => {
    if (!outcomeAction) return;
    setCompleting(outcomeAction.id);
    const label = { reached: '✅ Reached them', no_answer: '📵 No answer', left_message: '💬 Left message', not_required: '' }[outcome];
    const fullNote = [label, note].filter(Boolean).join(' — ');
    await completeFollowUp(outcomeAction.id, fullNote || undefined);
    setAllActions(prev => prev.filter(a => a.id !== outcomeAction.id));
    setCompleting(null);
    setOutcomeAction(null);
    if (createNext) setShowNextForm(true);
  };

  const handleSnooze = async (id: string, date: string) => {
    await snoozeFollowUp(id, date);
    // Remove from current view — will resurface on the new date
    setAllActions(prev => prev.filter(a => a.id !== id));
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({ title: 'Delete action?', message: 'Delete this follow-up action?', confirmLabel: 'Delete' }))) return;
    await deleteFollowUp(id);
    setAllActions(prev => prev.filter(a => a.id !== id));
  };

  const overdue  = myActions.filter(a => a.due_date < todayStr);
  const dueToday = myActions.filter(a => a.due_date === todayStr);
  const upcoming = myActions.filter(a => a.due_date > todayStr);

  const renderSection = (
    actions: FollowUpAction[],
    title: string,
    accent: SectionAccent,
    icon: React.ReactNode,
  ) => {
    if (actions.length === 0) return null;
    const styles = ACCENT_STYLES[accent];
    return (
      <div className="space-y-2">
        <div className={`flex items-center gap-2 px-1`}>
          {icon}
          <h3 className={cn('text-sm font-bold uppercase tracking-widest', styles.heading)}>
            {title}
          </h3>
          <span className={cn('ml-auto text-xs font-bold px-2 py-0.5 rounded-full', styles.badge)}>
            {actions.length}
          </span>
        </div>
        {actions.map(action => {
          const entity = resolveEntity(action);
          const assignedUser = users.find((u) => u.id === action.assigned_to);
          return (
            <ActionCard
              key={action.id}
              action={action}
              entityLabel={entity?.label}
              entityPath={entity?.path}
              assignedName={assignedUser?.name}
              onCompleteClick={handleCompleteClick}
              onSnooze={handleSnooze}
              onDelete={handleDelete}
              completing={completing}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-muted-foreground text-sm">
            {myActions.length === 0 ? 'All clear — nothing pending' :
             `${overdue.length > 0 ? `${overdue.length} overdue · ` : ''}${dueToday.length} today · ${upcoming.length} upcoming`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setTab(tab === 'team' ? 'all' : 'team')}
              className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                tab === 'team' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
            >
              <Users className="w-4 h-4" /> Team
            </button>
          )}
          <button onClick={load} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Refresh">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
          >
            <Bell className="w-4 h-4" /> New Action
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-8 text-center text-muted-foreground">Loading actions...</div>
      ) : tab === 'team' && isAdmin ? (
        <TeamOverview
          allActions={allActions}
          users={users}
          onCompleteClick={handleCompleteClick}
          onSnooze={handleSnooze}
          onDelete={handleDelete}
          completing={completing}
        />
      ) : myActions.length === 0 ? (
        <div className="glass-card p-16 text-center space-y-3">
          <CheckCircle className="w-14 h-14 text-success mx-auto" />
          <p className="text-xl font-bold text-foreground">All clear! 🎉</p>
          <p className="text-sm text-muted-foreground">No pending actions. Create one or check back later.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {renderSection(overdue, 'Overdue', 'destructive',
            <AlertCircle className="w-4 h-4 text-destructive" />)}
          {renderSection(dueToday, 'Due Today', 'warning',
            <Clock className="w-4 h-4 text-warning" />)}
          {renderSection(upcoming, 'Upcoming', 'muted-foreground',
            <CheckCircle className="w-4 h-4 text-muted-foreground" />)}
        </div>
      )}

      {showForm && (
        <FollowUpForm onClose={async () => { setShowForm(false); await load(); }} />
      )}
      {showNextForm && (
        <FollowUpForm onClose={async () => { setShowNextForm(false); await load(); }} />
      )}
      {outcomeAction && (
        <OutcomeModal
          actionTitle={outcomeAction.title}
          onConfirm={handleOutcomeConfirm}
          onCancel={() => setOutcomeAction(null)}
        />
      )}
    </div>
  );
}
