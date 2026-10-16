import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import { SOCKET_EVENTS } from '../lib/constants.js';

/**
 * Subscribes this screen to live updates for the schedule it is showing
 * (one doctor or one department, on one date). Re-subscribes after reconnects.
 */
export function useScheduleRoom({ doctorId, departmentId, date }) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !date || (!doctorId && !departmentId)) return undefined;
    const room = { doctorId, departmentId, date };
    const join = () => socket.emit(SOCKET_EVENTS.JOIN_SCHEDULE, room);

    if (socket.connected) join();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
      socket.emit(SOCKET_EVENTS.LEAVE_SCHEDULE, room);
    };
  }, [socket, doctorId, departmentId, date]);
}
