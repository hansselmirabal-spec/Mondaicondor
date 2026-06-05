import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { BoardsPage } from '@/pages/BoardsPage'
import { BoardPage } from '@/pages/BoardPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { MembersPage } from '@/pages/MembersPage'
import { WorkspaceStatusPage } from '@/pages/WorkspaceStatusPage'
import { AuthGuard } from '@/components/auth/AuthGuard'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
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
      { path: 'settings/statuses', element: <WorkspaceStatusPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
])
