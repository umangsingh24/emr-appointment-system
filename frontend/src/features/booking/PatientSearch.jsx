import { useQuery } from '@tanstack/react-query';
import { Search, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { patientApi } from '../../api/endpoints.js';
import { queryKeys } from '../../api/queryKeys.js';
import { Button } from '../../components/ui/Button.jsx';
import { Field, Input } from '../../components/ui/Field.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { getErrorMessage } from '../../lib/errors.js';

/**
 * Search existing patients by patient ID (PT-000042), mobile number or name.
 * Debounced so typing "anil" sends one request, not four.
 */
export function PatientSearch({ selected, onSelect, error }) {
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term.trim(), 300);
  const enabled = debounced.length >= 2 && !selected;

  const results = useQuery({
    queryKey: queryKeys.patientSearch(debounced),
    queryFn: () => patientApi.search(debounced),
    select: (response) => response.data,
    enabled,
    staleTime: 60_000,
  });

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-brand-50 p-3 ring-1 ring-brand-200">
        <div className="flex min-w-0 items-center gap-3">
          <UserRound className="size-5 shrink-0 text-brand-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{selected.name}</p>
            <p className="text-xs text-slate-600">
              {selected.patientCode} · {selected.mobile}
            </p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => onSelect(null)}>
          <X className="size-4" /> Change
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Field label="Find patient" hint="Search by patient ID, mobile number or name" error={error}>
        {(aria) => (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
              {...aria}
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="e.g. PT-000001, 98765 or Anil"
              className="pl-9"
              autoComplete="off"
              error={error}
            />
            {results.isFetching && <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" />}
          </div>
        )}
      </Field>

      {enabled && !results.isPending && (
        <div className="mt-2 overflow-hidden rounded-lg ring-1 ring-slate-200" aria-live="polite">
          {results.isError ? (
            <p className="px-3 py-2 text-sm text-rose-600">{getErrorMessage(results.error)}</p>
          ) : results.data.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">No patients match “{debounced}”. Register them as a new patient.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {results.data.map((patient) => (
                <li key={patient._id}>
                  <button
                    type="button"
                    onClick={() => onSelect(patient)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">{patient.name}</span>
                      <span className="text-xs text-slate-500">{patient.mobile}</span>
                    </span>
                    <span className="text-xs font-medium text-slate-500">{patient.patientCode}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
