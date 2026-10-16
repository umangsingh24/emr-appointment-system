import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CalendarClock, UserPlus, UserSearch } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { appointmentApi, slotApi } from '../../api/endpoints.js';
import { queryKeys } from '../../api/queryKeys.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { DatePicker } from '../../components/ui/DatePicker.jsx';
import { Field, Input, Select, Textarea } from '../../components/ui/Field.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { useDepartments, useDoctors } from '../../hooks/useReferenceData.js';
import { SLOT_STATUS } from '../../lib/constants.js';
import { formatDate, formatTime, todayISO } from '../../lib/date.js';
import { applyServerFieldErrors, getErrorCode, getErrorMessage } from '../../lib/errors.js';
import { bookingSchema, toCreatePayload } from './bookingSchema.js';
import { PatientSearch } from './PatientSearch.jsx';

function ModeTab({ active, icon: Icon, children, ...props }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={clsx(
        'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
      )}
      {...props}
    >
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </button>
  );
}

export default function BookingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [department, setDepartment] = useState('');

  const today = todayISO();
  const requestedDate = searchParams.get('date');

  const form = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      doctorId: searchParams.get('doctorId') ?? '',
      date: requestedDate && requestedDate >= today ? requestedDate : today,
      slotStart: searchParams.get('slot') ?? '',
      purpose: '',
      notes: '',
      patientMode: 'existing',
      patientId: '',
      newPatient: { name: '', mobile: '', gender: '', dateOfBirth: '', email: '' },
    },
  });
  const { register, handleSubmit, control, setValue, setError, clearErrors, formState } = form;
  const { errors } = formState;
  const [doctorId, date, slotStart, patientMode] = useWatch({ control, name: ['doctorId', 'date', 'slotStart', 'patientMode'] });

  const departments = useDepartments();
  const doctors = useDoctors();
  const doctorOptions = useMemo(
    () => (doctors.data ?? []).filter((d) => !department || d.department?._id === department),
    [doctors.data, department],
  );
  const selectedDoctor = doctors.data?.find((d) => d._id === doctorId);

  const slotParams = { date, doctorId };
  const slots = useQuery({
    queryKey: queryKeys.slots(slotParams),
    queryFn: () => slotApi.list(slotParams),
    select: (response) => response.data[0]?.slots ?? [],
    enabled: Boolean(doctorId && date),
  });
  const availableSlots = useMemo(() => (slots.data ?? []).filter((s) => s.status === SLOT_STATUS.AVAILABLE), [slots.data]);

  // If the chosen slot stops being available (another user booked it, or the date changed), clear it.
  useEffect(() => {
    if (slotStart && slots.data && !availableSlots.some((s) => s.start === slotStart)) {
      setValue('slotStart', '');
      setError('slotStart', { type: 'manual', message: `${formatTime(slotStart)} is no longer available. Pick another slot.` });
    }
  }, [slotStart, slots.data, availableSlots, setValue, setError]);

  const create = useMutation({
    mutationFn: (payload) => appointmentApi.create(payload),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.slotsForDate(data.date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments });
      toast.success(`Booked ${data.patient.name} with ${data.doctor.name}`, {
        description: `${formatDate(data.date)} at ${formatTime(data.slotStartTime)} · ${data.patient.patientCode}`,
      });
      navigate(`/scheduler?date=${data.date}&department=${data.department._id}&doctor=${data.doctor._id}`);
    },
    onError: (error) => {
      if (getErrorCode(error) === 'SLOT_ALREADY_BOOKED') {
        queryClient.invalidateQueries({ queryKey: queryKeys.slotsForDate(date) });
        setValue('slotStart', '');
        setError('slotStart', { type: 'server', message: getErrorMessage(error) });
        return;
      }
      if (!applyServerFieldErrors(error, setError)) toast.error(getErrorMessage(error));
    },
  });

  const onSubmit = handleSubmit((values) => create.mutate(toCreatePayload(values)));

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    setValue('patientId', patient?._id ?? '', { shouldValidate: Boolean(patient) });
  };

  const switchMode = (mode) => {
    setValue('patientMode', mode);
    clearErrors(['patientId', 'newPatient']);
  };

  return (
    <>
      <PageHeader title="Book appointment" description="Choose a slot, identify the patient, and confirm." />

      <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="1. Doctor and time" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Department">
                {(aria) => (
                  <Select
                    {...aria}
                    value={department}
                    onChange={(e) => {
                      setDepartment(e.target.value);
                      setValue('doctorId', '');
                      setValue('slotStart', '');
                    }}
                  >
                    <option value="">All departments</option>
                    {departments.data?.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label="Doctor" required error={errors.doctorId?.message}>
                {(aria) => (
                  <Select
                    {...aria}
                    error={errors.doctorId}
                    {...register('doctorId', { onChange: () => setValue('slotStart', '') })}
                    disabled={doctors.isPending}
                  >
                    <option value="">{doctors.isPending ? 'Loading…' : 'Select a doctor'}</option>
                    {doctorOptions.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} — {d.department?.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    minDate={today}
                    onChange={(value) => {
                      field.onChange(value);
                      setValue('slotStart', '');
                    }}
                  />
                )}
              />

              <Field
                label="Time slot"
                required
                error={errors.slotStart?.message}
                hint={doctorId && slots.data && availableSlots.length === 0 ? 'No free slots on this day.' : undefined}
              >
                {(aria) => (
                  <Select
                    {...aria}
                    error={errors.slotStart}
                    {...register('slotStart')}
                    disabled={!doctorId || slots.isFetching}
                  >
                    <option value="">
                      {!doctorId ? 'Select a doctor first' : slots.isFetching ? 'Loading slots…' : 'Select a time'}
                    </option>
                    {availableSlots.map((s) => (
                      <option key={s.start} value={s.start}>
                        {formatTime(s.start)} – {formatTime(s.end)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="2. Patient" />
            <div className="space-y-4 p-5">
              <div role="tablist" className="flex gap-1 rounded-lg bg-slate-100 p-1">
                <ModeTab active={patientMode === 'existing'} icon={UserSearch} onClick={() => switchMode('existing')}>
                  Existing patient
                </ModeTab>
                <ModeTab active={patientMode === 'new'} icon={UserPlus} onClick={() => switchMode('new')}>
                  New patient
                </ModeTab>
              </div>

              {patientMode === 'existing' ? (
                <PatientSearch selected={selectedPatient} onSelect={selectPatient} error={errors.patientId?.message} />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" required error={errors.newPatient?.name?.message} className="sm:col-span-2">
                    {(aria) => <Input {...aria} error={errors.newPatient?.name} autoComplete="off" {...register('newPatient.name')} />}
                  </Field>
                  <Field label="Mobile number" required error={errors.newPatient?.mobile?.message}>
                    {(aria) => (
                      <Input {...aria} type="tel" inputMode="tel" error={errors.newPatient?.mobile} {...register('newPatient.mobile')} />
                    )}
                  </Field>
                  <Field label="Gender" error={errors.newPatient?.gender?.message}>
                    {(aria) => (
                      <Select {...aria} {...register('newPatient.gender')}>
                        <option value="">Prefer not to say</option>
                        <option value="FEMALE">Female</option>
                        <option value="MALE">Male</option>
                        <option value="OTHER">Other</option>
                      </Select>
                    )}
                  </Field>
                  <Field label="Date of birth" error={errors.newPatient?.dateOfBirth?.message}>
                    {(aria) => (
                      <Input {...aria} type="date" max={today} error={errors.newPatient?.dateOfBirth} {...register('newPatient.dateOfBirth')} />
                    )}
                  </Field>
                  <Field label="Email" error={errors.newPatient?.email?.message}>
                    {(aria) => <Input {...aria} type="email" error={errors.newPatient?.email} {...register('newPatient.email')} />}
                  </Field>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="3. Visit details" />
            <div className="space-y-4 p-5">
              <Field label="Purpose of visit" required error={errors.purpose?.message}>
                {(aria) => <Input {...aria} error={errors.purpose} placeholder="e.g. Fever for 3 days" {...register('purpose')} />}
              </Field>
              <Field label="Notes for the front desk" error={errors.notes?.message}>
                {(aria) => <Textarea {...aria} rows={3} {...register('notes')} />}
              </Field>
            </div>
          </Card>
        </div>

        <aside className="lg:col-span-2">
          <Card className="p-5 lg:sticky lg:top-24">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CalendarClock className="size-4 text-brand-700" aria-hidden="true" /> Summary
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Doctor</dt>
                <dd className="text-right font-medium text-slate-900">{selectedDoctor?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Department</dt>
                <dd className="text-right text-slate-900">{selectedDoctor?.department?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Date</dt>
                <dd className="text-right text-slate-900">{formatDate(date)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Time</dt>
                <dd className="text-right text-slate-900">{slotStart ? formatTime(slotStart) : '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Patient</dt>
                <dd className="text-right text-slate-900">
                  {patientMode === 'existing' ? selectedPatient?.name ?? '—' : 'New patient'}
                </dd>
              </div>
            </dl>
            <Button type="submit" className="mt-6 w-full" loading={create.isPending}>
              Confirm booking
            </Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </Card>
        </aside>
      </form>
    </>
  );
}
