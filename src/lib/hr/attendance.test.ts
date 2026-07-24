import { describe, it, expect } from 'vitest';
import { minutesOf, isLate, summarizeMonth, recordsByEmployeeForDate } from './attendance';
import type { AttendanceRecord, AttendanceStatus } from '@/types/hr';

const rec = (employee_id: string, date: string, status: AttendanceStatus, late = false): AttendanceRecord => ({
  id: `${employee_id}-${date}`, employee_id, date, status, late,
  check_in: '', check_out: '', notes: null, created_by: null, created_at: '',
});

describe('attendance time helpers', () => {
  it('minutesOf parses valid times and rejects junk', () => {
    expect(minutesOf('09:00')).toBe(540);
    expect(minutesOf('9:05')).toBe(545);
    expect(minutesOf('23:59')).toBe(1439);
    expect(minutesOf('24:00')).toBeNull();
    expect(minutesOf('9')).toBeNull();
    expect(minutesOf('')).toBeNull();
  });

  it('isLate only when check-in is after shift start', () => {
    expect(isLate('09:15', '09:00')).toBe(true);
    expect(isLate('09:00', '09:00')).toBe(false);
    expect(isLate('08:45', '09:00')).toBe(false);
    expect(isLate('', '09:00')).toBe(false);   // missing time → not late
    expect(isLate('09:15', '')).toBe(false);
  });
});

describe('summarizeMonth', () => {
  const records = [
    rec('a', '2026-07-01', 'present'),
    rec('a', '2026-07-02', 'present', true),   // late
    rec('a', '2026-07-03', 'leave'),
    rec('a', '2026-06-30', 'absent'),          // different month — excluded
    rec('b', '2026-07-01', 'absent'),
    rec('b', '2026-07-02', 'half_day'),
  ];

  it('counts by status within the period only', () => {
    const s = summarizeMonth(records, '2026-07');
    expect(s.get('a')).toMatchObject({ present: 2, leave: 1, absent: 0, half_day: 0, late: 1, marked: 3 });
    expect(s.get('b')).toMatchObject({ present: 0, absent: 1, half_day: 1, marked: 2 });
  });

  it('excludes other months', () => {
    const s = summarizeMonth(records, '2026-06');
    expect(s.get('a')).toMatchObject({ absent: 1, marked: 1 });
    expect(s.has('b')).toBe(false);
  });
});

describe('recordsByEmployeeForDate', () => {
  it('indexes only the given day', () => {
    const byEmp = recordsByEmployeeForDate([
      rec('a', '2026-07-01', 'present'),
      rec('b', '2026-07-01', 'absent'),
      rec('a', '2026-07-02', 'leave'),
    ], '2026-07-01');
    expect(byEmp.size).toBe(2);
    expect(byEmp.get('a')?.status).toBe('present');
    expect(byEmp.get('b')?.status).toBe('absent');
  });
});
