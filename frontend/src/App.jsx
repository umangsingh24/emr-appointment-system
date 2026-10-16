import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { ProtectedRoute } from './components/layout/ProtectedRoute.jsx';
import { ROLES } from './lib/constants.js';

const { SUPER_ADMIN, RECEPTIONIST } = ROLES;

// Route-level code splitting: each page downloads only when first visited.
const LoginPage = lazy(() => import('./features/auth/LoginPage.jsx'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage.jsx'));
const SchedulerPage = lazy(() => import('./features/scheduler/SchedulerPage.jsx'));
const BookingPage = lazy(() => import('./features/booking/BookingPage.jsx'));
const AppointmentsPage = lazy(() => import('./features/appointments/AppointmentsPage.jsx'));
const StaffPage = lazy(() => import('./features/admin/StaffPage.jsx'));
const SchedulesPage = lazy(() => import('./features/admin/SchedulesPage.jsx'));
const NotFoundPage = lazy(() => import('./features/NotFoundPage.jsx'));

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'scheduler', element: <SchedulerPage /> },
          { path: 'appointments', element: <AppointmentsPage /> },
          {
            element: <ProtectedRoute roles={[SUPER_ADMIN, RECEPTIONIST]} />,
            children: [{ path: 'appointments/new', element: <BookingPage /> }],
          },
          {
            element: <ProtectedRoute roles={[SUPER_ADMIN]} />,
            children: [
              { path: 'admin/staff', element: <StaffPage /> },
              { path: 'admin/schedules', element: <SchedulesPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
