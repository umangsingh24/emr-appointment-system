import { describe, expect, it } from 'vitest';
import { ROLES } from '../src/config/constants.js';
import { AuditLog } from '../src/models/index.js';
import { api, bearer, createUser, loginAs, PASSWORD, useDatabase } from './helpers.js';

useDatabase();

const refreshCookie = (cookies) => cookies.find((c) => c.startsWith('refreshToken='));

describe('Authentication', () => {
  it('logs in, returns an access token and sets an httpOnly refresh cookie', async () => {
    const user = await createUser(ROLES.RECEPTIONIST);
    const res = await api().post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { accessToken: expect.any(String) } });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(refreshCookie(res.headers['set-cookie'])).toMatch(/HttpOnly/);
  });

  it('rejects bad credentials with a generic message and audits the attempt', async () => {
    const user = await createUser(ROLES.RECEPTIONIST);
    const wrongPassword = await api().post('/api/v1/auth/login').send({ email: user.email, password: 'nope' });
    const unknownEmail = await api().post('/api/v1/auth/login').send({ email: 'ghost@test.local', password: 'nope' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);

    await new Promise((r) => setTimeout(r, 50)); // audit writes are fire-and-forget
    expect(await AuditLog.countDocuments({ action: 'LOGIN_FAILED' })).toBe(2);
  });

  it('validates the login body', async () => {
    const res = await api().post('/api/v1/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.meta.details.map((d) => d.field)).toEqual(expect.arrayContaining(['body.email', 'body.password']));
  });

  it('protects APIs without a valid access token', async () => {
    expect((await api().get('/api/v1/appointments')).status).toBe(401);
    expect((await api().get('/api/v1/appointments').set(bearer('garbage'))).status).toBe(401);
  });

  it('rotates the refresh token and revokes the family when an old token is reused', async () => {
    const user = await createUser(ROLES.RECEPTIONIST);
    const { cookies } = await loginAs(user);
    const original = refreshCookie(cookies);

    const first = await api().post('/api/v1/auth/refresh').set('Cookie', original);
    expect(first.status).toBe(200);
    const rotated = refreshCookie(first.headers['set-cookie']);
    expect(rotated).not.toBe(original);

    // Replaying the original (already rotated) token is treated as theft...
    const replay = await api().post('/api/v1/auth/refresh').set('Cookie', original);
    expect(replay.status).toBe(401);

    // ...and the legitimate rotated token is revoked too.
    const afterReuse = await api().post('/api/v1/auth/refresh').set('Cookie', rotated);
    expect(afterReuse.status).toBe(401);
  });

  it('invalidates the refresh token on logout', async () => {
    const user = await createUser(ROLES.DOCTOR);
    const { cookies } = await loginAs(user);
    const cookie = refreshCookie(cookies);

    const logout = await api().post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);

    const refresh = await api().post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refresh.status).toBe(401);
  });
});

describe('Role-based access control', () => {
  it('only lets Super Admin create staff accounts', async () => {
    const admin = await createUser(ROLES.SUPER_ADMIN);
    const receptionist = await createUser(ROLES.RECEPTIONIST);
    const body = { name: 'New Receptionist', email: 'new@test.local', password: 'Secret123', role: ROLES.RECEPTIONIST };

    const denied = await api().post('/api/v1/users').set(bearer((await loginAs(receptionist)).token)).send(body);
    expect(denied.status).toBe(403);

    const created = await api().post('/api/v1/users').set(bearer((await loginAs(admin)).token)).send(body);
    expect(created.status).toBe(201);
    expect(created.body.data.passwordHash).toBeUndefined();
  });

  it('does not allow creating another Super Admin through the API', async () => {
    const admin = await createUser(ROLES.SUPER_ADMIN);
    const res = await api()
      .post('/api/v1/users')
      .set(bearer((await loginAs(admin)).token))
      .send({ name: 'Sneaky', email: 'sneaky@test.local', password: 'Secret123', role: ROLES.SUPER_ADMIN });
    expect(res.status).toBe(400);
  });
});
