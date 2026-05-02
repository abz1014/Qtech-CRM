import { useEffect, useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, AlertCircle, Clock, Trash2, Bell, Filter, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FollowUpForm } from '@/components/followup/FollowUpForm';

const PRIORITY_STYLES = {
  high:   'bg-red-500/10 border-red-500/30 text-red-500',
  medium: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600',
  low:    'bg-blue-500/10 border-blue-500/30 text-blue-500',
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  rfq_followup:      '📋 RFQ Follow-up',
  supplier_response: '📬 Supplier Follow-up',
  overdue_invoice:   '💰 Invoice Follow-up',
  order_status:      '📦 Order Status',
  custom:            '✏️ Custom',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  rfq:      'RFQ',
  order:    'Order',
  client:   'Client',
  prospect: 'Prospect',
  vendor:   'Vendor',
};

function daysLabel(due_date: string) {
  const diff = Math.ceil((new Date(due_date).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
  if (diff < 0)  return { text: `${Math.abs(diff)}d overdue`, color: 'text-red-500 bg-red-500/10' };
  if (diff === 0) return { text: 'Due today', color: 'text-yellow-600 bg-yellow-500/10' };
  if (diff === 1) return { text: 'Due tomorrow', color: 'text-yellow-500 bg-yellow-500/10' };
  return { text: `${diff}d left`, color: 'text-muted-foreground bg-muted' };
}

export default function ActionsPage() {
  const { getPendingFollowUps, getOverdueFollowUps, completeFollowUp, deleteFollowUp } = useCRM();
  const { user, isAdmin } = useAuth();

  const [all, setAll]         = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter]   = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');
  const [completing, setCompleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [pending, overdue] = await Promise.all([
      getPendingFollowUps(isAdmin ? undefined : user?.id),
      getOverdueFollowUps(),
    ]);
    // Merge, deduplicate by id
    const seen = new Set<string>();
    const merged = [...overdue, ...pending].filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
    setAll(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const overdueIds = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return new Set(all.filter(a => a.due_date < today).map(a => a.id));
  }, [all]);

  const todayStr = new Date().toISOString().split('T')[0];

  const filtered = useMemo(() => {
    switch (filter) {
      case 'overdue':   return all.filter(a => overdueIds.has(a.id));
      case 'today':     return all.filter(a => a.due_date === todayStr);
      case 'upcoming':  return all.filter(a => a.due_date > todayStr);
      default:          return all;
    }
  }, [all, filter, overdueIds, todayStr]);

  const counts = {
    all:      all.length,
    overdue:  overdueIds.size,
    today:    all.filter(a => a.due_date === todayStr).length,
    upcoming: all.filter(a => a.due_date > todayStr).length,
  };

  const handleComplete = async (id: string) => {
    setCompleting(id);
    await completeFollowUp(id);
    setAll(prev => prev.filter(a => a.id !== id));
    setCompleting(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this action?')) return;
    await deleteFollowUp(id);
    setAll(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Actions</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? 'All team follow-ups and tasks' : 'Your follow-ups and tasks'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Bell className="w-4 h-4" />
            New Action
          </button>
        </div>
      </div>

      {/* Overdue Alert */}
      {counts.overdue > 0 && (
        <div className="glass-card p-4 border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-500">{counts.overdue} overdue action{counts.overdue !== 1 ? 's' : ''}</p>
              <p className="text-sm text-muted-foreground">These need immediate attention</p>
            </div>
            <button
              onClick={() => setFilter('overdue')}
              className="ml-auto text-xs font-medium text-red-500 hover:underline"
            >
              View all
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'overdue', 'today', 'upcoming'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors',
              filter === f
                ? f === 'overdue'
                  ? 'bg-red-500 text-white'
                  : f === 'today'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Actions List */}
      {loading ? (
        <div className="glass-card p-8 text-center text-muted-foreground">Loading actions...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-foreground font-semibold text-lg">All clear! 🎉</p>
          <p className="text-sm text-muted-foreground mt-1">
            {filter === 'all' ? 'No pending actions.' : `No ${filter} actions.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(action => {
            const isOverdue = overdueIds.has(action.id);
            const day = daysLabel(action.due_date);

            return (
              <div
                key={action.id}
                className={cn(
                  'glass-card p-4 border-l-4 transition-all',
                  isOverdue ? 'border-l-red-500' : action.due_date === todayStr ? 'border-l-yellow-500' : 'border-l-primary/40'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Priority dot */}
                  <div className={cn('mt-1 px-2 py-0.5 rounded text-xs font-semibold border flex-shrink-0', PRIORITY_STYLES[action.priority as keyof typeof PRIORITY_STYLES])}>
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
                            <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded capitalize">
                              {ENTITY_TYPE_LABELS[action.entity_type] || action.entity_type}
                            </span>
                          )}
                          {action.description && action.description !== 'Auto-created by system' && (
                            <span className="text-xs text-muted-foreground">· {action.description}</span>
                          )}
                          {action.description === 'Auto-created by system' && (
                            <span className="text-xs text-muted-foreground italic">· Auto-created</span>
                          )}
                        </div>
                      </div>

                      {/* Due date badge */}
                      <div className={cn('flex items-center gap-1 px-2 py-1 rounded text-xs font-medium flex-shrink-0', day.color)}>
                        <Clock className="w-3 h-3" />
                        {day.text}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleComplete(action.id)}
                        disabled={completing === action.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-3 h-3" />
                        {completing === action.id ? 'Completing...' : 'Mark Complete'}
                      </button>
                      <button
                        onClick={() => handleDelete(action.id)}
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
          })}
        </div>
      )}

      {showForm && (
        <FollowUpForm
          onClose={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
