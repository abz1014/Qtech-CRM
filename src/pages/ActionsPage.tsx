import { useEffect, useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  CheckCircle, AlertCircle, Clock, Trash2, Bell,
  RotateCcw, AlarmClock, Users, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

function getDaysOverdue(due_date: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(due_date); due.setHours(0, 0, 0, 0);
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
        <span className="ml-1 text-[10px] font-bold tracking-wide">{badge.text}</span>
      )}
    </div>
  );
}

// ─── Action Card ──────────────────────────────────────────────────────────────

interface ActionCardProps {
  action: any;
  onCompleteClick: (id: string, title: string) => void;
  onSnooze: (id: string, date: string) => void;
  onDelete: (id: string) => void;
  completing: string | null;
}

function ActionCard({ action, onCompleteClick, onSnooze, onDelete, completing }: ActionCardProps) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
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
              <p className="font-semibold text-foreground truncate">{action.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {ACTION_TYPE_LABELS[action.action_type] || action.action_type}
                </span>
                {action.entity_type && (
                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                    {ENTITY_TYPE_LABELS[action.entity_type] || action.entity_type}
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
  allActions: any[];
  users: any[];
  onCompleteClick: (id: string, title: string) => void;
  onSnooze: (id: string, date: string) => void;
  onDelete: (id: string) => void;
  completing: string | null;
}

function TeamOverview({ allActions, users, onCompleteClick, onSnooze, onDelete, completing }: TeamOverviewProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const byUser = useMemo(() => {
    const map: Record<string, any[]> = {};
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
  const { getPendingFollowUps, getAllFollowUps, getOverdueFollowUps, completeFollowUp, snoozeFollowUp, deleteFollowUp, users } = useCRM();
  const { user, isAdmin } = useAuth();

  type Tab = 'all' | 'overdue' | 'today' | 'upcoming' | 'team';
  const [tab, setTab]         = useState<Tab>('today');
  const [myActions, setMyActions]   = useState<any[]>([]);
  const [allActions, setAllActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [showNextForm, setShowNextForm] = useState(false);
  const [completing, setCompleting]     = useState<string | null>(null);
  const [outcomeAction, setOutcomeAction] = useState<{ id: string; title: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [pending, overdue, all] = await Promise.all([
      getPendingFollowUps(isAdmin ? undefined : user?.id),
      getOverdueFollowUps(),
      isAdmin ? getAllFollowUps() : Promise.resolve([]),
    ]);
    // Merge pending + overdue, deduplicate
    const seen = new Set<string>();
    const merged = [...overdue, ...pending].filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
    setMyActions(merged);
    if (isAdmin) setAllActions(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const overdueIds = useMemo(
    () => new Set(myActions.filter(a => a.due_date < todayStr).map(a => a.id)),
    [myActions, todayStr]
  );

  const filtered = useMemo(() => {
    switch (tab) {
      case 'overdue':   return myActions.filter(a => a.due_date < todayStr);
      case 'today':     return myActions.filter(a => a.due_date === todayStr);
      case 'upcoming':  return myActions.filter(a => a.due_date > todayStr);
      default:          return myActions;
    }
  }, [myActions, tab, todayStr]);

  const counts = {
    all:      myActions.length,
    overdue:  myActions.filter(a => a.due_date < todayStr).length,
    today:    myActions.filter(a => a.due_date === todayStr).length,
    upcoming: myActions.filter(a => a.due_date > todayStr).length,
    team:     allActions.length,
  };

  const handleCompleteClick = (id: string, title: string) => setOutcomeAction({ id, title });

  const handleOutcomeConfirm = async (outcome: OutcomeResult, note: string, createNext: boolean) => {
    if (!outcomeAction) return;
    setCompleting(outcomeAction.id);
    const label = { reached: '✅ Reached them', no_answer: '📵 No answer', left_message: '💬 Left message', not_required: '' }[outcome];
    const fullNote = [label, note].filter(Boolean).join(' — ');
    await completeFollowUp(outcomeAction.id, fullNote || undefined);
    setMyActions(prev => prev.filter(a => a.id !== outcomeAction.id));
    setAllActions(prev => prev.filter(a => a.id !== outcomeAction.id));
    setCompleting(null);
    setOutcomeAction(null);
    if (createNext) setShowNextForm(true);
  };

  const handleSnooze = async (id: string, date: string) => {
    await snoozeFollowUp(id, date);
    // Remove from current view — will resurface on the new date
    setMyActions(prev => prev.filter(a => a.id !== id));
    setAllActions(prev => prev.filter(a => a.id !== id));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this action?')) return;
    await deleteFollowUp(id);
    setMyActions(prev => prev.filter(a => a.id !== id));
    setAllActions(prev => prev.filter(a => a.id !== id));
  };

  const TABS: { key: Tab; label: string; adminOnly?: boolean }[] = [
    { key: 'today',    label: 'Today' },
    { key: 'overdue',  label: 'Overdue' },
    { key: 'all',      label: 'All Mine' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'team',     label: '👥 Team', adminOnly: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Actions</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isAdmin ? 'Your actions + team oversight' : 'Your follow-ups and tasks'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Refresh">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
          >
            <Bell className="w-4 h-4" />
            New Action
          </button>
        </div>
      </div>

      {/* Escalation banner — appears when actions are 3+ days overdue */}
      {myActions.some(a => getDaysOverdue(a.due_date) >= 3) && (
        <div className="glass-card p-4 border border-red-600/40 bg-red-600/5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 animate-bounce" />
            <div className="flex-1">
              <p className="font-bold text-red-600">
                {myActions.filter(a => getDaysOverdue(a.due_date) >= 3).length} action{myActions.filter(a => getDaysOverdue(a.due_date) >= 3).length !== 1 ? 's' : ''} critically overdue (3+ days)
              </p>
              <p className="text-sm text-muted-foreground">These need immediate attention before other tasks</p>
            </div>
            <button onClick={() => setTab('overdue')} className="text-xs font-semibold text-red-600 hover:underline flex-shrink-0">
              View now →
            </button>
          </div>
        </div>
      )}

      {/* Standard overdue banner */}
      {counts.overdue > 0 && !myActions.some(a => getDaysOverdue(a.due_date) >= 3) && (
        <div className="glass-card p-4 border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="font-semibold text-red-500">{counts.overdue} overdue action{counts.overdue !== 1 ? 's' : ''} — needs attention</p>
            <button onClick={() => setTab('overdue')} className="ml-auto text-xs font-semibold text-red-500 hover:underline">View →</button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.filter(t => !t.adminOnly || isAdmin).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors',
              tab === t.key
                ? t.key === 'overdue'
                  ? 'bg-red-500 text-white'
                  : t.key === 'today'
                  ? 'bg-yellow-500 text-white'
                  : t.key === 'team'
                  ? 'bg-purple-500 text-white'
                  : 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {/* Content */}
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
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-foreground font-semibold text-lg">
            {tab === 'today' ? 'Nothing due today! 🎉' : 'All clear!'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {tab === 'today' ? 'Check upcoming actions or create a new one.' : `No ${tab} actions right now.`}
          </p>
          {tab === 'today' && counts.upcoming > 0 && (
            <button onClick={() => setTab('upcoming')} className="mt-3 text-sm text-primary hover:underline">
              View {counts.upcoming} upcoming →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Sort: tier 3 → tier 2 → tier 1 → tier 0 */}
          {[...filtered].sort((a, b) => getTier(b.due_date) - getTier(a.due_date)).map(action => (
            <ActionCard
              key={action.id}
              action={action}
              onCompleteClick={handleCompleteClick}
              onSnooze={handleSnooze}
              onDelete={handleDelete}
              completing={completing}
            />
          ))}
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
