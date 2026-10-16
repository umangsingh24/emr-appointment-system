import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { appointmentApi } from '../../api/endpoints.js';
import { queryKeys } from '../../api/queryKeys.js';
import { getErrorCode, getErrorMessage } from '../../lib/errors.js';

/**
 * All appointment state changes in one place. Each mutation updates the detail cache
 * immediately with the server's response and invalidates lists/slots/stats, so every screen
 * agrees. Other users' screens are updated by the socket event the server emits.
 */
export function useAppointmentActions() {
  const queryClient = useQueryClient();

  const onSuccess = (message) => (response) => {
    const appointment = response.data;
    queryClient.setQueryData(queryKeys.appointment(appointment._id), (previous) =>
      previous ? { ...previous, data: { ...previous.data, ...appointment, patient: previous.data.patient, doctor: previous.data.doctor } } : previous,
    );
    queryClient.invalidateQueries({ queryKey: queryKeys.appointments });
    queryClient.invalidateQueries({ queryKey: queryKeys.slotsForDate(appointment.date) });
    toast.success(message);
  };

  const onError = (error) => {
    // Someone else changed it first: show their version.
    if (getErrorCode(error) === 'STALE_APPOINTMENT') queryClient.invalidateQueries({ queryKey: queryKeys.appointments });
    toast.error(getErrorMessage(error));
  };

  return {
    arrive: useMutation({ mutationFn: (id) => appointmentApi.arrive(id), onSuccess: onSuccess('Patient marked as arrived'), onError }),
    complete: useMutation({ mutationFn: (id) => appointmentApi.complete(id), onSuccess: onSuccess('Appointment completed'), onError }),
    cancel: useMutation({
      mutationFn: ({ id, reason }) => appointmentApi.cancel(id, reason),
      onSuccess: onSuccess('Appointment cancelled'),
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, changes }) => appointmentApi.update(id, changes),
      onSuccess: onSuccess('Appointment updated'),
      onError,
    }),
  };
}
