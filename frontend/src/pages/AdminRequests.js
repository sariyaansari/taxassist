import { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../App";
import { toast } from "sonner";
import { Search, Filter, Eye, Download, FileText, MessageCircle, User, Check, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState("details");
  
  // Document review state
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docStatus, setDocStatus] = useState("");
  const [docNotes, setDocNotes] = useState("");
  const [updatingDoc, setUpdatingDoc] = useState(false);

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
    setActiveTab("details");
    try {
      const [docsRes, msgsRes] = await Promise.all([
        api.get(`/requests/${request.id}/documents`),
        api.get(`/messages/conversation/${request.user_id}`)
      ]);
      setDocuments(docsRes.data);
      setMessages(msgsRes.data);
    } catch (err) {
      setDocuments([]);
      setMessages([]);
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

  const handleDownload = async (docId, fileName) => {
    try {
      const res = await api.get(`/documents/${docId}/download`);
      const link = document.createElement('a');
      link.href = `data:application/octet-stream;base64,${res.data.file_data}`;
      link.download = res.data.file_name || fileName;
      link.click();
      toast.success("Download started");
    } catch (err) {
      toast.error("Failed to download document");
    }
  };

  const handleReviewDoc = (doc) => {
    setSelectedDoc(doc);
    setDocStatus(doc.status);
    setDocNotes(doc.admin_notes || "");
  };

  const handleUpdateDocStatus = async () => {
    if (!docStatus) return;
    setUpdatingDoc(true);
    try {
      await api.put(`/admin/documents/${selectedDoc.id}/status`, {
        status: docStatus,
        admin_notes: docNotes
      });
      toast.success("Document status updated");
      setSelectedDoc(null);
      // Refresh documents
      const docsRes = await api.get(`/requests/${selectedRequest.id}/documents`);
      setDocuments(docsRes.data);
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setUpdatingDoc(false);
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

  const getStatusIcon = (status) => {
    switch(status) {
      case 'approved': return <Check size={14} className="text-green-600" />;
      case 'rejected': return <X size={14} className="text-red-600" />;
      case 'needs_revision': return <AlertTriangle size={14} className="text-orange-500" />;
      default: return null;
    }
  };

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
                          <SelectTrigger className="w-44" data-testid={`status-select-${req.id}`}>
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

      {/* Request Details Dialog with Tabs */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Fraunces, serif' }}>
              Case Details - {selectedRequest?.user_name}
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
                <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
              </TabsList>
              
              {/* Details Tab */}
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                    <p className="text-sm opacity-60">Client Name</p>
                    <p className="font-medium">{selectedRequest.user_name}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                    <p className="text-sm opacity-60">Email</p>
                    <p className="font-medium">{selectedRequest.user_email}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                    <p className="text-sm opacity-60">Plan</p>
                    <p className="font-medium">{selectedRequest.plan_name}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                    <p className="text-sm opacity-60">Financial Year</p>
                    <p className="font-medium mono">{selectedRequest.financial_year}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                    <p className="text-sm opacity-60">Amount</p>
                    <p className="font-medium mono" style={{ color: 'var(--accent)' }}>₹{selectedRequest.price.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                    <p className="text-sm opacity-60">Payment Status</p>
                    <Badge className={`status-${selectedRequest.payment_status}`}>{selectedRequest.payment_status}</Badge>
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                  <p className="text-sm opacity-60 mb-2">Required Documents</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRequest.required_documents?.map((doc, idx) => (
                      <Badge key={idx} variant="outline">{doc}</Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-3 mt-4">
                {documents.length === 0 ? (
                  <p className="text-center py-8 opacity-60">No documents uploaded yet</p>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id} className="p-4 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText size={24} style={{ color: 'var(--accent)' }} />
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {doc.name}
                              {getStatusIcon(doc.status)}
                            </p>
                            <p className="text-sm opacity-60">{doc.document_type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`status-${doc.status}`}>{doc.status.replace('_', ' ')}</Badge>
                          <Button variant="outline" size="sm" onClick={() => handleDownload(doc.id, doc.file_name)}>
                            <Download size={16} />
                          </Button>
                          <Button size="sm" className="btn-primary" onClick={() => handleReviewDoc(doc)}>
                            Review
                          </Button>
                        </div>
                      </div>
                      {doc.admin_notes && (
                        <div className="mt-2 p-2 rounded text-sm" style={{ backgroundColor: 'var(--secondary)' }}>
                          <strong>Notes:</strong> {doc.admin_notes}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Messages Tab */}
              <TabsContent value="messages" className="mt-4">
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {messages.length === 0 ? (
                    <p className="text-center py-8 opacity-60">No messages yet</p>
                  ) : (
                    messages.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`p-3 rounded-lg ${msg.sender_type === 'admin' ? 'ml-8' : 'mr-8'}`}
                        style={{ backgroundColor: msg.sender_type === 'admin' ? 'var(--primary)' : 'var(--secondary)', color: msg.sender_type === 'admin' ? 'white' : 'inherit' }}
                      >
                        <p className="text-sm font-medium mb-1">{msg.sender_name} ({msg.sender_type})</p>
                        <p className="text-sm">{msg.content}</p>
                        <p className="text-xs opacity-60 mt-1">{new Date(msg.created_at).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Document Review Sub-Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                <p className="font-medium">{selectedDoc.name}</p>
                <p className="text-sm opacity-60">{selectedDoc.document_type}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => handleDownload(selectedDoc.id, selectedDoc.file_name)}>
                <Download size={16} className="mr-2" /> Download Document
              </Button>
              <div>
                <label className="text-sm font-medium">Update Status</label>
                <Select value={docStatus} onValueChange={setDocStatus}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="needs_revision">Needs Revision</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  placeholder="Add notes for the client..."
                  className="mt-2"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDoc(null)}>Cancel</Button>
            <Button onClick={handleUpdateDocStatus} disabled={updatingDoc} className="btn-primary">
              {updatingDoc ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminRequests;
