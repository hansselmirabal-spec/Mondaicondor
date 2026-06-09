import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { AcceptInvitePage } from '@/pages/AcceptInvitePage'
import { BoardsPage } from '@/pages/BoardsPage'
import { BoardPage } from '@/pages/BoardPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { MembersPage } from '@/pages/MembersPage'
import { MembersSettingsPage } from '@/pages/MembersSettingsPage'
import { WorkspaceStatusPage } from '@/pages/WorkspaceStatusPage'
import { EmailAlertsPage } from '@/pages/EmailAlertsPage'
import { SettingsLayout } from '@/components/layout/SettingsLayout'
import { AuthGuard } from '@/components/auth/AuthGuard'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/boards" replace /> },
      { path: 'boards', element: <BoardsPage /> },
      { path: 'boards/:boardId', element: <BoardPage /> },
      { path: 'boards/:boardId/settings', element: <SettingsPage /> },
      { path: 'members', element: <MembersPage /> },
      { path: 'workspaces/accept/:token', element: <AcceptInvitePage /> },
      {
        path: 'settings',
        element: <SettingsLayout />,
        children: [
          { index: true, element: <Navigate to="statuses" replace /> },
          { path: 'statuses', element: <WorkspaceStatusPage /> },
          { path: 'email-alerts', element: <EmailAlertsPage /> },
          { path: 'members', element: <MembersSettingsPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
])
