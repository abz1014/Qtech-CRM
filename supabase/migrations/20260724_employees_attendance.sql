-- ============================================================================
-- 2026-07-24 · Employee management + attendance
-- A standalone staff roster (NOT tied to CRM login accounts) plus a daily
-- attendance sheet. Attendance is one row per employee per day (unique index),
-- so re-marking a day updates it rather than duplicating.
--
-- Salary is stored for reference only; it is NOT wired to the recurring-expense
-- payroll yet (deliberate — see the recurring_expenses feature).
-- Admin only (HR data). Idempotent — safe to run repeatedly.
-- ============================================================================

-- ── Staff roster ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL DEFAULT '',
  employee_code TEXT NOT NULL DEFAULT '',
  designation   TEXT NOT NULL DEFAULT '',
  department    TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  join_date     TEXT NOT NULL DEFAULT '',           -- YYYY-MM-DD
  salary        NUMERIC NOT NULL DEFAULT 0,          -- monthly, reference only
  shift_start   TEXT NOT NULL DEFAULT '',            -- HH:MM; blank = no late calc
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes         TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ
);

-- ── Daily attendance ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,                          -- YYYY-MM-DD
  status      TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','leave','half_day')),
  late        BOOLEAN NOT NULL DEFAULT false,
  check_in    TEXT NOT NULL DEFAULT '',               -- HH:MM (optional)
  check_out   TEXT NOT NULL DEFAULT '',               -- HH:MM (optional)
  notes       TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- one attendance record per employee per day (the upsert conflict target)
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

-- ── RLS: admin only (read + write) ──────────────────────────────────────────
ALTER TABLE employees  ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND policyname = 'employees_admin_rw') THEN
    CREATE POLICY "employees_admin_rw" ON employees FOR ALL
      USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance' AND policyname = 'attendance_admin_rw') THEN
    CREATE POLICY "attendance_admin_rw" ON attendance FOR ALL
      USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ── Realtime ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'employees') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE employees;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'attendance') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
  END IF;
END $$;
