import { useEffect, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, AlertCircle, Clock, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FollowUpForm } from './FollowUpForm';
import { OutcomeModal, OutcomeResult } from './OutcomeModal';

export function FollowUpActionsDashboard() {
  const { getPendingFollowUps, getOverdueFollowUps, completeFollowUp, deleteFollowUp } = useCRM();
  const { user } = useAuth();
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [overdueActions, setOverdueActions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending'>('all');
  const [outcomeAction, setOutcomeAction] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    loadFollowUps();
  }, []);

  const loadFollowUps = async () => {
    setIsLoading(true);
    const [pending, overdue] = await Promise.all([
      getPendingFollowUps(user?.id),
      getOverdueFollowUps()
    ]);
    setPendingActions(pending);
    setOverdueActions(overdue);
    setIsLoading(false);
  };

  const handleCompleteClick = (id: string, title: string) => {
    setOutcomeAction({ id, title });
  };

  const handleOutcomeConfirm = async (outcome: OutcomeResult, note: string) => {
    if (!outcomeAction) return;
    const label = { reached: '✅ Reached them', no_answer: '📵 No answer', left_message: '💬 Left message', not_required: '' }[outcome];
    const fullNote = [label, note].filter(Boolean).join(' — ');
    await completeFollowUp(outcomeAction.id, fullNote || undefined);
    setOutcomeAction(null);
    await loadFollowUps();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this follow-up?')) {
      await deleteFollowUp(id);
      await loadFollowUps();
    }
  };

  const handleFormClose = async () => {
    setShowForm(false);
    await loadFollowUps();
  };

  const getDisplayActions = () => {
    const all = [...overdueActions, ...pendingActions];
    switch (filter) {
      case 'overdue':
        return overdueActions;
      case 'pending':
        return pendingActions.filter(a => !overdueActions.some(o => o.id === a.id));
      default:
        return all;
    }
  };

  const displayActions = getDisplayActions();
  const priorityColors = {
    low: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    medium: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    high: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  };

  const actionTypeLabels = {
    rfq_followup: '📋 RFQ Follow-up',
    supplier_response: '📬 Supplier Response',
    overdue_invoice: '💰 Overdue Invoice',
    order_status: '📦 Order Status',
  };

  if (isLoading) {
    return <div className="glass-card p-6 text-center text-muted-foreground">Loading actions...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Action Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {displayActions.length} pending action{displayActions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Action
        </button>
      </div>

      {/* Alert for Overdue */}
      {overdueActions.length > 0 && (
        <div className="glass-card p-4 border-2 border-red-500/30 bg-red-50/10 dark:bg-red-900/10">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-700 dark:text-red-400">
                {overdueActions.length} Overdue Action{overdueActions.length !== 1 ? 's' : ''}
              </h3>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                These actions were due and need immediate attention.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            filter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          All ({displayActions.length})
        </button>
        <button
          onClick={() => setFilter('overdue')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            filter === 'overdue'
              ? 'bg-red-500 text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          Overdue ({overdueActions.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            filter === 'pending'
              ? 'bg-yellow-500 text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          Pending ({pendingActions.filter(a => !overdueActions.some(o => o.id === a.id)).length})
        </button>
      </div>

      {/* Actions List */}
      {displayActions.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-foreground font-semibold">All Caught Up! 🎉</p>
          <p className="text-sm text-muted-foreground mt-1">No pending actions to do right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayActions.map((action) => {
            const isOverdue = overdueActions.some(o => o.id === action.id);
            const daysUntilDue = Math.ceil(
              (new Date(action.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            );

            return (
              <div
                key={action.id}
                className={cn(
                  'glass-card p-4 border-l-4 transition-all',
                  isOverdue
                    ? 'border-l-red-500 bg-red-50/20 dark:bg-red-900/10'
                    : 'border-l-blue-500 bg-blue-50/20 dark:bg-blue-900/10'
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Priority Badge */}
                  <div className={cn(
                    'px-2 py-1 rounded text-xs font-semibold whitespace-nowrap',
                    priorityColors[action.priority as keyof typeof priorityColors]
                  )}>
                    {action.priority.toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{action.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {actionTypeLabels[action.action_type as keyof typeof actionTypeLabels]}
                        </p>
                        {action.description && (
                          <p className="text-sm text-muted-foreground mt-2">{action.description}</p>
                        )}
                      </div>

                      {/* Due Date */}
                      <div className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap',
                        isOverdue
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : daysUntilDue <= 1
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-muted text-muted-foreground'
                      )}>
                        <Clock className="w-3 h-3" />
                        {isOverdue
                          ? `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''} overdue`
                          : daysUntilDue === 0
                            ? 'Today'
                            : `${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} left`
                        }
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleCompleteClick(action.id, action.title)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Complete
                      </button>
                      <button
                        onClick={() => handleDelete(action.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-muted text-muted-foreground rounded hover:bg-destructive/20 hover:text-destructive transition-colors"
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

      {showForm && <FollowUpForm onClose={handleFormClose} />}

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
