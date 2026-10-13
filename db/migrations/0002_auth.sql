ALTER TABLE staff_members ADD COLUMN password varchar;
ALTER TABLE guardians ADD COLUMN password varchar;

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_role user_role NOT NULL,
  refresh_token_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id, user_role);

CREATE TYPE auth_token_purpose AS ENUM ('invite', 'passwordReset');

CREATE TABLE auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_role user_role NOT NULL,
  purpose auth_token_purpose NOT NULL,
  token_hash varchar NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_idx ON auth_tokens (user_id, user_role, purpose);
