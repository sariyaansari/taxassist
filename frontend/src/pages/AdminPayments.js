import { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../App";
import { toast } from "sonner";
import { CreditCard, TrendingUp, DollarSign, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, statsRes] = await Promise.all([
        api.get("/admin/payments"),
        api.get("/admin/stats")
      ]);
      setPayments(paymentsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      toast.error("Failed to load payment data");
    } finally {
      setLoading(false);
    }
  };

  const getTodayRevenue = () => {
    const today = new Date().toDateString();
    return payments
      .filter(p => new Date(p.created_at).toDateString() === today)
      .reduce((sum, p) => sum + p.amount, 0);
  };

  const getThisMonthRevenue = () => {
    const now = new Date();
    return payments
      .filter(p => {
        const date = new Date(p.created_at);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      })
      .reduce((sum, p) => sum + p.amount, 0);
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>Payment Reports</h1>
          <p className="opacity-70 mt-1">Track revenue and payment history</p>
        </div>

        {/* Revenue Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="stat-card" data-testid="total-revenue">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#e8f5e915', color: 'var(--success)' }}>
                <TrendingUp size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold mono" style={{ color: 'var(--success)' }}>₹{(stats?.total_revenue || 0).toLocaleString()}</p>
            <p className="text-sm opacity-60">Total Revenue</p>
          </div>
          
          <div className="stat-card" data-testid="today-revenue">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#fff3e015', color: 'var(--accent)' }}>
                <DollarSign size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold mono" style={{ color: 'var(--accent)' }}>₹{getTodayRevenue().toLocaleString()}</p>
            <p className="text-sm opacity-60">Today's Revenue</p>
          </div>
          
          <div className="stat-card" data-testid="month-revenue">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#e3f2fd15', color: '#1565c0' }}>
                <Calendar size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold mono" style={{ color: '#1565c0' }}>₹{getThisMonthRevenue().toLocaleString()}</p>
            <p className="text-sm opacity-60">This Month</p>
          </div>
          
          <div className="stat-card" data-testid="total-payments">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f3e5f515', color: '#7b1fa2' }}>
                <CreditCard size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold mono" style={{ color: '#7b1fa2' }}>{payments.length}</p>
            <p className="text-sm opacity-60">Total Transactions</p>
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold">Payment History</h2>
          </div>
          
          {payments.length === 0 ? (
            <div className="empty-state">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No payments recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Client</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} data-testid={`payment-row-${payment.id}`}>
                      <td className="mono text-sm">{payment.id.slice(0, 8)}...</td>
                      <td className="font-medium">{payment.user_name}</td>
                      <td className="mono font-medium" style={{ color: 'var(--success)' }}>₹{payment.amount.toLocaleString()}</td>
                      <td className="capitalize">{payment.payment_method}</td>
                      <td>
                        <Badge className="status-paid">{payment.status}</Badge>
                      </td>
                      <td className="text-sm opacity-60">
                        {new Date(payment.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminPayments;