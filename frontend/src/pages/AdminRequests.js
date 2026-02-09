import { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../App";
import { toast } from "sonner";
import { Search, Filter, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const AdminRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await api.get("/admin/requests");
      setRequests(res.data);
    } catch (err) {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (request) => {
    setSelectedRequest(request);
    try {
      const res = await api.get(`/requests/${request.id}/documents`);
      setDocuments(res.data);
    } catch (err) {
      setDocuments([]);
    }
  };

  const handleUpdateStatus = async (requestId, status) => {
    try {
      await api.put(`/admin/requests/${requestId}/status?status=${status}`);
      toast.success("Status updated");
      fetchRequests();
      if (selectedRequest?.id === requestId) {
        setSelectedRequest({ ...selectedRequest, status });
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          req.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          req.plan_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statuses = ["pending", "documents_uploaded", "under_review", "completed", "rejected"];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>Tax Filing Requests</h1>
          <p className="opacity-70 mt-1">Manage and track all client requests</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={20} />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, or plan..."
              className="pl-10"
              data-testid="search-input"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" data-testid="status-filter">
              <Filter size={16} className="mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="empty-state bg-white rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <p>No requests found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Plan</th>
                    <th>FY</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req) => (
                    <tr key={req.id} data-testid={`request-row-${req.id}`}>
                      <td>
                        <p className="font-medium">{req.user_name}</p>
                        <p className="text-sm opacity-60">{req.user_email}</p>
                      </td>
                      <td>
                        <p>{req.plan_name}</p>
                        <Badge variant="outline" className="text-xs">{req.plan_type}</Badge>
                      </td>
                      <td className="mono">{req.financial_year}</td>
                      <td>
                        <Select
                          value={req.status}
                          onValueChange={(v) => handleUpdateStatus(req.id, v)}
                        >
                          <SelectTrigger className="w-40" data-testid={`status-select-${req.id}`}>
                            <span className={`status-${req.status} px-2 py-1 rounded text-xs`}>
                              {req.status.replace('_', ' ')}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {statuses.map((s) => (
                              <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td>
                        <Badge className={`status-${req.payment_status}`}>
                          {req.payment_status}
                        </Badge>
                      </td>
                      <td className="mono font-medium" style={{ color: 'var(--accent)' }}>
                        ₹{req.price.toLocaleString()}
                      </td>
                      <td className="text-sm opacity-60">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(req)}
                          data-testid={`view-request-${req.id}`}
                        >
                          <Eye size={16} className="mr-1" /> View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Request Details Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Fraunces, serif' }}>Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm opacity-60">Client Name</p>
                  <p className="font-medium">{selectedRequest.user_name}</p>
                </div>
                <div>
                  <p className="text-sm opacity-60">Email</p>
                  <p className="font-medium">{selectedRequest.user_email}</p>
                </div>
                <div>
                  <p className="text-sm opacity-60">Plan</p>
                  <p className="font-medium">{selectedRequest.plan_name}</p>
                </div>
                <div>
                  <p className="text-sm opacity-60">Financial Year</p>
                  <p className="font-medium mono">{selectedRequest.financial_year}</p>
                </div>
                <div>
                  <p className="text-sm opacity-60">Amount</p>
                  <p className="font-medium mono" style={{ color: 'var(--accent)' }}>₹{selectedRequest.price.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm opacity-60">Payment Status</p>
                  <Badge className={`status-${selectedRequest.payment_status}`}>{selectedRequest.payment_status}</Badge>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Uploaded Documents ({documents.length})</h3>
                {documents.length === 0 ? (
                  <p className="text-sm opacity-60">No documents uploaded yet</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div key={doc.id} className="file-preview">
                        <div className="flex-1">
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm opacity-60">{doc.document_type}</p>
                        </div>
                        <Badge className={`status-${doc.status}`}>{doc.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminRequests;