import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const CLINICS = '/api/v1/clinics';

describe('Clinics (e2e)', () => {
  let testApp: TestApp;
  let clinicId: string;
  let otherClinicId: string;
  let tokens: Record<'nurse' | 'caregiver' | 'guardian', string>;
  const searchTag = `e2e-${randomUUID()}`;
  const http = () => request(testApp.app.getHttpServer());
  const signToken = (payload: object) =>
    new JwtService({ secret: process.env.JWT_SECRET }).sign(payload);
  const staffToken = (staffRole: StaffRole, staffClinicId = clinicId) =>
    signToken({
      sub: randomUUID(),
      role: UserRole.STAFF,
      staffRole,
      clinicId: staffClinicId,
    });

  beforeAll(async () => {
    testApp = await createTestApp();
    clinicId = await testApp.createClinic({
      name: `Residencial ${searchTag} Alfa`,
    });
    otherClinicId = await testApp.createClinic({
      name: 'Casa de Repouso Beta',
      address: `Rua ${searchTag}, 10`,
    });
    tokens = {
      nurse: staffToken(StaffRole.NURSE),
      caregiver: staffToken(StaffRole.CAREGIVER),
      guardian: signToken({ sub: randomUUID(), role: UserRole.GUARDIAN }),
    };
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('GET /clinics', () => {
    it('requires authentication', async () => {
      await http().get(CLINICS).expect(401);
    });

    it('paginates and searches by name or address', async () => {
      const response = await http()
        .get(CLINICS)
        .query({ search: searchTag.toUpperCase(), limit: 1 })
        .set('Authorization', `Bearer ${tokens.guardian}`)
        .expect(200);

      expect(response.body.meta).toEqual({
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
      expect(response.body.data).toEqual([
        expect.objectContaining({ id: otherClinicId }),
      ]);
    });

    it('treats LIKE wildcards in the search as plain text', async () => {
      const response = await http()
        .get(CLINICS)
        .query({ search: `${searchTag}%` })
        .set('Authorization', `Bearer ${tokens.guardian}`)
        .expect(200);

      expect(response.body.meta.total).toBe(0);
    });

    it('validates pagination', async () => {
      await http()
        .get(CLINICS)
        .query({ limit: 500 })
        .set('Authorization', `Bearer ${tokens.guardian}`)
        .expect(400);
    });
  });

  describe('GET /clinics/:id', () => {
    it('returns the clinic to any authenticated user', async () => {
      const response = await http()
        .get(`${CLINICS}/${clinicId}`)
        .set('Authorization', `Bearer ${tokens.guardian}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: clinicId,
        name: `Residencial ${searchTag} Alfa`,
        activities: [],
        latitude: 0,
      });
    });

    it('answers 404 for an unknown clinic and 400 for a malformed id', async () => {
      await http()
        .get(`${CLINICS}/${randomUUID()}`)
        .set('Authorization', `Bearer ${tokens.guardian}`)
        .expect(404);
      await http()
        .get(`${CLINICS}/not-a-uuid`)
        .set('Authorization', `Bearer ${tokens.guardian}`)
        .expect(400);
    });
  });

  describe('PATCH /clinics/:id', () => {
    it('lets a nurse edit her own clinic, keeping the fields not sent', async () => {
      const response = await http()
        .patch(`${CLINICS}/${clinicId}`)
        .set('Authorization', `Bearer ${tokens.nurse}`)
        .send({
          phone: '(61) 3333-1010',
          activities: ['Fisioterapia', 'Atividades recreativas'],
          latitude: -15.8344,
          longitude: -48.0262,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: clinicId,
        name: `Residencial ${searchTag} Alfa`,
        address: 'Rua Teste, 1',
        phone: '(61) 3333-1010',
        activities: ['Fisioterapia', 'Atividades recreativas'],
        latitude: -15.8344,
        longitude: -48.0262,
      });
    });

    it('refuses caregivers, guardians and other clinics', async () => {
      const patch = (token: string, id = clinicId) =>
        http()
          .patch(`${CLINICS}/${id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Hijacked' });

      await patch(tokens.caregiver).expect(403);
      await patch(tokens.guardian).expect(403);
      await patch(tokens.nurse, otherClinicId).expect(403);
    });

    it('rejects invalid fields and the photo path', async () => {
      const response = await http()
        .patch(`${CLINICS}/${clinicId}`)
        .set('Authorization', `Bearer ${tokens.nurse}`)
        .send({ latitude: 120, name: '', photoPath: '/tmp/photo.png' })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'property photoPath should not exist',
          'latitude must be a latitude string or number',
          'name should not be empty',
        ]),
      );
    });
  });
});
