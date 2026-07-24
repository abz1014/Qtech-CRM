// Employee management + attendance (admin-only HR module).
// A standalone staff roster, independent of CRM login accounts.

export interface Employee {
  id: string;
  name: string;
  employee_code: string;
  designation: string;
  department: string;
  phone: string;
  email: string;
  join_date: string;    // YYYY-MM-DD
  salary: number;       // monthly, reference only (not wired to payroll)
  shift_start: string;  // HH:MM; blank = no late calculation
  status: 'active' | 'inactive';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export type CreateEmployeeInput = Omit<Employee, 'id' | 'created_by' | 'created_at' | 'updated_at'>;
export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'half_day';

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'absent', 'leave', 'half_day'];

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  leave: 'Leave',
  half_day: 'Half-day',
};

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;         // YYYY-MM-DD
  status: AttendanceStatus;
  late: boolean;
  check_in: string;     // HH:MM (optional)
  check_out: string;    // HH:MM (optional)
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

/** What the UI sends to mark a day; one row per employee per date (upserted). */
export type MarkAttendanceInput = Omit<AttendanceRecord, 'id' | 'created_by' | 'created_at'>;
