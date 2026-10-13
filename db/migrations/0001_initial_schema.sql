CREATE TYPE activity_type AS ENUM (
  'medication', 'meal', 'physicalActivity', 'socialGathering',
  'vitalSigns', 'hygiene', 'sleep', 'other'
);
CREATE TYPE activity_status AS ENUM (
  'pending', 'inProgress', 'completed', 'late', 'cancelled', 'skipped'
);
CREATE TYPE medication_form AS ENUM ('tablet', 'liquid', 'injection', 'cream', 'other');
CREATE TYPE resident_mood AS ENUM (
  'cheerful', 'calm', 'anxious', 'irritable', 'sad', 'confused', 'variable'
);
CREATE TYPE notification_type AS ENUM (
  'medicationOverdue', 'medicationUpcoming', 'upcomingEvent', 'healthAlert', 'general'
);
CREATE TYPE outing_request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE routine_scope AS ENUM ('allResidents', 'specificResidents', 'specificRoom');
CREATE TYPE staff_role AS ENUM ('Coordenadora', 'Enfermeira', 'Cuidador');
CREATE TYPE user_role AS ENUM ('staff', 'guardian');
CREATE TYPE weekday AS ENUM ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');

CREATE TABLE clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  address varchar NOT NULL,
  phone varchar NOT NULL,
  operating_hours varchar NOT NULL,
  activities text[] NOT NULL DEFAULT '{}',
  responsible_people varchar NOT NULL,
  whatsapp_phone varchar NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  photo_path varchar
);

CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  number varchar NOT NULL,
  floor varchar NOT NULL,
  wing varchar,
  capacity integer NOT NULL,
  UNIQUE (clinic_id, number)
);

CREATE TABLE staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  email varchar NOT NULL UNIQUE,
  role staff_role NOT NULL,
  clinic_id uuid NOT NULL REFERENCES clinics (id) ON DELETE RESTRICT,
  photo_path varchar,
  cpf varchar
);
CREATE INDEX staff_members_clinic_id_idx ON staff_members (clinic_id);

CREATE TABLE guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  email varchar NOT NULL UNIQUE,
  photo_path varchar,
  cpf varchar NOT NULL,
  contacted_clinic_ids text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE residents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  age integer NOT NULL,
  health_notes text NOT NULL,
  clinic_id uuid REFERENCES clinics (id) ON DELETE SET NULL,
  room_id uuid REFERENCES rooms (id) ON DELETE SET NULL,
  mood resident_mood,
  peculiarities text,
  photo_path varchar,
  emergency_contact_name varchar,
  emergency_contact_phone varchar
);
CREATE INDEX residents_clinic_id_idx ON residents (clinic_id);
CREATE INDEX residents_room_id_idx ON residents (room_id);

CREATE TABLE guardian_resident (
  guardian_id uuid NOT NULL REFERENCES guardians (id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
  PRIMARY KEY (guardian_id, resident_id)
);
CREATE INDEX guardian_resident_resident_id_idx ON guardian_resident (resident_id);

CREATE TABLE outing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES guardians (id) ON DELETE RESTRICT,
  departure_at timestamptz NOT NULL,
  return_at timestamptz NOT NULL,
  notes text,
  status outing_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  rejection_reason text,
  CHECK (return_at > departure_at)
);
CREATE INDEX outing_requests_resident_id_idx ON outing_requests (resident_id);
CREATE INDEX outing_requests_guardian_id_idx ON outing_requests (guardian_id);

CREATE TABLE medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
  name varchar NOT NULL,
  dosage varchar NOT NULL,
  form medication_form NOT NULL,
  frequency varchar NOT NULL,
  instructions text,
  prescribed_by varchar,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX medications_resident_id_idx ON medications (resident_id);

CREATE TABLE routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  title varchar NOT NULL,
  activity_type activity_type NOT NULL,
  time varchar NOT NULL,
  weekdays weekday[] NOT NULL,
  scope routine_scope NOT NULL,
  instructions text,
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX routines_clinic_id_idx ON routines (clinic_id);

CREATE TABLE routine_residents (
  routine_id uuid NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
  PRIMARY KEY (routine_id, resident_id)
);

CREATE TABLE routine_rooms (
  routine_id uuid NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  PRIMARY KEY (routine_id, room_id)
);

CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  type activity_type NOT NULL,
  title varchar NOT NULL,
  scheduled_time timestamptz NOT NULL,
  detail text,
  photo_path varchar,
  medication_id uuid REFERENCES medications (id) ON DELETE SET NULL,
  routine_id uuid REFERENCES routines (id) ON DELETE SET NULL
);
CREATE INDEX activities_clinic_id_scheduled_time_idx ON activities (clinic_id, scheduled_time);

CREATE TABLE activity_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
  status activity_status NOT NULL DEFAULT 'pending',
  status_changed_at timestamptz,
  notes text,
  registered_by_staff_id uuid REFERENCES staff_members (id) ON DELETE SET NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  comment text,
  UNIQUE (activity_id, resident_id)
);
CREATE INDEX activity_participants_resident_id_idx ON activity_participants (resident_id);

CREATE TABLE health_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
  type varchar NOT NULL,
  value varchar NOT NULL,
  recorded_at timestamptz NOT NULL,
  recorded_by_staff_id uuid NOT NULL REFERENCES staff_members (id) ON DELETE RESTRICT
);
CREATE INDEX health_records_resident_id_idx ON health_records (resident_id);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
  sender_role user_role NOT NULL,
  sender_name varchar NOT NULL,
  text text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_resident_id_idx ON messages (resident_id);

CREATE TABLE user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  author_name varchar NOT NULL,
  author_role user_role NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL,
  title varchar NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES app_notifications (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_role user_role NOT NULL,
  read_at timestamptz,
  UNIQUE (notification_id, user_id)
);
CREATE INDEX notification_recipients_user_id_idx ON notification_recipients (user_id, user_role);
