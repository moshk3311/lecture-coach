import { Navigate, createHashRouter } from 'react-router'
import { LoginPage } from '../features/auth/LoginPage'
import { LecturePage } from '../features/lectures/LecturePage'
import { LecturesPage } from '../features/lectures/LecturesPage'
import { NewLecturePage } from '../features/lectures/NewLecturePage'
import { PracticePage } from '../features/practice/PracticePage'
import { PresentPage } from '../features/present/PresentPage'
import { PresenterPage } from '../features/present/PresenterPage'
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
      // Full screen, outside the app shell.
      { path: 'present/:lectureId', element: <PresenterPage /> },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <LecturesPage /> },
          { path: 'lectures/new', element: <NewLecturePage /> },
          { path: 'lectures/:id', element: <LecturePage /> },
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
