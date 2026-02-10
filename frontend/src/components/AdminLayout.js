import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { FileText, LayoutDashboard, FolderOpen, FileCheck, MessageCircle, CreditCard, LogOut, Menu, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { path: "/admin", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
    { path: "/admin/plans", label: "Tax Plans", icon: <FolderOpen size={20} /> },
    { path: "/admin/requests", label: "Requests", icon: <FileText size={20} /> },
    { path: "/admin/documents", label: "Documents", icon: <FileCheck size={20} /> },
    { path: "/admin/messages", label: "Messages", icon: <MessageCircle size={20} /> },
    { path: "/admin/payments", label: "Payments", icon: <CreditCard size={20} /> },
    { path: "/admin/users", label: "Users", icon: <Users size={20} /> }
  ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const getRoleBadge = () => {
    if (user?.admin_role === 'super_admin') {
      return <Badge className="text-xs bg-orange-500 text-white">Super Admin</Badge>;
    }
    return <Badge className="text-xs">CA Admin</Badge>;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--secondary)' }}>
      {/* Sidebar */}
      <aside className={`admin-sidebar p-6 transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-2 mb-10">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
            <FileText className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>TaxAssist</span>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`nav-pill flex items-center gap-3 w-full ${
                location.pathname === item.path ? 'active' : ''
              }`}
              data-testid={`admin-nav-${item.path.split('/').pop() || 'dashboard'}`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <div className="flex items-center gap-3 mb-4 px-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <span className="font-semibold">{user?.name?.charAt(0)}</span>
            </div>
            <div>
              <p className="font-medium text-sm">{user?.name}</p>
              <p className="text-xs opacity-60">Administrator</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-white opacity-70 hover:opacity-100 hover:bg-white/10"
            onClick={handleLogout}
            data-testid="admin-logout-btn"
          >
            <LogOut size={20} />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden glass-header px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} data-testid="mobile-menu-btn">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <span className="font-bold" style={{ fontFamily: 'Fraunces, serif' }}>TaxAssist Admin</span>
        <div className="w-6"></div>
      </header>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Content */}
      <main className="admin-content p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
};