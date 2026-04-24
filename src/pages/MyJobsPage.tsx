import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';

import { formatDate } from '@/lib/format';
import { Navigate } from 'react-router-dom';
import { CommissioningStatus } from '@/types/crm';
import { MapPin, Calendar, CheckCircle } from 'lucide-react';

const commColors: Record<CommissioningStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-warning/15 text-warning',
  completed: 'bg-success/15 text-success',
};

export default function MyJobsPage() {
  const { orderEngineers, orders, updateCommissioningStatus, getClientName } = useCRM();
  const { user, isEngineer } = useAuth();

  if (!isEngineer) return <Navigate to="/dashboard" replace />;

  const myJobs = orderEngineers.filter(oe => oe.engineer_id === user?.id);

  const nextStatus = (current: CommissioningStatus): CommissioningStatus | null => {
    if (current === 'pending') return 'in_progress';
    if (current === 'in_progress') return 'completed';
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Jobs</h1>
        <p className="text-muted-foreground mt-1">{myJobs.length} assigned jobs</p>
      </div>

      {myJobs.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-muted-foreground">No jobs assigned to you yet</p>
        </div>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Client', 'Product', 'Site Location', 'Start Date', 'Expected Completion', 'Status', 'Action'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myJobs.map(job => {
                const order = orders.find(o => o.id === job.order_id);
                if (!order) return null;
                const next = nextStatus(job.commissioning_status);
                return (
                  <tr key={job.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{getClientName(order.client_id)}</td>
                    <td className="px-5 py-3 text-sm text-foreground">{order.product_type}</td>
                    <td className="px-5 py-3 text-sm text-foreground">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-muted-foreground" />{job.site_location}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(job.start_date)}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(job.expected_completion)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`status-badge capitalize ${commColors[job.commissioning_status]}`}>
                        {job.commissioning_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {next ? (
                        <button
                          onClick={() => updateCommissioningStatus(job.id, next)}
                          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Mark {next.replace('_', ' ')}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Done</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
