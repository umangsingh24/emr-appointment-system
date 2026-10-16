import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Field, Input, Select } from '../../components/ui/Field.jsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useDepartments, useDoctors } from '../../hooks/useReferenceData.js';
import { STATUS, STATUS_META } from '../../lib/constants.js';

/**
 * Filter bar. Free-text inputs are debounced before they touch the URL (and therefore the
 * query key), so typing does not fire a request per keystroke.
 */
export function AppointmentFilters({ filters, onChange, showDoctorFilters }) {
  const [search, setSearch] = useState(filters.search ?? '');
  const debouncedSearch = useDebouncedValue(search, 350);

  useEffect(() => {
    if ((filters.search ?? '') !== debouncedSearch) onChange({ search: debouncedSearch.trim() });
    // Only react to the user's typing, not to URL changes we caused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const departments = useDepartments();
  const doctors = useDoctors({ department: filters.departmentId }, { enabled: showDoctorFilters });

  const hasFilters = ['search', 'status', 'departmentId', 'doctorId', 'dateFrom', 'dateTo'].some((key) => filters[key]);

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
      <Field label="Search" className="sm:col-span-2">
        {(aria) => (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
              {...aria}
              type="search"
              className="pl-9"
              placeholder="Patient name, mobile or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </Field>

      <Field label="Status">
        {(aria) => (
          <Select {...aria} value={filters.status ?? ''} onChange={(e) => onChange({ status: e.target.value })}>
            <option value="">All statuses</option>
            {Object.values(STATUS).map((status) => (
              <option key={status} value={status}>
                {STATUS_META[status].label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {showDoctorFilters && (
        <>
          <Field label="Department">
            {(aria) => (
              <Select {...aria} value={filters.departmentId ?? ''} onChange={(e) => onChange({ departmentId: e.target.value, doctorId: '' })}>
                <option value="">All departments</option>
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
              <Select {...aria} value={filters.doctorId ?? ''} onChange={(e) => onChange({ doctorId: e.target.value })}>
                <option value="">All doctors</option>
                {doctors.data?.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </>
      )}

      <div className={showDoctorFilters ? 'grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-2' : 'grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-3'}>
        <Field label="From">
          {(aria) => (
            <Input
              {...aria}
              type="date"
              value={filters.dateFrom ?? ''}
              max={filters.dateTo || undefined}
              onChange={(e) => onChange({ dateFrom: e.target.value })}
            />
          )}
        </Field>
        <Field label="To">
          {(aria) => (
            <Input
              {...aria}
              type="date"
              value={filters.dateTo ?? ''}
              min={filters.dateFrom || undefined}
              onChange={(e) => onChange({ dateTo: e.target.value })}
            />
          )}
        </Field>
      </div>

      {hasFilters && (
        <div className="lg:col-span-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              onChange({ search: '', status: '', departmentId: '', doctorId: '', dateFrom: '', dateTo: '' });
            }}
          >
            <X className="size-3.5" /> Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
