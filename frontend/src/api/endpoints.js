import { request } from './client.js';

/** One function per endpoint. Components never build URLs themselves. */

export const authApi = {
  login: (credentials) => request({ method: 'post', url: '/auth/login', data: credentials }),
  logout: () => request({ method: 'post', url: '/auth/logout' }),
  me: () => request({ url: '/auth/me' }),
};

export const departmentApi = {
  list: () => request({ url: '/departments' }),
  create: (data) => request({ method: 'post', url: '/departments', data }),
};

export const doctorApi = {
  list: (params) => request({ url: '/doctors', params }),
  getSchedule: (id) => request({ url: `/doctors/${id}/schedule` }),
  saveSchedule: (id, data) => request({ method: 'put', url: `/doctors/${id}/schedule`, data }),
};

export const userApi = {
  list: (params) => request({ url: '/users', params }),
  create: (data) => request({ method: 'post', url: '/users', data }),
};

export const slotApi = {
  list: (params) => request({ url: '/slots', params }),
};

export const patientApi = {
  search: (q) => request({ url: '/patients/search', params: { q } }),
  get: (id) => request({ url: `/patients/${id}` }),
};

export const appointmentApi = {
  list: (params) => request({ url: '/appointments', params }),
  stats: (date) => request({ url: '/appointments/stats', params: { date } }),
  get: (id) => request({ url: `/appointments/${id}` }),
  create: (data) => request({ method: 'post', url: '/appointments', data }),
  update: (id, data) => request({ method: 'put', url: `/appointments/${id}`, data }),
  cancel: (id, reason) => request({ method: 'delete', url: `/appointments/${id}`, data: reason ? { reason } : {} }),
  arrive: (id) => request({ method: 'post', url: `/appointments/${id}/arrive` }),
  complete: (id) => request({ method: 'post', url: `/appointments/${id}/complete` }),
};
