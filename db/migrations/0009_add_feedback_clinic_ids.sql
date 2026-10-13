-- Clinics that receive the feedback, taken from the author when it is sent:
-- the staff member's clinic, or the clinics of the guardian's residents.
ALTER TABLE user_feedback ADD COLUMN clinic_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX user_feedback_clinic_ids_idx ON user_feedback USING gin (clinic_ids);
