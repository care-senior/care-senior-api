import argon2 from 'argon2';
import { encryptField } from '../../src/common/crypto/field-encryption.ts';

export const DEV_PASSWORD = 'careSenior123';

const CLINIC_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0001';
const ROOM_12B_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0101';
const ROOM_14A_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0102';
const ROOM_14B_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0103';
const RESIDENT_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0301';
const GUARDIAN_ID = '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0401';

const STAFF = [
  [
    '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0201',
    'Renata Alencar',
    'coordenadora@caresenior.dev',
    'Coordenadora',
  ],
  [
    '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0202',
    'Juliana Martins',
    'enfermeira@caresenior.dev',
    'Enfermeira',
  ],
  [
    '0b7c9c6e-1f3a-4c55-9a51-3f0c2d1a0203',
    'Bruno Kanashiro',
    'cuidador@caresenior.dev',
    'Cuidador',
  ],
];

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

  for (const [id, name, email, role] of STAFF) {
    await client.query(
      `INSERT INTO staff_members (id, name, email, role, clinic_id, password)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [id, name, email, role, CLINIC_ID, password],
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
}
