import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, LogIn, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { appointmentApi } from '../../api/endpoints.js';
import { queryKeys } from '../../api/queryKeys.js';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field, Textarea } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { ErrorState } from '../../components/ui/States.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES, STATUS } from '../../lib/constants.js';
import { formatDate, formatDateTime, formatTime, todayISO } from '../../lib/date.js';
import { useAppointmentActions } from './useAppointmentActions.js';

const { SUPER_ADMIN, RECEPTIONIST, DOCTOR } = ROLES;

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="border-b border-slate-100 py-4 first:pt-0 last:border-0">
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** Front desk edits purpose/notes; the doctor edits consultation notes. Mirrors the API rules. */
function EditForm({ appointment, role, onSave, saving }) {
  const isDoctor = role === DOCTOR;
  const fields = isDoctor ? ['consultationNotes'] : ['purpose', 'notes'];
  const defaults = Object.fromEntries(fields.map((f) => [f, appointment[f] ?? '']));
  const { register, handleSubmit, reset, formState } = useForm({ defaultValues: defaults });

  // Keep the form in sync when a live update brings newer data and the user has not typed.
  useEffect(() => {
    if (!formState.isDirty) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment.updatedAt]);

  const submit = handleSubmit((values) => {
    const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== defaults[key]));
    if (Object.keys(changes).length) onSave(changes, () => reset(values));
  });

  return (
    <form onSubmit={submit} className="space-y-3">
      {isDoctor ? (
        <Field label="Consultation notes">
          {(aria) => <Textarea rows={6} {...aria} {...register('consultationNotes', { maxLength: 5000 })} />}
        </Field>
      ) : (
        <>
          <Field label="Purpose of visit">
            {(aria) => <Textarea rows={2} {...aria} {...register('purpose', { required: true, minLength: 2, maxLength: 500 })} />}
          </Field>
          <Field label="Notes">{(aria) => <Textarea rows={3} {...aria} {...register('notes', { maxLength: 2000 })} />}</Field>
        </>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="secondary" disabled={!formState.isDirty} loading={saving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

export function AppointmentDrawer({ appointmentId, onClose }) {
  const { user } = useAuth();
  const actions = useAppointmentActions();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  const query = useQuery({
    queryKey: queryKeys.appointment(appointmentId),
    queryFn: () => appointmentApi.get(appointmentId),
    enabled: Boolean(appointmentId),
  });
  const appointment = query.data?.data;

  const role = user.role;
  const isFrontDesk = role === SUPER_ADMIN || role === RECEPTIONIST;
  const status = appointment?.status;

  const canArrive = isFrontDesk && status === STATUS.SCHEDULED;
  const arrivalTooEarly = canArrive && appointment.date > todayISO();
  const canCancel = isFrontDesk && status === STATUS.SCHEDULED;
  const canComplete = (role === DOCTOR || role === SUPER_ADMIN) && status === STATUS.ARRIVED;
  const canEdit = isFrontDesk
    ? [STATUS.SCHEDULED, STATUS.ARRIVED].includes(status)
    : role === DOCTOR && [STATUS.ARRIVED, STATUS.COMPLETED].includes(status);

  const close = () => {
    setCancelling(false);
    setReason('');
    onClose();
  };

  const footer = appointment && (canArrive || canCancel || canComplete) && (
    <>
      {canCancel && !cancelling && (
        <Button variant="ghost" className="mr-auto text-rose-600 hover:text-rose-700" onClick={() => setCancelling(true)}>
          <XCircle className="size-4" /> Cancel appointment
        </Button>
      )}
      {canArrive && (
        <Button
          onClick={() => actions.arrive.mutate(appointment._id)}
          loading={actions.arrive.isPending}
          disabled={arrivalTooEarly}
          title={arrivalTooEarly ? 'Patients can be checked in on the day of the appointment' : undefined}
        >
          <LogIn className="size-4" /> Mark arrived
        </Button>
      )}
      {canComplete && (
        <Button onClick={() => actions.complete.mutate(appointment._id)} loading={actions.complete.isPending}>
          <CheckCircle2 className="size-4" /> Mark completed
        </Button>
      )}
    </>
  );

  return (
    <Modal
      open={Boolean(appointmentId)}
      onClose={close}
      variant="drawer"
      title="Appointment details"
      description={appointment && `${formatDate(appointment.date)} · ${formatTime(appointment.slotStartTime)}`}
      footer={footer}
    >
      {query.isPending && <PageLoader />}
      {query.isError && <ErrorState error={query.error} onRetry={query.refetch} />}

      {appointment && (
        <div>
          {cancelling && (
            <div className="mb-4 rounded-lg bg-rose-50 p-3 ring-1 ring-rose-200">
              <Field label="Reason for cancellation (optional)">
                {(aria) => <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} {...aria} />}
              </Field>
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setCancelling(false)}>
                  Keep appointment
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={actions.cancel.isPending}
                  onClick={() =>
                    actions.cancel.mutate({ id: appointment._id, reason: reason.trim() }, { onSuccess: () => setCancelling(false) })
                  }
                >
                  Confirm cancellation
                </Button>
              </div>
            </div>
          )}

          <Section title="Appointment">
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Status">
                <StatusBadge status={appointment.status} />
              </Detail>
              <Detail label="Time">
                {formatTime(appointment.slotStartTime)} – {formatTime(appointment.slotEndTime)}
              </Detail>
              <Detail label="Doctor">{appointment.doctor?.name}</Detail>
              <Detail label="Department">{appointment.department?.name}</Detail>
              <Detail label="Purpose">{appointment.purpose}</Detail>
              <Detail label="Booked">{formatDateTime(appointment.createdAt)}</Detail>
              {appointment.arrivedAt && <Detail label="Arrived at">{formatDateTime(appointment.arrivedAt)}</Detail>}
              {appointment.completedAt && <Detail label="Completed at">{formatDateTime(appointment.completedAt)}</Detail>}
              {appointment.cancelledAt && <Detail label="Cancelled at">{formatDateTime(appointment.cancelledAt)}</Detail>}
              {appointment.cancellationReason && <Detail label="Cancellation reason">{appointment.cancellationReason}</Detail>}
            </dl>
          </Section>

          <Section title="Patient">
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Name">{appointment.patient?.name}</Detail>
              <Detail label="Patient ID">{appointment.patient?.patientCode}</Detail>
              <Detail label="Mobile">{appointment.patient?.mobile}</Detail>
              <Detail label="Gender">{appointment.patient?.gender?.toLowerCase()}</Detail>
              <Detail label="Date of birth">{appointment.patient?.dateOfBirth?.slice(0, 10)}</Detail>
              <Detail label="Email">{appointment.patient?.email}</Detail>
            </dl>
          </Section>

          {!canEdit && (appointment.notes || appointment.consultationNotes) && (
            <Section title="Notes">
              <dl className="space-y-3">
                {appointment.notes && <Detail label="Front desk notes">{appointment.notes}</Detail>}
                {appointment.consultationNotes && <Detail label="Consultation notes">{appointment.consultationNotes}</Detail>}
              </dl>
            </Section>
          )}

          {canEdit && (
            <Section title={role === DOCTOR ? 'Consultation' : 'Edit details'}>
              <EditForm
                appointment={appointment}
                role={role}
                saving={actions.update.isPending}
                onSave={(changes, done) => actions.update.mutate({ id: appointment._id, changes }, { onSuccess: done })}
              />
            </Section>
          )}
        </div>
      )}
    </Modal>
  );
}
