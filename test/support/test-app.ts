import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { vi } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { StaffRole } from '../../src/common/enums/index.js';
import { encryptField } from '../../src/common/crypto/field-encryption.js';
import { configureApp } from '../../src/configure-app.js';
import { MailService } from '../../src/infra/mail/services/mail.service.js';

export const TEST_PASSWORD = 'correct-horse-battery';
export const TEST_CPF = '52998224725';
const E2E_EMAIL_DOMAIN = 'e2e.caresenior.dev';

/** Every e-mail with this domain is deleted by `close()`, even if created through the API. */
export function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@${E2E_EMAIL_DOMAIN}`;
}

export interface TestApp {
  app: INestApplication;
  dataSource: DataSource;
  mail: {
    sendPasswordReset: ReturnType<typeof vi.fn>;
    sendInvite: ReturnType<typeof vi.fn>;
  };
  createClinic(options?: { name?: string; address?: string }): Promise<string>;
  createRoom(options: { clinicId: string; capacity?: number }): Promise<string>;
  createStaffMember(options?: {
    clinicId?: string;
    staffRole?: StaffRole;
    password?: string | null;
  }): Promise<{ id: string; email: string }>;
  createGuardian(options?: {
    email?: string;
    password?: string | null;
    contactedClinicIds?: string[];
  }): Promise<{ id: string; email: string }>;
  createResident(options?: {
    name?: string;
    clinicId?: string | null;
    roomId?: string | null;
    guardianIds?: string[];
  }): Promise<string>;
  close(): Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const mail = {
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
    sendInvite: vi.fn().mockResolvedValue(undefined),
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  const createdClinicIds: string[] = [];
  const createdResidentIds: string[] = [];
  const passwordHash = await argon2.hash(TEST_PASSWORD, {
    type: argon2.argon2id,
  });

  async function insertReturningId(sql: string, parameters: unknown[]) {
    const [row] = (await dataSource.query(sql, parameters)) as { id: string }[];
    return row!.id;
  }

  async function hashFor(password: string | null | undefined) {
    if (password === null) return null;
    if (password === undefined) return passwordHash;
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async function createClinic({
    name = 'E2E Clinic',
    address = 'Rua Teste, 1',
  }: { name?: string; address?: string } = {}) {
    const id = await insertReturningId(
      `INSERT INTO clinics (name, address, phone, operating_hours, responsible_people,
         whatsapp_phone, latitude, longitude)
       VALUES ($1, $2, '0000', '24h', 'E2E', '0000', 0, 0)
       RETURNING id`,
      [name, address],
    );
    createdClinicIds.push(id);
    return id;
  }

  return {
    app,
    dataSource,
    mail,
    createClinic,

    createRoom({ clinicId, capacity = 1 }) {
      return insertReturningId(
        `INSERT INTO rooms (clinic_id, number, floor, capacity)
         VALUES ($1, $2, 'Térreo', $3) RETURNING id`,
        [clinicId, `E2E-${randomUUID().slice(0, 8)}`, capacity],
      );
    },

    async createStaffMember({
      clinicId,
      staffRole = StaffRole.NURSE,
      password,
    } = {}) {
      const email = uniqueEmail('staff');
      const id = await insertReturningId(
        `INSERT INTO staff_members (name, email, staff_role, clinic_id, password)
         VALUES ('E2E Staff', $1, $2, $3, $4) RETURNING id`,
        [
          email,
          staffRole,
          clinicId ?? (await createClinic()),
          await hashFor(password),
        ],
      );
      return { id, email };
    },

    async createGuardian({
      email = uniqueEmail('guardian'),
      password,
      contactedClinicIds = [],
    } = {}) {
      const id = await insertReturningId(
        `INSERT INTO guardians (name, email, cpf, password, contacted_clinic_ids)
         VALUES ('E2E Guardian', $1, $2, $3, $4) RETURNING id`,
        [
          email,
          encryptField(TEST_CPF),
          await hashFor(password),
          contactedClinicIds,
        ],
      );
      return { id, email };
    },

    async createResident({
      name = 'E2E Resident',
      clinicId = null,
      roomId = null,
      guardianIds = [],
    } = {}) {
      const id = await insertReturningId(
        `INSERT INTO residents (name, age, clinic_id, room_id)
         VALUES ($1, 80, $2, $3) RETURNING id`,
        [name, clinicId, roomId],
      );
      for (const guardianId of guardianIds) {
        await dataSource.query(
          'INSERT INTO guardian_resident (guardian_id, resident_id) VALUES ($1, $2)',
          [guardianId, id],
        );
      }
      createdResidentIds.push(id);
      return id;
    },

    async close() {
      const guardianRows = (await dataSource.query(
        'SELECT id FROM guardians WHERE email LIKE $1',
        [`%@${E2E_EMAIL_DOMAIN}`],
      )) as { id: string }[];
      const guardianIds = guardianRows.map(({ id }) => id);

      await dataSource.query(
        `DELETE FROM residents WHERE id = ANY($1) OR clinic_id = ANY($2)
           OR id IN (SELECT resident_id FROM guardian_resident WHERE guardian_id = ANY($3))`,
        [createdResidentIds, createdClinicIds, guardianIds],
      );
      for (const table of ['auth_sessions', 'auth_tokens']) {
        await dataSource.query(
          `DELETE FROM ${table} WHERE user_id = ANY($1)
             OR user_id IN (SELECT id FROM staff_members WHERE clinic_id = ANY($2))`,
          [guardianIds, createdClinicIds],
        );
      }
      await dataSource.query(
        `DELETE FROM app_notifications WHERE id IN (
           SELECT notification_id FROM notification_recipients
           WHERE user_id = ANY($1)
             OR user_id IN (SELECT id FROM staff_members WHERE clinic_id = ANY($2))
         )`,
        [guardianIds, createdClinicIds],
      );
      await dataSource.query(
        `DELETE FROM user_feedback WHERE author_id = ANY($1)
           OR author_id IN (SELECT id FROM staff_members WHERE clinic_id = ANY($2))`,
        [guardianIds, createdClinicIds],
      );
      await dataSource.query(
        'DELETE FROM outing_requests WHERE guardian_id = ANY($1)',
        [guardianIds],
      );
      await dataSource.query('DELETE FROM guardians WHERE id = ANY($1)', [
        guardianIds,
      ]);
      await dataSource.query(
        'DELETE FROM staff_members WHERE clinic_id = ANY($1)',
        [createdClinicIds],
      );
      await dataSource.query('DELETE FROM clinics WHERE id = ANY($1)', [
        createdClinicIds,
      ]);
      await app.close();
    },
  };
}
