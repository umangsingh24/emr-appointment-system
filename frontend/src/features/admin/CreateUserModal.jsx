import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { userApi } from '../../api/endpoints.js';
import { Button } from '../../components/ui/Button.jsx';
import { Field, Input, Select } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { useDepartments } from '../../hooks/useReferenceData.js';
import { ROLES } from '../../lib/constants.js';
import { applyServerFieldErrors, getErrorMessage } from '../../lib/errors.js';

// Same rules as the API's createUserSchema.
const schema = z
  .object({
    role: z.enum([ROLES.DOCTOR, ROLES.RECEPTIONIST]),
    name: z.string().trim().min(2, 'Name is too short').max(100),
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email')),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .max(72)
      .regex(/[A-Za-z]/, 'Must contain a letter')
      .regex(/[0-9]/, 'Must contain a number'),
    department: z.string().optional(),
    specialization: z.string().trim().max(100).optional(),
  })
  .refine((v) => v.role !== ROLES.DOCTOR || v.department, { path: ['department'], message: 'Select a department' });

const EMPTY = { role: ROLES.DOCTOR, name: '', email: '', password: '', department: '', specialization: '' };

export function CreateUserModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const departments = useDepartments();
  const { register, handleSubmit, control, reset, setError, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });
  const { errors } = formState;
  const role = useWatch({ control, name: 'role' });
  const isDoctor = role === ROLES.DOCTOR;

  const create = useMutation({
    mutationFn: (values) => {
      const payload = { ...values };
      if (!isDoctor) {
        delete payload.department;
        delete payload.specialization;
      }
      if (!payload.specialization) delete payload.specialization;
      return userApi.create(payload);
    },
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] }); // department grids now include this doctor
      reset(EMPTY);
      onClose();

      if (data.role !== ROLES.DOCTOR) {
        toast.success(`${data.name} can now sign in`);
        return;
      }
      // A doctor has no bookable slots until working hours are set, so make that the next step.
      toast.success(`${data.name} can now sign in`, {
        description: 'Set their working hours so patients can be booked.',
        duration: 10_000,
        action: { label: 'Set schedule', onClick: () => navigate(`/admin/schedules?doctor=${data._id}`) },
      });
    },
    onError: (error) => {
      if (error?.response?.data?.meta?.code === 'EMAIL_TAKEN') setError('email', { message: getErrorMessage(error) });
      else if (!applyServerFieldErrors(error, setError)) toast.error(getErrorMessage(error));
    },
  });

  const close = () => {
    reset(EMPTY);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add staff member"
      description="Create a doctor or receptionist account."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="create-user" loading={create.isPending}>
            Create account
          </Button>
        </>
      }
    >
      <form id="create-user" noValidate onSubmit={handleSubmit((values) => create.mutate(values))} className="grid gap-4 sm:grid-cols-2">
        <Field label="Role" required className="sm:col-span-2">
          {(aria) => (
            <Select {...aria} {...register('role')}>
              <option value={ROLES.DOCTOR}>Doctor</option>
              <option value={ROLES.RECEPTIONIST}>Receptionist</option>
            </Select>
          )}
        </Field>
        <Field label="Full name" required error={errors.name?.message} className="sm:col-span-2">
          {(aria) => <Input {...aria} error={errors.name} placeholder={isDoctor ? 'Dr. Neha Rao' : 'Full name'} {...register('name')} />}
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          {(aria) => <Input {...aria} type="email" autoComplete="off" error={errors.email} {...register('email')} />}
        </Field>
        <Field label="Temporary password" required error={errors.password?.message} hint="8+ characters with a letter and a number">
          {(aria) => <Input {...aria} type="password" autoComplete="new-password" error={errors.password} {...register('password')} />}
        </Field>
        {isDoctor && (
          <>
            <Field label="Department" required error={errors.department?.message}>
              {(aria) => (
                <Select {...aria} error={errors.department} {...register('department')}>
                  <option value="">Select…</option>
                  {departments.data?.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Specialization" error={errors.specialization?.message}>
              {(aria) => <Input {...aria} placeholder="e.g. Cardiologist" {...register('specialization')} />}
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}
