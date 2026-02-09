import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClientLayout } from "../components/ClientLayout";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { FileText, Clock, CheckCircle, AlertCircle, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ClientDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await api.get("/requests");
      setRequests(res.data);
    } catch (err) {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "rejected":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-orange-500" />;
    }
  };

  const getProgress = (status) => {
    const stages = ["pending", "documents_uploaded", "under_review", "completed"];
    const idx = stages.indexOf(status);
    return Math.max(((idx + 1) / stages.length) * 100, 25);
  };

  return (
    <ClientLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>Welcome, {user?.name}!</h1>
            <p className="opacity-70 mt-1">Track your tax filing progress and manage documents</p>
          </div>
          <Button
            onClick={() => navigate("/plans")}
            className="btn-primary flex items-center gap-2"
            data-testid="new-filing-btn"
          >
            <Plus size={20} />
            New Tax Filing
          </Button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <p className="text-sm opacity-60 mb-1">Total Filings</p>
            <p className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>{requests.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm opacity-60 mb-1">In Progress</p>
            <p className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif', color: 'var(--warning)' }}>
              {requests.filter(r => !['completed', 'rejected'].includes(r.status)).length}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-sm opacity-60 mb-1">Completed</p>
            <p className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif', color: 'var(--success)' }}>
              {requests.filter(r => r.status === 'completed').length}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-sm opacity-60 mb-1">Pending Payment</p>
            <p className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif', color: 'var(--error)' }}>
              {requests.filter(r => r.payment_status === 'unpaid').length}
            </p>
          </div>
        </div>

        {/* Active Requests */}
        <div>
          <h2 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Fraunces, serif' }}>Your Tax Filings</h2>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="spinner"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state bg-white rounded-xl border" style={{ borderColor: 'var(--border)' }}>
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-semibold mb-2">No Tax Filings Yet</h3>
              <p className="opacity-60 mb-4">Start your first tax filing by choosing a plan</p>
              <Button onClick={() => navigate("/plans")} className="btn-primary" data-testid="start-filing-btn">
                Choose a Plan
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="bg-white rounded-xl border p-6 card-hover cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}
                  onClick={() => navigate(`/request/${request.id}`)}
                  data-testid={`request-card-${request.id}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(request.status)}
                        <h3 className="text-lg font-semibold">{request.plan_name}</h3>
                      </div>
                      <p className="text-sm opacity-60">FY {request.financial_year} • {request.plan_type === 'salary' ? 'Salary' : 'Business'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`status-${request.payment_status}`}>
                        {request.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                      </Badge>
                      <ChevronRight className="opacity-40" />
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{request.status.replace('_', ' ')}</span>
                      <span className="mono">{Math.round(getProgress(request.status))}%</span>
                    </div>
                    <div className="progress-bar h-2">
                      <div className="progress-fill" style={{ width: `${getProgress(request.status)}%` }}></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm opacity-60">
                    <span>Created: {new Date(request.created_at).toLocaleDateString()}</span>
                    <span className="mono font-medium" style={{ color: 'var(--accent)' }}>₹{request.price.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientDashboard;