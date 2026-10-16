import { useQuery } from '@tanstack/react-query';
import { CalendarCog } from 'lucide-react';
import { doctorApi } from '../../api/endpoints.js';
import { queryKeys } from '../../api/queryKeys.js';
import { Card } from '../../components/ui/Card.jsx';
import { Field, Select } from '../../components/ui/Field.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { EmptyState, ErrorState } from '../../components/ui/States.jsx';
import { useDoctors } from '../../hooks/useReferenceData.js';
import { useSearchParamsState } from '../../hooks/useSearchParamsState.js';
import { ScheduleEditor } from './ScheduleEditor.jsx';

export default function SchedulesPage() {
  const [filters, setFilters] = useSearchParamsState({ doctor: '' });
  const doctors = useDoctors();
  const doctor = doctors.data?.find((d) => d._id === filters.doctor);

  const schedule = useQuery({
    queryKey: queryKeys.schedule(filters.doctor),
    queryFn: () => doctorApi.getSchedule(filters.doctor),
    enabled: Boolean(doctor),
  });

  return (
    <>
      <PageHeader
        title="Doctor schedules"
        description="Working days, sessions, breaks and slot length. Slots are generated from this and never fall in a break."
      />

      <Card className="mb-6 p-4">
        <Field label="Doctor" className="max-w-md">
          {(aria) => (
            <Select {...aria} value={filters.doctor} onChange={(e) => setFilters({ doctor: e.target.value })} disabled={doctors.isPending}>
              <option value="">Select a doctor…</option>
              {doctors.data?.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} — {d.department?.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Card>

      {!doctor ? (
        <Card>
          <EmptyState icon={CalendarCog} title="Choose a doctor" description="Select a doctor to view or edit their weekly schedule." />
        </Card>
      ) : schedule.isPending ? (
        <PageLoader />
      ) : schedule.isError ? (
        <Card>
          <ErrorState error={schedule.error} onRetry={schedule.refetch} />
        </Card>
      ) : (
        // Keyed by doctor so switching doctors remounts the form with that doctor's values.
        <ScheduleEditor key={doctor._id} doctor={doctor} schedule={schedule.data.data} />
      )}
    </>
  );
}
