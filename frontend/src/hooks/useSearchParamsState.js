import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filter/pagination state stored in the URL query string, so a filtered list survives a
 * reload, works with back/forward and can be shared as a link.
 * Empty values are removed from the URL. Changing any filter resets `page` to 1.
 */
export function useSearchParamsState(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo(() => {
    const result = { ...defaults };
    for (const [key, value] of searchParams.entries()) result[key] = value;
    return result;
    // `defaults` is expected to be a stable literal for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const update = useCallback(
    (changes) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === null || value === '') next.delete(key);
            else next.set(key, String(value));
          }
          if (!('page' in changes)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return [state, update];
}
