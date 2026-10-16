import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { CalendarCheck2, CalendarPlus, CheckCircle2, Clock3, UserCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { appointmentApi } from '../../api/endpoints.js';
import { queryKeys } from '../../api/queryKeys.js';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useScheduleRoom } from '../../hooks/useScheduleRoom.js';
import { ROLES, STATUS } from '../../lib/constants.js';
import { formatDate, formatTime, todayISO } from '../../lib/date.js';
import { AppointmentDrawer } from '../appointments/AppointmentDrawer.jsx';

const STAT_CARDS = [
  { key: 'total', label: 'Total today', icon: CalendarCheck2, accent: 'text-brand-700 bg-brand-50' },
  { key: STATUS.SCHEDULED, label: 'Scheduled', icon: Clock3, accent: 'text-sky-700 bg-sky-50' },
  { key: STATUS.ARRIVED, label: 'Arrived / waiting', icon: UserCheck, accent: 'text-amber-700 bg-amber-50' },
  { key: STATUS.COMPLETED, label: 'Completed', icon: CheckCircle2, accent: 'text-emerald-700 bg-emerald-50' },
  { key: STATUS.CANCELLED, label: 'Cancelled', icon: XCircle, accent: 'text-slate-600 bg-slate-100' },
];

function StatCards({ stats, loading }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {STAT_CARDS.map(({ key, label, icon: Icon, accent }) => (
        <Card key={key} className="p-4">
          <div className="flex items-center gap-3">
            <span className={clsx('flex size-9 items-center justify-center rounded-lg', accent)}>
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
            <p className="text-xs font-medium text-slate-500">{label}</p>
          </div>
          {loading ? (
            <Skeleton className="mt-3 h-7 w-12" />
          ) : (
            <p className="mt-3 text-2xl font-semibold text-slate-900 tabular-nums">
              {key === 'total' ? stats.total : stats.byStatus[key]}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}

function DepartmentBreakdown({ departments }) {
  const max = Math.max(1, ...departments.map((d) => d.count));
  return (
    <Card>
      <CardHeader title="By department" description="Active appointments today" />
      {departments.length === 0 ? (
        <EmptyState title="No appointments today" />
      ) : (
        <ul className="space-y-3 px-5 py-4">
          {departments.map((dept) => (
            <li key={dept.departmentId}>
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">{dept.name}</span>
                <span className="font-medium text-slate-900 tabular-nums">{dept.count}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(dept.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TodayQueue({ date, isDoctor, onOpen }) {
  const params = { dateFrom: date, dateTo: date, status: 'SCHEDULED,ARRIVED', sort: 'slotStart', limit: 8 };
  const query = useQuery({
    queryKey: queryKeys.appointmentList(params),
    queryFn: () => appointmentApi.list(params),
  });

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title={isDoctor ? 'My queue today' : "Today's queue"}
        description="Upcoming and waiting patients"
        actions={
          <Link to={`/appointments?dateFrom=${date}&dateTo=${date}`} className="text-xs font-medium text-brand-700 hover:underline">
            View all
          </Link>
        }
      />
      {query.isPending ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.data.length === 0 ? (
        <EmptyState title="No patients waiting" description="Nothing scheduled for the rest of today." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {query.data.data.map((appt) => (
            <li key={appt._id}>
              <button
                type="button"
                onClick={() => onOpen(appt._id)}
                className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-slate-50"
              >
                <span className="w-16 shrink-0 text-sm font-medium text-slate-900 tabular-nums">{formatTime(appt.slotStartTime)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{appt.patientSnapshot.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {isDoctor ? appt.purpose : `${appt.doctorSnapshot.name} · ${appt.department?.name ?? ''}`}
                  </span>
                </span>
                <StatusBadge status={appt.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [openId, setOpenId] = useState(null);
  const date = todayISO();
  const isDoctor = user.role === ROLES.DOCTOR;
  const canBook = user.role === ROLES.SUPER_ADMIN || user.role === ROLES.RECEPTIONIST;

  // Doctors get live updates for their own day; staff already receive every change.
  useScheduleRoom({ doctorId: isDoctor ? user._id : undefined, date });

  const stats = useQuery({
    queryKey: queryKeys.stats(date),
    queryFn: () => appointmentApi.stats(date),
    select: (response) => response.data,
  });

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name}`}
        description={formatDate(date)}
        actions={
          canBook && (
            <Link to="/appointments/new">
              <Button>
                <CalendarPlus className="size-4" /> Book appointment
              </Button>
            </Link>
          )
        }
      />

      {stats.isError ? (
        <Card>
          <ErrorState error={stats.error} onRetry={stats.refetch} />
        </Card>
      ) : (
        <StatCards stats={stats.data} loading={stats.isPending} />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <TodayQueue date={date} isDoctor={isDoctor} onOpen={setOpenId} />
        {!isDoctor && stats.data && <DepartmentBreakdown departments={stats.data.byDepartment} />}
      </div>

      <AppointmentDrawer appointmentId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
