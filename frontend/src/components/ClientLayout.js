import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { FileText, LayoutDashboard, FolderOpen, MessageCircle, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ClientLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
    { path: "/plans", label: "Tax Plans", icon: <FolderOpen size={20} /> },
    { path: "/messages", label: "Messages", icon: <MessageCircle size={20} /> }
  ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--secondary)' }}>
      {/* Header */}
      <header className="glass-header px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2" data-testid="logo-link">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
              <FileText className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold" style={{ fontFamily: 'Fraunces, serif', color: 'var(--primary)' }}>TaxAssist</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary text-white'
                    : 'hover:bg-muted'
                }`}
                style={location.pathname === item.path ? { backgroundColor: 'var(--primary)' } : {}}
                data-testid={`nav-${item.path.slice(1)}`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--muted)' }}>
                <User size={18} />
              </div>
              <span className="hidden md:block font-medium">{user?.name}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="logout-btn"
            >
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3 z-50" style={{ borderColor: 'var(--border)' }}>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg ${
              location.pathname === item.path ? 'text-accent' : 'opacity-60'
            }`}
            style={location.pathname === item.path ? { color: 'var(--accent)' } : {}}
          >
            {item.icon}
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 pb-24 md:pb-8">
        {children}
      </main>
    </div>
  );
};