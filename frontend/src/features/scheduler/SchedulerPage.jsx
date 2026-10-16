import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarOff, Settings2, UserRound } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { slotApi } from '../../api/endpoints.js';
import { queryKeys } from '../../api/queryKeys.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { DatePicker } from '../../components/ui/DatePicker.jsx';
import { Field, Select } from '../../components/ui/Field.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDepartments, useDoctors } from '../../hooks/useReferenceData.js';
import { useScheduleRoom } from '../../hooks/useScheduleRoom.js';
import { useSearchParamsState } from '../../hooks/useSearchParamsState.js';
import { ROLES, SLOT_STATUS } from '../../lib/constants.js';
import { formatDate, todayISO } from '../../lib/date.js';
import { AppointmentDrawer } from '../appointments/AppointmentDrawer.jsx';
import { SlotGrid, SlotLegend } from './SlotGrid.jsx';

function DoctorSchedule({ entry, canBook, canManageSchedule, onBook, onOpen }) {
  const { doctor, slots, slotDurationMinutes } = entry;
  const available = slots.filter((s) => s.status === SLOT_STATUS.AVAILABLE).length;

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <UserRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{doctor.name}</h2>
            <p className="text-xs text-slate-500">
              {[doctor.specialization, doctor.department?.name].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        {entry.isWorkingDay && (
          <div className="flex gap-2">
            <Badge tone="brand">{available} available</Badge>
            <Badge>{slotDurationMinutes} min slots</Badge>
          </div>
        )}
      </div>

      {entry.isWorkingDay ? (
        <SlotGrid doctorId={doctor._id} slots={slots} canBook={canBook} onBook={onBook} onOpen={onOpen} />
      ) : slotDurationMinutes ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">Not working on this day.</p>
      ) : (
        // No schedule at all: slots are generated from working hours, so there is nothing to book yet.
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <p className="text-sm text-amber-900">
            No working hours set yet, so this doctor has no bookable slots.
            {!canManageSchedule && ' Ask a Super Admin to set up the schedule.'}
          </p>
          {canManageSchedule && (
            <Link
              to={`/admin/schedules?doctor=${doctor._id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100"
            >
              <Settings2 className="size-3.5" aria-hidden="true" /> Set schedule
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}

export default function SchedulerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(null);
  const isDoctor = user.role === ROLES.DOCTOR;
  const canBook = user.role === ROLES.SUPER_ADMIN || user.role === ROLES.RECEPTIONIST;

  const [filters, setFilters] = useSearchParamsState({ date: todayISO(), department: '', doctor: '' });
  const departments = useDepartments();
  const doctors = useDoctors({ department: filters.department }, { enabled: !isDoctor });

  // Doctors always see their own grid. Staff default to the first department.
  const departmentId = isDoctor ? undefined : filters.department || departments.data?.[0]?._id;
  const doctorId = isDoctor ? user._id : filters.doctor || undefined;
  const params = { date: filters.date, ...(doctorId ? { doctorId } : { departmentId }) };
  const ready = Boolean(doctorId || departmentId);

  const slots = useQuery({
    queryKey: queryKeys.slots(params),
    queryFn: () => slotApi.list(params),
    select: (response) => response.data,
    enabled: ready,
    placeholderData: keepPreviousData, // keep the old grid visible while the next date loads
  });

  useScheduleRoom({ doctorId, departmentId: doctorId ? undefined : departmentId, date: filters.date });

  // Stable callbacks so memoised slot cells do not re-render on every parent render.
  const onBook = useCallback(
    (slotDoctorId, slotStart) =>
      navigate(`/appointments/new?doctorId=${slotDoctorId}&date=${filters.date}&slot=${slotStart}`),
    [navigate, filters.date],
  );
  const onOpen = useCallback((appointmentId) => setOpenId(appointmentId), []);

  return (
    <>
      <PageHeader
        title={isDoctor ? 'My schedule' : 'Appointment scheduler'}
        description={canBook ? 'Pick a free slot to book it, or a booked slot to see details.' : formatDate(filters.date)}
      />

      <Card className="mb-6 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end">
          {!isDoctor && (
            <>
              <Field label="Department">
                {(aria) => (
                  <Select
                    {...aria}
                    value={departmentId ?? ''}
                    onChange={(e) => setFilters({ department: e.target.value, doctor: '' })}
                    disabled={departments.isPending}
                  >
                    {departments.data?.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Doctor">
                {(aria) => (
                  <Select {...aria} value={filters.doctor} onChange={(e) => setFilters({ doctor: e.target.value })}>
                    <option value="">All doctors in department</option>
                    {doctors.data
                      ?.filter((d) => !departmentId || d.department?._id === departmentId)
                      .map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.name}
                        </option>
                      ))}
                  </Select>
                )}
              </Field>
            </>
          )}
          <DatePicker value={filters.date} onChange={(date) => setFilters({ date })} />
          <div className="sm:col-span-2 lg:col-span-1 lg:pb-2.5">
            <SlotLegend />
          </div>
        </div>
      </Card>

      {departments.isError && <ErrorState error={departments.error} onRetry={departments.refetch} />}

      {slots.isError ? (
        <Card>
          <ErrorState error={slots.error} onRetry={slots.refetch} />
        </Card>
      ) : !ready || slots.isPending ? (
        <Card className="space-y-3 p-5" aria-busy="true">
          <Skeleton className="h-10 w-56" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
            {Array.from({ length: 18 }, (_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        </Card>
      ) : slots.data.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarOff} title="No doctors found" description="This department has no active doctors." />
        </Card>
      ) : (
        <div className={slots.isPlaceholderData ? 'space-y-4 opacity-60 transition-opacity' : 'space-y-4'}>
          {slots.data.map((entry) => (
            <DoctorSchedule
              key={entry.doctor._id}
              entry={entry}
              canBook={canBook}
              canManageSchedule={user.role === ROLES.SUPER_ADMIN}
              onBook={onBook}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}

      <AppointmentDrawer appointmentId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
