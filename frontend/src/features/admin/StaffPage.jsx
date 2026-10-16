import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { departmentApi, userApi } from '../../api/endpoints.js';
import { queryKeys } from '../../api/queryKeys.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Field, Input, Select } from '../../components/ui/Field.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { useDepartments } from '../../hooks/useReferenceData.js';
import { useSearchParamsState } from '../../hooks/useSearchParamsState.js';
import { PAGE_SIZE, ROLE_LABELS, ROLES } from '../../lib/constants.js';
import { formatDateTime } from '../../lib/date.js';
import { applyServerFieldErrors, getErrorMessage } from '../../lib/errors.js';
import { CreateUserModal } from './CreateUserModal.jsx';

const ROLE_TONES = { SUPER_ADMIN: 'rose', RECEPTIONIST: 'amber', DOCTOR: 'brand' };

const departmentSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(100),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{2,20}$/, '2–20 letters, digits, "_" or "-"'),
});

function DepartmentsCard() {
  const queryClient = useQueryClient();
  const departments = useDepartments();
  const { register, handleSubmit, reset, setError, formState } = useForm({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: '', code: '' },
  });

  const create = useMutation({
    mutationFn: departmentApi.create,
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments });
      toast.success(`${data.name} added`);
      reset();
    },
    onError: (error) => {
      if (error?.response?.status === 409) setError('name', { message: getErrorMessage(error) });
      else if (!applyServerFieldErrors(error, setError)) toast.error(getErrorMessage(error));
    },
  });

  return (
    <Card>
      <CardHeader title="Departments" />
      <ul className="flex flex-wrap gap-2 px-5 pt-4">
        {departments.isPending && <Skeleton className="h-6 w-40" />}
        {departments.data?.map((d) => (
          <li key={d._id}>
            <Badge tone="slate">
              {d.name} <span className="ml-1 text-slate-400">{d.code}</span>
            </Badge>
          </li>
        ))}
      </ul>
      <form noValidate onSubmit={handleSubmit((values) => create.mutate(values))} className="grid gap-3 p-5 sm:grid-cols-[1fr_8rem_auto] sm:items-start">
        <Field error={formState.errors.name?.message}>
          {(aria) => <Input {...aria} placeholder="New department name" aria-label="Department name" error={formState.errors.name} {...register('name')} />}
        </Field>
        <Field error={formState.errors.code?.message}>
          {(aria) => <Input {...aria} placeholder="Code" aria-label="Department code" error={formState.errors.code} {...register('code')} />}
        </Field>
        <Button type="submit" variant="secondary" loading={create.isPending}>
          <Building2 className="size-4" /> Add
        </Button>
      </form>
    </Card>
  );
}

export default function StaffPage() {
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useSearchParamsState({ page: '1' });
  const params = { page: filters.page, limit: PAGE_SIZE, ...(filters.role ? { role: filters.role } : {}), sort: 'name' };

  const users = useQuery({
    queryKey: queryKeys.users(params),
    queryFn: () => userApi.list(params),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Staff"
        description="Doctors and receptionists who can sign in."
        actions={
          <Button onClick={() => setCreating(true)}>
            <UserPlus className="size-4" /> Add staff member
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Accounts"
            actions={
              <Select
                aria-label="Filter by role"
                className="h-8 w-44 text-xs"
                value={filters.role ?? ''}
                onChange={(e) => setFilters({ role: e.target.value })}
              >
                <option value="">All roles</option>
                {Object.values(ROLES).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            }
          />
          {users.isPending ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : users.isError ? (
            <ErrorState error={users.error} onRetry={users.refetch} />
          ) : users.data.data.length === 0 ? (
            <EmptyState icon={Users} title="No staff found" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {users.data.data.map((member) => (
                <li key={member._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{member.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {member.email}
                      {member.department && ` · ${member.department.name}`}
                      {member.specialization && ` · ${member.specialization}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden text-xs text-slate-400 sm:inline">
                      {member.lastLoginAt ? `Last login ${formatDateTime(member.lastLoginAt)}` : 'Never signed in'}
                    </span>
                    <Badge tone={ROLE_TONES[member.role]}>{ROLE_LABELS[member.role]}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pagination meta={users.data?.meta} disabled={users.isPlaceholderData} onPageChange={(page) => setFilters({ page })} />
        </Card>

        <DepartmentsCard />
      </div>

      <CreateUserModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
