ALTER TABLE messages ADD COLUMN sender_id uuid NOT NULL;

CREATE INDEX messages_resident_id_sent_at_idx ON messages (resident_id, sent_at);
DROP INDEX messages_resident_id_idx;
