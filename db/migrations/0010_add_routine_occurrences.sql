-- One row per slot a routine already generated, so the job never generates
-- it twice. activity_id is the activity the routine still manages: editing
-- that activity by hand detaches it (NULL), and the slot stays taken.
CREATE TABLE routine_occurrences (
  routine_id uuid NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
  occurs_at timestamptz NOT NULL,
  activity_id uuid UNIQUE REFERENCES activities (id) ON DELETE SET NULL,
  PRIMARY KEY (routine_id, occurs_at)
);

ALTER TABLE routines
  ADD CONSTRAINT routines_time_format CHECK (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT routines_weekdays_not_empty CHECK (cardinality(weekdays) > 0);
