import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import { refreshSession, SOCKET_URL, tokenStore } from '../api/client.js';
import { queryKeys } from '../api/queryKeys.js';
import { SOCKET_EVENTS } from '../lib/constants.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

const APPOINTMENT_EVENTS = [
  SOCKET_EVENTS.APPOINTMENT_CREATED,
  SOCKET_EVENTS.APPOINTMENT_UPDATED,
  SOCKET_EVENTS.APPOINTMENT_CANCELLED,
];

/**
 * One Socket.IO connection per logged-in session.
 *
 * Events carry no patient data, only "appointment X on doctor Y's day D changed".
 * We react by invalidating exactly the cached queries that could show it; TanStack Query
 * refetches the ones currently on screen through the normal (authorised) REST API.
 */
export function SocketProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // The client object is created per session but not connected yet; the effect below owns
  // connecting and disconnecting (the external-system side of things).
  const socket = useMemo(
    () =>
      isAuthenticated
        ? io(SOCKET_URL, {
            autoConnect: false,
            // A function, so every (re)connect sends the current access token.
            auth: (cb) => cb({ token: tokenStore.get() }),
            transports: ['websocket', 'polling'],
          })
        : null,
    [isAuthenticated],
  );

  useEffect(() => {
    if (!socket) return undefined;
    const instance = socket;

    instance.on('connect_error', async (err) => {
      if (err.message !== 'Unauthorized') return; // network errors: socket.io retries itself
      try {
        await refreshSession();
        instance.connect();
      } catch {
        // Session is gone; AuthContext will route to the login page.
      }
    });

    const onAppointmentEvent = (payload) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.slotsForDate(payload.date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments });
    };
    APPOINTMENT_EVENTS.forEach((event) => instance.on(event, onAppointmentEvent));

    instance.connect();
    return () => {
      instance.removeAllListeners();
      instance.disconnect();
    };
  }, [socket, queryClient]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
