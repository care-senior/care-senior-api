import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { vi } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { StaffRole } from '../../src/common/enums/index.js';
import { configureApp } from '../../src/configure-app.js';
import { MailService } from '../../src/mail/mail.service.js';

export const TEST_PASSWORD = 'correct-horse-battery';

export interface TestApp {
  app: INestApplication;
  dataSource: DataSource;
  mail: { sendPasswordReset: ReturnType<typeof vi.fn> };
  createClinic(): Promise<string>;
  createStaffMember(options?: {
    clinicId?: string;
    staffRole?: StaffRole;
    password?: string | null;
  }): Promise<{ id: string; email: string }>;
  createGuardian(options?: {
    email?: string;
    password?: string | null;
  }): Promise<{ id: string; email: string }>;
  close(): Promise<void>;
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@e2e.caresenior.dev`;
}

export async function createTestApp(): Promise<TestApp> {
  const mail = { sendPasswordReset: vi.fn().mockResolvedValue(undefined) };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  const createdClinicIds: string[] = [];
  const createdGuardianIds: string[] = [];
  const passwordHash = await argon2.hash(TEST_PASSWORD, {
    type: argon2.argon2id,
  });

  async function createClinic() {
    const [clinic] = (await dataSource.query(
      `INSERT INTO clinics (name, address, phone, operating_hours, responsible_people,
         whatsapp_phone, latitude, longitude)
       VALUES ('E2E Clinic', 'Rua Teste, 1', '0000', '24h', 'E2E', '0000', 0, 0)
       RETURNING id`,
    )) as { id: string }[];
    createdClinicIds.push(clinic!.id);
    return clinic!.id;
  }

  async function hashFor(password: string | null | undefined) {
    if (password === null) return null;
    if (password === undefined) return passwordHash;
    return argon2.hash(password, { type: argon2.argon2id });
  }

  return {
    app,
    dataSource,
    mail,
    createClinic,

    async createStaffMember({
      clinicId,
      staffRole = StaffRole.NURSE,
      password,
    } = {}) {
      const email = uniqueEmail('staff');
      const [staff] = (await dataSource.query(
        `INSERT INTO staff_members (name, email, staff_role, clinic_id, password)
         VALUES ('E2E Staff', $1, $2, $3, $4) RETURNING id`,
        [
          email,
          staffRole,
          clinicId ?? (await createClinic()),
          await hashFor(password),
        ],
      )) as { id: string }[];
      return { id: staff!.id, email };
    },

    async createGuardian({ email = uniqueEmail('guardian'), password } = {}) {
      const [guardian] = (await dataSource.query(
        `INSERT INTO guardians (name, email, cpf, password)
         VALUES ('E2E Guardian', $1, 'not-encrypted-in-fixtures', $2) RETURNING id`,
        [email, await hashFor(password)],
      )) as { id: string }[];
      createdGuardianIds.push(guardian!.id);
      return { id: guardian!.id, email };
    },

    async close() {
      await dataSource.query(
        `DELETE FROM auth_sessions WHERE user_id IN (
           SELECT id FROM staff_members WHERE clinic_id = ANY($1)
           UNION SELECT unnest($2::uuid[]))`,
        [createdClinicIds, createdGuardianIds],
      );
      await dataSource.query('DELETE FROM guardians WHERE id = ANY($1)', [
        createdGuardianIds,
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
