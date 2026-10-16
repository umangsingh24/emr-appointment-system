import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { doctorApi } from '../../api/endpoints.js';
import { queryKeys } from '../../api/queryKeys.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Field, Input } from '../../components/ui/Field.jsx';
import { WEEKDAY_LABELS, WEEKDAYS } from '../../lib/constants.js';
import { getErrorMessage } from '../../lib/errors.js';
import { scheduleFormSchema, toFormValues, toPayload } from './scheduleForm.js';

function RangeList({ control, register, errors, name, kind, disabled }) {
  const { fields, append, remove } = useFieldArray({ control, name });
  const isBreak = kind === 'break';

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{isBreak ? 'Breaks' : 'Sessions'}</p>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => append(isBreak ? { label: 'Break', start: '11:00', end: '11:15' } : { label: '', start: '09:00', end: '12:00' })}
        >
          <Plus className="size-3.5" /> Add {isBreak ? 'break' : 'session'}
        </Button>
      </div>
      {fields.length === 0 && <p className="text-xs text-slate-400">{isBreak ? 'No breaks.' : 'No sessions.'}</p>}
      <ul className="space-y-2">
        {fields.map((field, index) => {
          const rowErrors = errors?.[index];
          const message = rowErrors?.start?.message ?? rowErrors?.end?.message;
          return (
            <li key={field.id}>
              <div className="grid grid-cols-[1fr_6.5rem_6.5rem_auto] items-center gap-2">
                <Input
                  aria-label={`${isBreak ? 'Break' : 'Session'} ${index + 1} label`}
                  placeholder={isBreak ? 'Lunch' : 'Morning'}
                  className="h-9"
                  disabled={disabled}
                  {...register(`${name}.${index}.label`)}
                />
                <Input
                  type="time"
                  aria-label="Start time"
                  className="h-9"
                  disabled={disabled}
                  error={rowErrors?.start}
                  {...register(`${name}.${index}.start`)}
                />
                <Input
                  type="time"
                  aria-label="End time"
                  className="h-9"
                  disabled={disabled}
                  error={rowErrors?.end}
                  {...register(`${name}.${index}.end`)}
                />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Remove ${isBreak ? 'break' : 'session'} ${index + 1}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {message && <p className="mt-1 text-xs text-rose-600">{message}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DayRow({ index, control, register, errors }) {
  const day = useWatch({ control, name: `days.${index}` });
  const dayErrors = errors?.days?.[index];

  return (
    <div className={clsx('rounded-lg p-4 ring-1', day.working ? 'bg-white ring-slate-200' : 'bg-slate-50 ring-slate-100')}>
      <label className="flex w-fit cursor-pointer items-center gap-3">
        <input type="checkbox" className="size-4 accent-brand-700" {...register(`days.${index}.working`)} />
        <span className="text-sm font-semibold text-slate-900">{WEEKDAY_LABELS[day.day]}</span>
        {!day.working && <span className="text-xs text-slate-400">Not working</span>}
      </label>
      {day.working && (
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <RangeList control={control} register={register} errors={dayErrors?.sessions} name={`days.${index}.sessions`} kind="session" />
          <RangeList control={control} register={register} errors={dayErrors?.breaks} name={`days.${index}.breaks`} kind="break" />
          {dayErrors?.sessions?.message && <p className="text-xs text-rose-600 md:col-span-2">{dayErrors.sessions.message}</p>}
        </div>
      )}
    </div>
  );
}

export function ScheduleEditor({ doctor, schedule }) {
  const queryClient = useQueryClient();
  const [serverErrors, setServerErrors] = useState([]);
  const { control, register, handleSubmit, getValues, reset, formState } = useForm({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: toFormValues(schedule),
  });
  const { errors, isDirty } = formState;

  const save = useMutation({
    mutationFn: (values) => doctorApi.saveSchedule(doctor._id, toPayload(values)),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(queryKeys.schedule(doctor._id), { data });
      // Every slot grid may change once working hours change.
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      reset(toFormValues(data));
      setServerErrors([]);
      toast.success(`Schedule saved for ${doctor.name}`);
    },
    onError: (error) => {
      setServerErrors(error?.response?.data?.meta?.details ?? []);
      toast.error(getErrorMessage(error));
    },
  });

  /** Copies Monday's hours onto Tuesday–Friday. */
  const copyMondayToWeekdays = () => {
    const values = getValues();
    const monday = values.days[0];
    const days = values.days.map((d, i) => (i >= 1 && i <= 4 ? { ...monday, day: d.day } : d));
    reset({ ...values, days }, { keepDefaultValues: true });
  };

  return (
    <form noValidate onSubmit={handleSubmit((values) => save.mutate(values))}>
      <Card className="mb-4 flex flex-wrap items-end gap-4 p-4">
        <Field label="Slot duration (minutes)" error={errors.slotDurationMinutes?.message} className="w-48">
          {(aria) => (
            <Input {...aria} type="number" min={5} max={240} step={5} error={errors.slotDurationMinutes} {...register('slotDurationMinutes')} />
          )}
        </Field>
        <Button variant="secondary" onClick={copyMondayToWeekdays}>
          <Copy className="size-4" /> Copy Monday to Tue–Fri
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" disabled={!isDirty} onClick={() => reset()}>
            Discard
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            Save schedule
          </Button>
        </div>
      </Card>

      {serverErrors.length > 0 && (
        <div role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">
          <p className="font-medium">The server rejected this schedule:</p>
          <ul className="mt-1 list-disc pl-5">
            {serverErrors.map((e) => (
              <li key={`${e.field}-${e.message}`}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {WEEKDAYS.map((day, index) => (
          <DayRow key={day} index={index} control={control} register={register} errors={errors} />
        ))}
      </div>
    </form>
  );
}
