import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarPlus, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { appointmentApi } from '../../api/endpoints.js';
import { queryKeys } from '../../api/queryKeys.js';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSearchParamsState } from '../../hooks/useSearchParamsState.js';
import { PAGE_SIZE, ROLES } from '../../lib/constants.js';
import { formatDate, formatTime } from '../../lib/date.js';
import { AppointmentDrawer } from './AppointmentDrawer.jsx';
import { AppointmentFilters } from './AppointmentFilters.jsx';

const DEFAULT_SORT = '-date,slotStart';
const FILTER_KEYS = ['search', 'status', 'departmentId', 'doctorId', 'dateFrom', 'dateTo'];

/** Column sort: clicking cycles ascending → descending. Date sorts keep time ascending within a day. */
function SortHeader({ label, field, sort, onSort, className }) {
  const primary = sort.split(',')[0];
  const active = primary.replace('-', '') === field;
  const descending = primary.startsWith('-');
  const Icon = !active ? ArrowUpDown : descending ? ArrowDown : ArrowUp;
  const next = active && !descending ? `-${field}` : field;

  return (
    <th scope="col" className={clsx('px-4 py-3 text-left', className)} aria-sort={active ? (descending ? 'descending' : 'ascending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(field === 'date' ? `${next},slotStart` : next)}
        className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-slate-500 uppercase hover:text-slate-900"
      >
        {label}
        <Icon className={clsx('size-3.5', active ? 'text-brand-700' : 'text-slate-300')} aria-hidden="true" />
      </button>
    </th>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-5" aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [openId, setOpenId] = useState(null);
  const isDoctor = user.role === ROLES.DOCTOR;
  const canBook = user.role === ROLES.SUPER_ADMIN || user.role === ROLES.RECEPTIONIST;

  const [filters, setFilters] = useSearchParamsState({ page: '1', sort: DEFAULT_SORT });

  // Only send what is set; this object is also the query key, so equal filters share a cache entry.
  const params = { page: filters.page, limit: PAGE_SIZE, sort: filters.sort };
  for (const key of FILTER_KEYS) if (filters[key]) params[key] = filters[key];

  const query = useQuery({
    queryKey: queryKeys.appointmentList(params),
    queryFn: () => appointmentApi.list(params),
    placeholderData: keepPreviousData, // no flash of empty table between pages
  });

  const rows = query.data?.data ?? [];

  return (
    <>
      <PageHeader
        title={isDoctor ? 'My appointments' : 'Appointments'}
        description="Search, filter and manage appointments."
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

      <Card>
        <AppointmentFilters filters={filters} onChange={setFilters} showDoctorFilters={!isDoctor} />

        <div className="border-t border-slate-100">
          {query.isPending ? (
            <TableSkeleton />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={query.refetch} />
          ) : rows.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No appointments found" description="Try changing or clearing the filters." />
          ) : (
            <div className={clsx(query.isPlaceholderData && 'opacity-60 transition-opacity')}>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50/60">
                    <tr>
                      <SortHeader label="Date & time" field="date" sort={filters.sort} onSort={(sort) => setFilters({ sort })} />
                      <SortHeader label="Patient" field="patientName" sort={filters.sort} onSort={(sort) => setFilters({ sort })} />
                      {!isDoctor && (
                        <SortHeader label="Doctor" field="doctorName" sort={filters.sort} onSort={(sort) => setFilters({ sort })} />
                      )}
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        Purpose
                      </th>
                      <SortHeader label="Status" field="status" sort={filters.sort} onSort={(sort) => setFilters({ sort })} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((appt) => (
                      <tr
                        key={appt._id}
                        onClick={() => setOpenId(appt._id)}
                        className="cursor-pointer hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button type="button" className="text-left" onClick={() => setOpenId(appt._id)}>
                            <span className="block font-medium text-slate-900">{formatDate(appt.date)}</span>
                            <span className="text-xs text-slate-500">{formatTime(appt.slotStartTime)}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block font-medium text-slate-900">{appt.patientSnapshot.name}</span>
                          <span className="text-xs text-slate-500">
                            {appt.patientSnapshot.patientCode} · {appt.patientSnapshot.mobile}
                          </span>
                        </td>
                        {!isDoctor && (
                          <td className="px-4 py-3">
                            <span className="block text-slate-900">{appt.doctorSnapshot.name}</span>
                            <span className="text-xs text-slate-500">{appt.department?.name}</span>
                          </td>
                        )}
                        <td className="max-w-56 truncate px-4 py-3 text-slate-600">{appt.purpose}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={appt.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {rows.map((appt) => (
                  <li key={appt._id}>
                    <button type="button" onClick={() => setOpenId(appt._id)} className="w-full px-4 py-3 text-left hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{appt.patientSnapshot.name}</p>
                          <p className="text-xs text-slate-500">
                            {formatDate(appt.date, { short: true })} · {formatTime(appt.slotStartTime)}
                            {!isDoctor && ` · ${appt.doctorSnapshot.name}`}
                          </p>
                        </div>
                        <StatusBadge status={appt.status} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <Pagination meta={query.data?.meta} disabled={query.isPlaceholderData} onPageChange={(page) => setFilters({ page })} />
      </Card>

      <AppointmentDrawer appointmentId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
