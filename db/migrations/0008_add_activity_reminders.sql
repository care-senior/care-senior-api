CREATE TABLE activity_reminders (
  activity_id uuid NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, type)
);

CREATE INDEX notification_recipients_unread_idx
  ON notification_recipients (user_id, user_role) WHERE read_at IS NULL;
