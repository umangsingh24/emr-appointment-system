/**
 * Central query-key factory. Keys are hierarchical so one invalidation can target
 * "every appointment list" or "slots for one date" precisely.
 */
export const queryKeys = {
  departments: ['departments'],
  doctors: (params = {}) => ['doctors', params],
  schedule: (doctorId) => ['schedule', doctorId],
  users: (params = {}) => ['users', params],
  slots: (params) => ['slots', params.date, params],
  slotsForDate: (date) => ['slots', date],
  patientSearch: (q) => ['patients', 'search', q],
  appointments: ['appointments'],
  appointmentList: (params) => ['appointments', 'list', params],
  appointment: (id) => ['appointments', 'detail', id],
  stats: (date) => ['appointments', 'stats', date],
};
