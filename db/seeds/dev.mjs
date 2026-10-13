import argon2 from 'argon2';
import { encryptField } from '../../src/common/crypto/field-encryption.ts';

export const DEV_PASSWORD = 'careSenior123';

const CLINIC_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0001';
const ROOM_12B_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0101';
const ROOM_14A_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0102';
const ROOM_14B_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0103';
const RESIDENT_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0301';
const GUARDIAN_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0401';
const PENDING_GUARDIAN_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0402';
const PENDING_RESIDENT_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0302';
const BREAKFAST_ACTIVITY_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0501';
const PHYSIOTHERAPY_ACTIVITY_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0502';
const CAREGIVER_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0203';
const LOSARTANA_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0601';
const LOSARTANA_DOSE_ACTIVITY_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0503';
const OUTING_REQUEST_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0701';
const NURSE_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0202';
const BLOOD_PRESSURE_RECORD_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0801';
const GLUCOSE_RECORD_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0802';
const FAMILY_MESSAGE_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0901';
const CLINIC_MESSAGE_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0902';
const OUTING_NOTIFICATION_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a1001';
const FAMILY_MESSAGE_NOTIFICATION_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a1002';
const CLINIC_MESSAGE_NOTIFICATION_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a1003';
const FAMILY_FEEDBACK_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a1101';
const STAFF_FEEDBACK_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a1102';
const BLOOD_PRESSURE_ROUTINE_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a1201';
const MUSIC_ROUTINE_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a1202';

const STAFF = [
  [
    '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0201',
    'Renata Alencar',
    'coordenadora@caresenior.dev',
    'coordinator',
  ],
  [NURSE_ID, 'Juliana Martins', 'enfermeira@caresenior.dev', 'nurse'],
  [CAREGIVER_ID, 'Bruno Kanashiro', 'cuidador@caresenior.dev', 'caregiver'],
];

// Brasília time, so the sample agenda always lands relative to the day the
// seed runs.
function inDaysAt(days, time) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
  return `${day}T${time}:00-03:00`;
}

const todayAt = (time) => inDaysAt(0, time);

const formatDateTime = (isoDate) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(isoDate));

export default async function seed(client) {
  const password = await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id });

  await client.query(
    `INSERT INTO clinics (id, name, address, phone, operating_hours, activities,
       responsible_people, whatsapp_phone, latitude, longitude)
     VALUES ($1, 'Residencial Vida Plena', 'Rua das Acácias, 120 - Águas Claras, Brasília - DF',
       '(61) 3333-1010', 'Segunda a domingo, 24 horas',
       '{Fisioterapia,"Atividades recreativas","Acompanhamento nutricional"}',
       'Enfermeira Juliana Martins', '(61) 93333-1010', -15.8344, -48.0262)
     ON CONFLICT (id) DO NOTHING`,
    [CLINIC_ID],
  );

  await client.query(
    `INSERT INTO rooms (id, clinic_id, number, floor, wing, capacity) VALUES
       ($1, $4, '12B', 'Térreo', 'A', 1),
       ($2, $4, '14A', 'Térreo', 'A', 1),
       ($3, $4, '14B', 'Térreo', 'A', 1)
     ON CONFLICT (id) DO NOTHING`,
    [ROOM_12B_ID, ROOM_14A_ID, ROOM_14B_ID, CLINIC_ID],
  );

  for (const [id, name, email, staffRole] of STAFF) {
    await client.query(
      `INSERT INTO staff_members (id, name, email, staff_role, clinic_id, password)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [id, name, email, staffRole, CLINIC_ID, password],
    );
  }

  await client.query(
    `INSERT INTO guardians (id, name, email, cpf, password)
     VALUES ($1, 'Fernanda Costa', 'responsavel@caresenior.dev', $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [GUARDIAN_ID, encryptField('123.456.789-09'), password],
  );

  await client.query(
    `INSERT INTO residents (id, name, age, health_notes, clinic_id, room_id, mood,
       emergency_contact_name, emergency_contact_phone)
     VALUES ($1, 'Maria Aparecida Souza', 82, 'Hipertensão controlada. Mobilidade reduzida.',
       $2, $3, 'calm', 'Fernanda Costa (filha)', '(61) 99123-4567')
     ON CONFLICT (id) DO NOTHING`,
    [RESIDENT_ID, CLINIC_ID, ROOM_12B_ID],
  );

  await client.query(
    `INSERT INTO guardian_resident (guardian_id, resident_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [GUARDIAN_ID, RESIDENT_ID],
  );

  await client.query(
    `INSERT INTO guardians (id, name, email, cpf, password, contacted_clinic_ids)
     VALUES ($1, 'Camila Torres', 'vinculo-pendente@caresenior.dev', $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [PENDING_GUARDIAN_ID, encryptField('52998224725'), password, [CLINIC_ID]],
  );

  await client.query(
    `INSERT INTO residents (id, name, age, health_notes, mood, peculiarities)
     VALUES ($1, 'Benedito Nogueira', 80, 'Hipertensão leve, controlada com medicação diária.',
       'calm', 'Não gosta de barulho alto, prefere refeições cedo')
     ON CONFLICT (id) DO NOTHING`,
    [PENDING_RESIDENT_ID],
  );

  await client.query(
    `INSERT INTO guardian_resident (guardian_id, resident_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [PENDING_GUARDIAN_ID, PENDING_RESIDENT_ID],
  );

  await client.query(
    `INSERT INTO activities (id, clinic_id, type, title, scheduled_time, detail) VALUES
       ($1, $3, 'meal', 'Café da manhã', $4, NULL),
       ($2, $3, 'physicalActivity', 'Fisioterapia', $5, 'Alongamento e caminhada assistida')
     ON CONFLICT (id) DO UPDATE SET scheduled_time = EXCLUDED.scheduled_time`,
    [
      BREAKFAST_ACTIVITY_ID,
      PHYSIOTHERAPY_ACTIVITY_ID,
      CLINIC_ID,
      todayAt('08:00'),
      todayAt('15:00'),
    ],
  );

  await client.query(
    `INSERT INTO activity_participants (activity_id, resident_id, status,
       status_changed_at, registered_by_staff_id, rating, comment) VALUES
       ($1, $3, 'completed', $4, $5, 5, 'Comeu bem e conversou bastante'),
       ($2, $3, 'pending', NULL, NULL, NULL, NULL)
     ON CONFLICT (activity_id, resident_id) DO NOTHING`,
    [
      BREAKFAST_ACTIVITY_ID,
      PHYSIOTHERAPY_ACTIVITY_ID,
      RESIDENT_ID,
      todayAt('08:20'),
      CAREGIVER_ID,
    ],
  );

  await client.query(
    `INSERT INTO medications (id, resident_id, name, dosage, form, frequency,
       instructions, prescribed_by, start_date)
     VALUES ($1, $2, 'Losartana', '50mg', 'tablet', '1x ao dia, pela manhã',
       'Tomar em jejum', 'Dr. Paulo Lima', '2026-01-10T00:00:00-03:00')
     ON CONFLICT (id) DO NOTHING`,
    [LOSARTANA_ID, RESIDENT_ID],
  );

  await client.query(
    `INSERT INTO activities (id, clinic_id, type, title, scheduled_time, medication_id)
     VALUES ($1, $2, 'medication', 'Losartana 50mg', $3, $4)
     ON CONFLICT (id) DO UPDATE SET scheduled_time = EXCLUDED.scheduled_time`,
    [LOSARTANA_DOSE_ACTIVITY_ID, CLINIC_ID, todayAt('07:30'), LOSARTANA_ID],
  );

  await client.query(
    `INSERT INTO activity_participants (activity_id, resident_id, status,
       status_changed_at, registered_by_staff_id)
     VALUES ($1, $2, 'completed', $3, $4)
     ON CONFLICT (activity_id, resident_id) DO NOTHING`,
    [LOSARTANA_DOSE_ACTIVITY_ID, RESIDENT_ID, todayAt('07:35'), CAREGIVER_ID],
  );

  await client.query(
    `INSERT INTO outing_requests (id, resident_id, guardian_id, departure_at,
       return_at, notes)
     VALUES ($1, $2, $3, $4, $5, 'Almoço de aniversário na casa da filha; levar a Losartana')
     ON CONFLICT (id) DO NOTHING`,
    [
      OUTING_REQUEST_ID,
      RESIDENT_ID,
      GUARDIAN_ID,
      inDaysAt(4, '10:00'),
      inDaysAt(4, '18:00'),
    ],
  );

  await client.query(
    `INSERT INTO health_records (id, resident_id, type, value, recorded_at,
       recorded_by_staff_id) VALUES
       ($1, $3, 'bloodPressure', '130/85 mmHg', $4, $5),
       ($2, $3, 'glucose', '98 mg/dL', $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [
      BLOOD_PRESSURE_RECORD_ID,
      GLUCOSE_RECORD_ID,
      RESIDENT_ID,
      todayAt('07:10'),
      NURSE_ID,
    ],
  );

  await client.query(
    `INSERT INTO messages (id, resident_id, sender_id, sender_role, sender_name, text, sent_at) VALUES
       ($1, $3, $4, 'guardian', 'Fernanda Costa', 'Vou chegar um pouco atrasada na visita de hoje.', $6),
       ($2, $3, $5, 'staff', 'Juliana Martins', 'Sem problemas! Ela está no jardim esperando.', $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      FAMILY_MESSAGE_ID,
      CLINIC_MESSAGE_ID,
      RESIDENT_ID,
      GUARDIAN_ID,
      NURSE_ID,
      todayAt('09:00'),
      todayAt('09:05'),
    ],
  );

  // The notifications the API would have sent for the outing request and the
  // messages above.
  await client.query(
    `INSERT INTO app_notifications (id, type, title, message, created_at) VALUES
       ($1, 'general', 'Nova solicitação de saída', $4, $5),
       ($2, 'general', 'Novo recado sobre Maria Aparecida Souza',
        'Fernanda Costa: Vou chegar um pouco atrasada na visita de hoje.', $6),
       ($3, 'general', 'Novo recado sobre Maria Aparecida Souza',
        'Juliana Martins: Sem problemas! Ela está no jardim esperando.', $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      OUTING_NOTIFICATION_ID,
      FAMILY_MESSAGE_NOTIFICATION_ID,
      CLINIC_MESSAGE_NOTIFICATION_ID,
      `Fernanda Costa pediu a saída de Maria Aparecida Souza de ${formatDateTime(inDaysAt(4, '10:00'))} a ${formatDateTime(inDaysAt(4, '18:00'))}.`,
      todayAt('08:30'),
      todayAt('09:00'),
      todayAt('09:05'),
    ],
  );
  const [coordinatorId] = STAFF[0];
  await client.query(
    `INSERT INTO notification_recipients (notification_id, user_id, user_role, read_at) VALUES
       ($1, $4, 'staff', NULL),
       ($1, $5, 'staff', NULL),
       ($2, $4, 'staff', NULL),
       ($2, $5, 'staff', $8),
       ($2, $6, 'staff', NULL),
       ($3, $7, 'guardian', NULL)
     ON CONFLICT (notification_id, user_id) DO NOTHING`,
    [
      OUTING_NOTIFICATION_ID,
      FAMILY_MESSAGE_NOTIFICATION_ID,
      CLINIC_MESSAGE_NOTIFICATION_ID,
      coordinatorId,
      NURSE_ID,
      CAREGIVER_ID,
      GUARDIAN_ID,
      todayAt('09:05'),
    ],
  );

  await client.query(
    `INSERT INTO user_feedback (id, author_id, author_name, author_role, rating,
       message, clinic_ids, sent_at) VALUES
       ($1, $3, 'Fernanda Costa', 'guardian', 5,
        'Consigo acompanhar a rotina da minha mãe mesmo trabalhando.', $5, $6),
       ($2, $4, 'Bruno Kanashiro', 'staff', 4,
        'Registrar as atividades em lote ajuda muito no plantão.', $5, $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      FAMILY_FEEDBACK_ID,
      STAFF_FEEDBACK_ID,
      GUARDIAN_ID,
      CAREGIVER_ID,
      [CLINIC_ID],
      inDaysAt(-2, '20:15'),
      inDaysAt(-1, '14:40'),
    ],
  );

  // Their activities appear on the next hourly run of the routine job.
  await client.query(
    `INSERT INTO routines (id, clinic_id, title, activity_type, time, weekdays,
       scope, instructions) VALUES
       ($1, $3, 'Aferição de pressão', 'vitalSigns', '07:00',
        '{mon,tue,wed,thu,fri,sat,sun}', 'allResidents', 'Anotar no prontuário'),
       ($2, $3, 'Roda de música', 'socialGathering', '15:00',
        '{mon,wed,fri}', 'specificRoom', NULL)
     ON CONFLICT (id) DO NOTHING`,
    [BLOOD_PRESSURE_ROUTINE_ID, MUSIC_ROUTINE_ID, CLINIC_ID],
  );
  await client.query(
    `INSERT INTO routine_rooms (routine_id, room_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [MUSIC_ROUTINE_ID, ROOM_12B_ID],
  );
}
