CREATE TYPE health_record_type AS ENUM (
  'bloodPressure', 'glucose', 'weight', 'temperature', 'heartRate', 'other'
);

ALTER TABLE health_records
  ALTER COLUMN type TYPE health_record_type
  USING (
    CASE type
      WHEN 'Pressão arterial' THEN 'bloodPressure'
      WHEN 'Glicose' THEN 'glucose'
      WHEN 'Peso' THEN 'weight'
      WHEN 'Temperatura' THEN 'temperature'
      WHEN 'Frequência cardíaca' THEN 'heartRate'
      ELSE 'other'
    END
  )::health_record_type;

CREATE INDEX health_records_resident_id_recorded_at_idx
  ON health_records (resident_id, recorded_at);
DROP INDEX health_records_resident_id_idx;
