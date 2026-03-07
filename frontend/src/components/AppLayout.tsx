import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Home,
  Users,
  CheckSquare,
  DollarSign,
  FileText,
  LogOut,
  LayoutDashboard,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isGroupRoute = !!groupId;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-white p-2 shadow-md lg:hidden"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
          <Home className="h-6 w-6 text-brand-600" />
          <span className="text-lg font-bold text-gray-900">RoomieManager</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <NavLink
            to="/"
            end
            className={navLinkClass}
            onClick={() => setSidebarOpen(false)}
          >
            <Home size={18} />
            My Groups
          </NavLink>

          {isGroupRoute && (
            <>
              <div className="mt-4 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Group
              </div>
              <NavLink
                to={`/groups/${groupId}`}
                end
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                <LayoutDashboard size={18} />
                Dashboard
              </NavLink>
              <NavLink
                to={`/groups/${groupId}/chores`}
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                <CheckSquare size={18} />
                Chores
              </NavLink>
              <NavLink
                to={`/groups/${groupId}/finance`}
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                <DollarSign size={18} />
                Finance
              </NavLink>
              <NavLink
                to={`/groups/${groupId}/members`}
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                <Users size={18} />
                Members
              </NavLink>
              <NavLink
                to={`/groups/${groupId}/contract`}
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                <FileText size={18} />
                Contract
              </NavLink>
            </>
          )}
        </nav>

        {/* User info */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{user?.email}</p>
              <p className="text-xs text-gray-500">Logged in</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6 pt-16 lg:pt-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
