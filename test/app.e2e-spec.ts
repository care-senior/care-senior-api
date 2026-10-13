import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('AppController (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('redirects the root to the API docs without requiring a token', () => {
    return request(testApp.app.getHttpServer())
      .get('/')
      .expect(302)
      .expect('Location', '/api/docs');
  });

  it('keeps every other route under the api prefix', () => {
    return request(testApp.app.getHttpServer()).get('/clinics').expect(404);
  });
});
