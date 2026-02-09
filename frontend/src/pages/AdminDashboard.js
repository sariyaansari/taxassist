import { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../App";
import { toast } from "sonner";
import { Users, FileText, CreditCard, MessageCircle, TrendingUp, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, requestsRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/requests")
      ]);
      setStats(statsRes.data);
      setRecentRequests(requestsRes.data.slice(0, 5));
    } catch (err) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <div className="spinner"></div>
        </div>
      </AdminLayout>
    );
  }

  const statCards = [
    { label: "Total Requests", value: stats?.total_requests || 0, icon: <FileText size={24} />, color: 'var(--primary)' },
    { label: "Pending Requests", value: stats?.pending_requests || 0, icon: <Clock size={24} />, color: 'var(--warning)' },
    { label: "Total Users", value: stats?.total_users || 0, icon: <Users size={24} />, color: 'var(--accent)' },
    { label: "Unread Messages", value: stats?.unread_messages || 0, icon: <MessageCircle size={24} />, color: 'var(--error)' },
    { label: "Pending Documents", value: stats?.pending_documents || 0, icon: <FileText size={24} />, color: 'var(--warning)' },
    { label: "Total Revenue", value: `₹${(stats?.total_revenue || 0).toLocaleString()}`, icon: <TrendingUp size={24} />, color: 'var(--success)' }
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>Dashboard</h1>
          <p className="opacity-70 mt-1">Overview of your tax filing business</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((stat, idx) => (
            <div key={idx} className="stat-card" data-testid={`stat-${idx}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                  {stat.icon}
                </div>
              </div>
              <p className="text-2xl font-bold mono" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-sm opacity-60">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Recent Requests */}
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold" style={{ fontFamily: 'Fraunces, serif' }}>Recent Requests</h2>
            <button
              onClick={() => navigate('/admin/requests')}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--accent)' }}
              data-testid="view-all-requests"
            >
              View All
            </button>
          </div>
          
          {recentRequests.length === 0 ? (
            <p className="text-center py-8 opacity-60">No requests yet</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Plan</th>
                  <th>FY</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.map((req) => (
                  <tr key={req.id} className="cursor-pointer" onClick={() => navigate('/admin/requests')} data-testid={`request-row-${req.id}`}>
                    <td>
                      <p className="font-medium">{req.user_name}</p>
                      <p className="text-sm opacity-60">{req.user_email}</p>
                    </td>
                    <td>{req.plan_name}</td>
                    <td className="mono">{req.financial_year}</td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium status-${req.status}`}>
                        {req.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium status-${req.payment_status}`}>
                        {req.payment_status}
                      </span>
                    </td>
                    <td className="text-sm opacity-60">{new Date(req.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-4 gap-4">
          <QuickAction label="Manage Plans" onClick={() => navigate('/admin/plans')} icon={<FileText />} />
          <QuickAction label="Review Documents" onClick={() => navigate('/admin/documents')} icon={<FileText />} />
          <QuickAction label="View Messages" onClick={() => navigate('/admin/messages')} icon={<MessageCircle />} />
          <QuickAction label="Payment Reports" onClick={() => navigate('/admin/payments')} icon={<CreditCard />} />
        </div>
      </div>
    </AdminLayout>
  );
};

const QuickAction = ({ label, onClick, icon }) => (
  <button
    onClick={onClick}
    className="bg-white rounded-xl border p-4 flex items-center gap-4 hover:shadow-lg transition-shadow"
    style={{ borderColor: 'var(--border)' }}
    data-testid={`quick-action-${label.toLowerCase().replace(' ', '-')}`}
  >
    <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
      {icon}
    </div>
    <span className="font-medium">{label}</span>
  </button>
);

export default AdminDashboard;