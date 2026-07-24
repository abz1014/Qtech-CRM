import type { AttendanceRecord, AttendanceStatus } from '@/types/hr';

/** HH:MM → minutes since midnight, or null if not a valid time. */
export function minutesOf(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** True when a check-in is after the shift start (both must be valid times). */
export function isLate(checkIn: string, shiftStart: string): boolean {
  const ci = minutesOf(checkIn);
  const ss = minutesOf(shiftStart);
  if (ci === null || ss === null) return false;
  return ci > ss;
}

export interface AttendanceSummary {
  employee_id: string;
  present: number;
  absent: number;
  leave: number;
  half_day: number;
  late: number;
  marked: number;  // total days with any record
}

const empty = (employee_id: string): AttendanceSummary => ({
  employee_id, present: 0, absent: 0, leave: 0, half_day: 0, late: 0, marked: 0,
});

const STATUS_KEY: Record<AttendanceStatus, keyof AttendanceSummary> = {
  present: 'present', absent: 'absent', leave: 'leave', half_day: 'half_day',
};

/**
 * Roll up attendance records for a YYYY-MM period into per-employee counts.
 * Only records whose date starts with `period` are counted.
 */
export function summarizeMonth(records: AttendanceRecord[], period: string): Map<string, AttendanceSummary> {
  const out = new Map<string, AttendanceSummary>();
  for (const r of records) {
    if (!r.date.startsWith(period)) continue;
    const s = out.get(r.employee_id) ?? empty(r.employee_id);
    s[STATUS_KEY[r.status]]++;
    s.marked++;
    if (r.late) s.late++;
    out.set(r.employee_id, s);
  }
  return out;
}

/** Index a day's records by employee_id for quick lookup while marking. */
export function recordsByEmployeeForDate(records: AttendanceRecord[], date: string): Map<string, AttendanceRecord> {
  const out = new Map<string, AttendanceRecord>();
  for (const r of records) if (r.date === date) out.set(r.employee_id, r);
  return out;
}
