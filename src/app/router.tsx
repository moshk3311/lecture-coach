import { Navigate, createHashRouter } from 'react-router'
import { LoginPage } from '../features/auth/LoginPage'
import { LecturesPage } from '../features/lectures/LecturesPage'
import { PracticePage } from '../features/practice/PracticePage'
import { PresentPage } from '../features/present/PresentPage'
import { ProgressPage } from '../features/progress/ProgressPage'
import { AppLayout } from './AppLayout'
import { RequireAuth } from './RequireAuth'

// HashRouter: GitHub Pages serves a single index.html (ARCHITECTURE §2).
// Pages beyond the first screens load on demand, to keep the start-up bundle small.
export const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      // Full screen, outside the app shell.
      {
        path: 'present/:lectureId',
        lazy: async () => ({ Component: (await import('../features/present/PresenterPage')).PresenterPage }),
      },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <LecturesPage /> },
          {
            path: 'lectures/new',
            lazy: async () => ({ Component: (await import('../features/lectures/NewLecturePage')).NewLecturePage }),
          },
          {
            path: 'lectures/:id',
            lazy: async () => ({ Component: (await import('../features/lectures/LecturePage')).LecturePage }),
          },
          { path: 'practice', element: <PracticePage /> },
          { path: 'present', element: <PresentPage /> },
          { path: 'progress', element: <ProgressPage /> },
          {
            path: 'settings',
            lazy: async () => ({ Component: (await import('../features/settings/SettingsPage')).SettingsPage }),
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
