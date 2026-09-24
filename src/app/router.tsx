import { Navigate, createHashRouter } from 'react-router'
import { LoginPage } from '../features/auth/LoginPage'
import { LecturesPage } from '../features/lectures/LecturesPage'
import { PracticePage } from '../features/practice/PracticePage'
import { PresentPage } from '../features/present/PresentPage'
import { ProgressPage } from '../features/progress/ProgressPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { AppLayout } from './AppLayout'
import { RequireAuth } from './RequireAuth'

// HashRouter: GitHub Pages serves a single index.html (ARCHITECTURE §2).
export const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <LecturesPage /> },
          { path: 'practice', element: <PracticePage /> },
          { path: 'present', element: <PresentPage /> },
          { path: 'progress', element: <ProgressPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
