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
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-sage-100/70 text-sage-700'
        : 'text-slate-500 hover:bg-sage-50 hover:text-charcoal'
    }`;

  return (
    <div className="flex h-screen overflow-hidden bg-cream-50">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed left-4 top-4 z-50 rounded-xl border border-sage-100/50 bg-white/80 p-2.5 shadow-md backdrop-blur-sm lg:hidden"
      >
        {sidebarOpen ? <X size={20} className="text-charcoal" /> : <Menu size={20} className="text-charcoal" />}
      </button>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-charcoal/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sage-100/60 bg-cream-50/95 backdrop-blur-lg transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-sage-100/40 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sage-100 to-sage-200">
            <Home className="h-4 w-4 text-sage-600" />
          </div>
          <span className="font-display text-lg text-charcoal">RoomieManager</span>
        </div>

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
              <div className="mb-2 mt-5 px-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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

        <div className="border-t border-sage-100/40 p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-charcoal">{user?.email}</p>
              <p className="text-xs text-slate-400">Signed in</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-xl p-2 text-slate-400 transition-all duration-200 hover:bg-blush-50 hover:text-blush-600"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6 pt-16 lg:pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
