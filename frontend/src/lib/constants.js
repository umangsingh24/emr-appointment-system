export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  RECEPTIONIST: 'RECEPTIONIST',
  DOCTOR: 'DOCTOR',
});

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  RECEPTIONIST: 'Receptionist',
  DOCTOR: 'Doctor',
};

export const STATUS = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  ARRIVED: 'ARRIVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const STATUS_META = {
  SCHEDULED: { label: 'Scheduled', tone: 'blue' },
  ARRIVED: { label: 'Arrived', tone: 'amber' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'slate' },
};

export const SLOT_STATUS = Object.freeze({ AVAILABLE: 'AVAILABLE', BOOKED: 'BOOKED', PAST: 'PAST' });

export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
export const WEEKDAY_LABELS = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' };

export const SOCKET_EVENTS = Object.freeze({
  JOIN_SCHEDULE: 'schedule:join',
  LEAVE_SCHEDULE: 'schedule:leave',
  APPOINTMENT_CREATED: 'appointment:created',
  APPOINTMENT_UPDATED: 'appointment:updated',
  APPOINTMENT_CANCELLED: 'appointment:cancelled',
});

export const PAGE_SIZE = 10;
