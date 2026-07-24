import { useState, useMemo, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatPKR, formatDate } from '@/lib/format';
import { businessToday } from '@/lib/dates';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Users, UserCheck, Plus, X, Pencil, Trash2, Search, CalendarDays, Building2, Wallet,
} from 'lucide-react';
import type { Employee, AttendanceRecord, AttendanceStatus, CreateEmployeeInput, MarkAttendanceInput } from '@/types/hr';
import { ATTENDANCE_STATUSES, ATTENDANCE_LABEL } from '@/types/hr';
import { isLate, summarizeMonth, recordsByEmployeeForDate } from '@/lib/hr/attendance';

const DEPARTMENTS = ['Sales', 'Engineering', 'Operations', 'Accounts', 'Admin', 'Procurement', 'Warehouse'];

const STATUS_BTN: Record<AttendanceStatus, { on: string; off: string }> = {
  present:  { on: 'bg-success text-white',        off: 'text-success hover:bg-success/10' },
  absent:   { on: 'bg-destructive text-white',    off: 'text-destructive hover:bg-destructive/10' },
  leave:    { on: 'bg-info text-white',           off: 'text-info hover:bg-info/10' },
  half_day: { on: 'bg-amber-500 text-white',      off: 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10' },
};

const monthKeyLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
};

const blankEmployee = () => ({
  name: '', employee_code: '', designation: '', department: 'Sales', phone: '', email: '',
  join_date: '', salary: '', shift_start: '09:00', status: 'active' as 'active' | 'inactive', notes: '',
});

export default function EmployeesPage() {
  const { employees, attendance, addEmployee, updateEmployee, deleteEmployee, markAttendance } = useCRM();
  const { user } = useAuth();

  const [tab, setTab] = useState<'roster' | 'attendance'>('roster');
  const [search, setSearch] = useState('');
  const [empModal, setEmpModal] = useState<{ mode: 'add' | 'edit'; id?: string } | null>(null);
  const [empForm, setEmpForm] = useState(blankEmployee());
  const [savingEmp, setSavingEmp] = useState(false);

  const [attDate, setAttDate] = useState(businessToday());
  const [summaryMonth, setSummaryMonth] = useState(businessToday().slice(0, 7));

  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);

  const rosterFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(e =>
      [e.name, e.employee_code, e.designation, e.department, e.phone, e.email].some(v => (v || '').toLowerCase().includes(q)));
  }, [employees, search]);

  const kpis = useMemo(() => ({
    active: activeEmployees.length,
    departments: new Set(activeEmployees.map(e => e.department).filter(Boolean)).size,
    payroll: activeEmployees.reduce((s, e) => s + (e.salary || 0), 0),
  }), [activeEmployees]);

  const dayRecords = useMemo(() => recordsByEmployeeForDate(attendance, attDate), [attendance, attDate]);
  const summary = useMemo(() => summarizeMonth(attendance, summaryMonth), [attendance, summaryMonth]);

  // ── Employee handlers ───────────────────────────────────────────────────────
  const openAdd = () => { setEmpForm(blankEmployee()); setEmpModal({ mode: 'add' }); };
  const openEdit = (e: Employee) => {
    setEmpForm({
      name: e.name, employee_code: e.employee_code, designation: e.designation, department: e.department,
      phone: e.phone, email: e.email, join_date: e.join_date, salary: e.salary ? String(e.salary) : '',
      shift_start: e.shift_start, status: e.status, notes: e.notes || '',
    });
    setEmpModal({ mode: 'edit', id: e.id });
  };

  const handleSaveEmp = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!user || !empModal) return;
    if (!empForm.name.trim()) { toast.error('Enter the employee name'); return; }
    const payload: CreateEmployeeInput = {
      name: empForm.name.trim(), employee_code: empForm.employee_code.trim(), designation: empForm.designation.trim(),
      department: empForm.department.trim(), phone: empForm.phone.trim(), email: empForm.email.trim(),
      join_date: empForm.join_date, salary: parseFloat(empForm.salary) || 0, shift_start: empForm.shift_start,
      status: empForm.status, notes: empForm.notes.trim() || null,
    };
    setSavingEmp(true);
    try {
      if (empModal.mode === 'add') await addEmployee(payload, user.id);
      else if (empModal.id) await updateEmployee(empModal.id, payload);
      toast.success(empModal.mode === 'add' ? 'Employee added' : 'Employee updated');
      setEmpModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save employee');
    } finally { setSavingEmp(false); }
  };

  const handleDeleteEmp = async (e: Employee) => {
    if (!window.confirm(`Delete ${e.name}? Their attendance history will also be removed. This cannot be undone.`)) return;
    try {
      await deleteEmployee(e.id);
      toast.success('Employee deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete employee');
    }
  };

  const toggleActive = async (e: Employee) => {
    try { await updateEmployee(e.id, { status: e.status === 'active' ? 'inactive' : 'active' }); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to update'); }
  };

  // ── Attendance marking ──────────────────────────────────────────────────────
  const mark = async (emp: Employee, patch: Partial<MarkAttendanceInput>) => {
    if (!user) return;
    const ex = dayRecords.get(emp.id);
    const base: MarkAttendanceInput = {
      employee_id: emp.id, date: attDate,
      status: ex?.status ?? 'present', late: ex?.late ?? false,
      check_in: ex?.check_in ?? '', check_out: ex?.check_out ?? '', notes: ex?.notes ?? null,
    };
    try { await markAttendance({ ...base, ...patch }, user.id); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to mark attendance'); }
  };

  const markAllPresent = async () => {
    const unmarked = activeEmployees.filter(e => !dayRecords.has(e.id));
    if (unmarked.length === 0) { toast.info('Everyone is already marked for this day.'); return; }
    try {
      for (const e of unmarked) await mark(e, { status: 'present' });
      toast.success(`Marked ${unmarked.length} present`);
    } catch { /* per-row errors already toasted */ }
  };

  const inputCls = 'w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';
  const lbl = 'block text-xs font-medium text-muted-foreground mb-1';
  const tabBtn = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button onClick={() => setTab('roster')} className={tabBtn(tab === 'roster')}>
          <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Roster</span>
        </button>
        <button onClick={() => setTab('attendance')} className={tabBtn(tab === 'attendance')}>
          <span className="flex items-center gap-1.5"><UserCheck className="w-4 h-4" /> Attendance</span>
        </button>
      </div>

      {tab === 'roster' ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="kpi-card"><p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Active</p><p className="text-2xl font-extrabold text-foreground mt-1">{kpis.active}</p></div>
            <div className="kpi-card"><p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Departments</p><p className="text-2xl font-extrabold text-foreground mt-1">{kpis.departments}</p></div>
            <div className="kpi-card"><p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Monthly payroll</p><p className="text-2xl font-extrabold text-foreground mt-1">{formatPKR(kpis.payroll)}</p><p className="text-[10px] text-muted-foreground">reference only</p></div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, code, designation…" className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors ml-auto">
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          </div>

          <div className="glass-card p-0 overflow-x-auto">
            {rosterFiltered.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">{employees.length === 0 ? 'No employees yet. Add your first staff member.' : 'No employees match this search.'}</p>
            ) : (
              <table className="w-full text-sm" style={{ minWidth: 720 }}>
                <thead><tr className="border-b border-border text-left text-[11px] font-semibold text-muted-foreground">
                  <th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Designation</th><th className="px-3 py-2.5">Department</th><th className="px-3 py-2.5">Contact</th><th className="px-3 py-2.5 text-right">Salary</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5"></th>
                </tr></thead>
                <tbody>
                  {rosterFiltered.map(e => (
                    <tr key={e.id} className={cn('border-b border-border/50 hover:bg-muted/30 transition-colors', e.status === 'inactive' && 'opacity-55')}>
                      <td className="px-3 py-2.5"><div className="font-semibold text-foreground">{e.name}</div>{e.employee_code && <div className="text-[11px] text-muted-foreground">{e.employee_code}</div>}</td>
                      <td className="px-3 py-2.5 text-foreground">{e.designation || '—'}</td>
                      <td className="px-3 py-2.5"><span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-info/10 text-info">{e.department || '—'}</span></td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">{e.phone || e.email || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-foreground">{formatPKR(e.salary)}</td>
                      <td className="px-3 py-2.5"><button onClick={() => toggleActive(e)} className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', e.status === 'active' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>{e.status}</button></td>
                      <td className="px-3 py-2.5"><div className="flex items-center gap-2">
                        <button onClick={() => openEdit(e)} className="text-muted-foreground hover:text-primary transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteEmp(e)} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Attendance: daily sheet */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} className="px-2 py-1.5 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <span className="text-xs text-muted-foreground">{formatDate(attDate)}</span>
            </div>
            <button onClick={markAllPresent} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-success text-white hover:bg-success/90 transition-colors">Mark all present</button>
          </div>

          <div className="glass-card p-4 space-y-1.5">
            {activeEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No active employees to mark. Add staff in the Roster tab.</p>
            ) : activeEmployees.map(e => (
              <AttendanceRow key={e.id} emp={e} record={dayRecords.get(e.id)} onMark={patch => mark(e, patch)} />
            ))}
          </div>

          {/* Attendance: monthly summary */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="section-title flex items-center gap-1.5"><UserCheck className="w-4 h-4 text-primary" /> Monthly summary</p>
              <input type="month" value={summaryMonth} onChange={e => setSummaryMonth(e.target.value)} className="px-2 py-1 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="glass-card p-0 overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 620 }}>
                <thead><tr className="border-b border-border text-left text-[11px] font-semibold text-muted-foreground">
                  <th className="px-3 py-2.5">Employee</th><th className="px-3 py-2.5 text-center">Present</th><th className="px-3 py-2.5 text-center">Absent</th><th className="px-3 py-2.5 text-center">Leave</th><th className="px-3 py-2.5 text-center">Half-day</th><th className="px-3 py-2.5 text-center">Late</th><th className="px-3 py-2.5 text-center">Marked</th>
                </tr></thead>
                <tbody>
                  {activeEmployees.map(e => {
                    const s = summary.get(e.id);
                    return (
                      <tr key={e.id} className="border-b border-border/50">
                        <td className="px-3 py-2.5 font-medium text-foreground">{e.name}</td>
                        <td className="px-3 py-2.5 text-center text-success">{s?.present ?? 0}</td>
                        <td className="px-3 py-2.5 text-center text-destructive">{s?.absent ?? 0}</td>
                        <td className="px-3 py-2.5 text-center text-info">{s?.leave ?? 0}</td>
                        <td className="px-3 py-2.5 text-center text-amber-600 dark:text-amber-400">{s?.half_day ?? 0}</td>
                        <td className="px-3 py-2.5 text-center font-semibold text-amber-600 dark:text-amber-400">{s?.late ?? 0}</td>
                        <td className="px-3 py-2.5 text-center text-muted-foreground">{s?.marked ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">Counts cover {monthKeyLabel(summaryMonth)}. "Late" is set from check-in vs. the employee's shift start, or marked manually.</p>
          </div>
        </>
      )}

      {/* Employee add/edit modal */}
      {empModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{empModal.mode === 'add' ? 'Add Employee' : 'Edit Employee'}</h2>
              <button onClick={() => setEmpModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveEmp} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Name</label><input value={empForm.name} onChange={e => setEmpForm(p => ({ ...p, name: e.target.value }))} className={inputCls} required autoFocus /></div>
                <div><label className={lbl}>Employee code</label><input value={empForm.employee_code} onChange={e => setEmpForm(p => ({ ...p, employee_code: e.target.value }))} className={inputCls} /></div>
                <div><label className={lbl}>Designation</label><input value={empForm.designation} onChange={e => setEmpForm(p => ({ ...p, designation: e.target.value }))} placeholder="e.g. Sales Engineer" className={inputCls} /></div>
                <div>
                  <label className={lbl}>Department</label>
                  <input list="dept-list" value={empForm.department} onChange={e => setEmpForm(p => ({ ...p, department: e.target.value }))} className={inputCls} />
                  <datalist id="dept-list">{DEPARTMENTS.map(d => <option key={d} value={d} />)}</datalist>
                </div>
                <div><label className={lbl}>Phone</label><input value={empForm.phone} onChange={e => setEmpForm(p => ({ ...p, phone: e.target.value }))} className={inputCls} /></div>
                <div><label className={lbl}>Email</label><input value={empForm.email} onChange={e => setEmpForm(p => ({ ...p, email: e.target.value }))} className={inputCls} /></div>
                <div><label className={lbl}>Join date</label><input type="date" value={empForm.join_date} onChange={e => setEmpForm(p => ({ ...p, join_date: e.target.value }))} className={inputCls} /></div>
                <div><label className={lbl}>Monthly salary (PKR)</label><input type="number" step="0.01" value={empForm.salary} onChange={e => setEmpForm(p => ({ ...p, salary: e.target.value }))} className={inputCls} /></div>
                <div><label className={lbl}>Shift start (HH:MM)</label><input type="time" value={empForm.shift_start} onChange={e => setEmpForm(p => ({ ...p, shift_start: e.target.value }))} className={inputCls} /></div>
                <div>
                  <label className={lbl}>Status</label>
                  <select value={empForm.status} onChange={e => setEmpForm(p => ({ ...p, status: e.target.value as 'active' | 'inactive' }))} className={inputCls}>
                    <option value="active">Active</option><option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div><label className={lbl}>Notes</label><input value={empForm.notes} onChange={e => setEmpForm(p => ({ ...p, notes: e.target.value }))} className={inputCls} /></div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEmpModal(null)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={savingEmp} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">{savingEmp ? 'Saving…' : empModal.mode === 'add' ? 'Add' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── One employee's row on the daily attendance sheet ──────────────────────────
function AttendanceRow({ emp, record, onMark }: {
  emp: Employee;
  record: AttendanceRecord | undefined;
  onMark: (patch: Partial<MarkAttendanceInput>) => void;
}) {
  const [checkIn, setCheckIn] = useState(record?.check_in ?? '');
  const [checkOut, setCheckOut] = useState(record?.check_out ?? '');
  const [note, setNote] = useState(record?.notes ?? '');

  useEffect(() => {
    setCheckIn(record?.check_in ?? '');
    setCheckOut(record?.check_out ?? '');
    setNote(record?.notes ?? '');
  }, [record?.id, record?.check_in, record?.check_out, record?.notes]);

  const timeCls = 'w-24 px-2 py-1 bg-muted border border-border rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';

  return (
    <div className="flex items-center gap-2 flex-wrap p-2 rounded-lg hover:bg-muted/40 transition-colors">
      <div className="min-w-[140px] flex-1">
        <p className="text-sm font-medium text-foreground truncate">{emp.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">{emp.designation || emp.department}</p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {ATTENDANCE_STATUSES.map(s => {
          const on = record?.status === s;
          return (
            <button key={s} onClick={() => onMark({ status: s })}
              className={cn('px-2 py-1 rounded text-[11px] font-semibold border transition-colors',
                on ? STATUS_BTN[s].on + ' border-transparent' : 'border-border ' + STATUS_BTN[s].off)}>
              {ATTENDANCE_LABEL[s]}
            </button>
          );
        })}
      </div>

      <button onClick={() => onMark({ late: !record?.late })} disabled={!record}
        className={cn('px-2 py-1 rounded text-[11px] font-semibold border transition-colors flex-shrink-0',
          record?.late ? 'bg-amber-500 text-white border-transparent' : 'border-border text-muted-foreground hover:text-amber-600',
          !record && 'opacity-40 cursor-not-allowed')}
        title={record ? 'Toggle late' : 'Mark a status first'}>
        Late
      </button>

      <input type="time" value={checkIn}
        onChange={e => setCheckIn(e.target.value)}
        onBlur={() => { if (checkIn !== (record?.check_in ?? '')) onMark({ check_in: checkIn, late: checkIn ? isLate(checkIn, emp.shift_start) : (record?.late ?? false) }); }}
        className={timeCls} title="Check-in" />
      <input type="time" value={checkOut}
        onChange={e => setCheckOut(e.target.value)}
        onBlur={() => { if (checkOut !== (record?.check_out ?? '')) onMark({ check_out: checkOut }); }}
        className={timeCls} title="Check-out" />
      <input value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={() => { if ((note || '') !== (record?.notes ?? '')) onMark({ notes: note || null }); }}
        placeholder="note" className="flex-1 min-w-[100px] px-2 py-1 bg-muted border border-border rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
    </div>
  );
}
