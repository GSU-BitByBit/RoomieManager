import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import AppLayout from '@/components/AppLayout';
import GroupsPage from '@/pages/GroupsPage';
import GroupDashboardPage from '@/pages/GroupDashboardPage';
import ChoresPage from '@/pages/ChoresPage';
import FinancePage from '@/pages/FinancePage';
import MembersPage from '@/pages/MembersPage';
import ContractsPage from '@/pages/ContractsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<GroupsPage />} />
              <Route path="/groups/:groupId" element={<GroupDashboardPage />} />
              <Route path="/groups/:groupId/chores" element={<ChoresPage />} />
              <Route path="/groups/:groupId/finance" element={<FinancePage />} />
              <Route path="/groups/:groupId/members" element={<MembersPage />} />
              <Route path="/groups/:groupId/contract" element={<ContractsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
