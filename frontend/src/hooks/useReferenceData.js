import { useQuery } from '@tanstack/react-query';
import { departmentApi, doctorApi } from '../api/endpoints.js';
import { queryKeys } from '../api/queryKeys.js';

// Reference data changes rarely; keep it fresh for 5 minutes and share it across screens.
const REFERENCE_STALE_TIME = 5 * 60 * 1000;

export function useDepartments() {
  return useQuery({
    queryKey: queryKeys.departments,
    queryFn: departmentApi.list,
    select: (response) => response.data,
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useDoctors({ department } = {}, { enabled = true } = {}) {
  const params = department ? { department } : {};
  return useQuery({
    queryKey: queryKeys.doctors(params),
    queryFn: () => doctorApi.list(params),
    select: (response) => response.data,
    staleTime: REFERENCE_STALE_TIME,
    enabled,
  });
}
