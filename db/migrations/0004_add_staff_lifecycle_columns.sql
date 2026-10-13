ALTER TABLE staff_members
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN deactivated_at timestamptz;
