-- The occupancy of each clinic at the end of each day (Brasília), so the
-- reports can show it over time. Rewritten every hour during the day.
CREATE TABLE occupancy_snapshots (
  clinic_id uuid NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  day date NOT NULL,
  occupied_beds integer NOT NULL,
  capacity integer NOT NULL,
  PRIMARY KEY (clinic_id, day)
);
