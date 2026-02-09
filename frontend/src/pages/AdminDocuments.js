import { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../App";
import { toast } from "sonner";
import { Search, Check, X, AlertTriangle, Download, FileText, User, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const AdminDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [expandedRequests, setExpandedRequests] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [docsRes, reqsRes] = await Promise.all([
        api.get("/admin/documents"),
        api.get("/admin/requests")
      ]);
      setDocuments(docsRes.data);
      setRequests(reqsRes.data);
      
      // Auto-expand first few requests
      const expanded = {};
      reqsRes.data.slice(0, 3).forEach(r => expanded[r.id] = true);
      setExpandedRequests(expanded);
    } catch (err) {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (doc) => {
    setSelectedDoc(doc);
    setNewStatus(doc.status);
    setAdminNotes(doc.admin_notes || "");
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    
    setUpdating(true);
    try {
      await api.put(`/admin/documents/${selectedDoc.id}/status`, {
        status: newStatus,
        admin_notes: adminNotes
      });
      toast.success("Document status updated");
      setSelectedDoc(null);
      fetchData();
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
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

  const toggleRequest = (requestId) => {
    setExpandedRequests(prev => ({
      ...prev,
      [requestId]: !prev[requestId]
    }));
  };

  // Group documents by request
  const getDocumentsByRequest = (requestId) => {
    return documents.filter(doc => doc.request_id === requestId);
  };

  // Filter requests based on search and status
  const filteredRequests = requests.filter(req => {
    const reqDocs = getDocumentsByRequest(req.id);
    const matchesSearch = 
      req.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.plan_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === "all") return matchesSearch && reqDocs.length > 0;
    
    const hasDocsWithStatus = reqDocs.some(doc => doc.status === statusFilter);
    return matchesSearch && hasDocsWithStatus;
  });

  const statusCounts = {
    all: documents.length,
    pending: documents.filter(d => d.status === 'pending').length,
    approved: documents.filter(d => d.status === 'approved').length,
    rejected: documents.filter(d => d.status === 'rejected').length,
    needs_revision: documents.filter(d => d.status === 'needs_revision').length
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>Document Review</h1>
          <p className="opacity-70 mt-1">Review and approve client documents organized by case</p>
        </div>

        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === status
                  ? 'text-white'
                  : 'bg-white border hover:bg-gray-50'
              }`}
              style={statusFilter === status ? { backgroundColor: 'var(--primary)' } : { borderColor: 'var(--border)' }}
              data-testid={`filter-${status}`}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ')} ({count})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={20} />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by client name, email, or plan..."
            className="pl-10"
            data-testid="doc-search-input"
          />
        </div>

        {/* Documents Organized by Request */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="empty-state bg-white rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No documents found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => {
              const reqDocs = getDocumentsByRequest(request.id);
              const pendingCount = reqDocs.filter(d => d.status === 'pending').length;
              const isExpanded = expandedRequests[request.id];
              
              return (
                <div 
                  key={request.id} 
                  className="bg-white rounded-xl border overflow-hidden"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {/* Request Header - Clickable */}
                  <button
                    onClick={() => toggleRequest(request.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    data-testid={`request-toggle-${request.id}`}
                  >
                    <div className="flex items-center gap-4">
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                        <User size={18} />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">{request.user_name}</p>
                        <p className="text-sm opacity-60">{request.user_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium">{request.plan_name}</p>
                        <p className="text-sm opacity-60 flex items-center gap-1">
                          <Calendar size={14} />
                          FY {request.financial_year}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{reqDocs.length} docs</Badge>
                        {pendingCount > 0 && (
                          <Badge className="bg-orange-100 text-orange-700">{pendingCount} pending</Badge>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Documents List */}
                  {isExpanded && (
                    <div className="border-t px-4 pb-4" style={{ borderColor: 'var(--border)' }}>
                      <div className="grid gap-3 mt-4">
                        {reqDocs.length === 0 ? (
                          <p className="text-center py-4 opacity-60">No documents uploaded yet</p>
                        ) : (
                          reqDocs.map((doc) => (
                            <div 
                              key={doc.id} 
                              className="flex items-center justify-between p-4 rounded-lg"
                              style={{ backgroundColor: 'var(--secondary)' }}
                              data-testid={`doc-item-${doc.id}`}
                            >
                              <div className="flex items-center gap-3">
                                <FileText size={24} style={{ color: 'var(--accent)' }} />
                                <div>
                                  <p className="font-medium">{doc.name}</p>
                                  <p className="text-sm opacity-60">{doc.document_type} • {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge className={`status-${doc.status}`}>{doc.status.replace('_', ' ')}</Badge>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownload(doc.id, doc.file_name)}
                                  data-testid={`download-${doc.id}`}
                                >
                                  <Download size={16} />
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleReview(doc)}
                                  className="btn-primary"
                                  data-testid={`review-${doc.id}`}
                                >
                                  Review
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Fraunces, serif' }}>Review Document</DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                <div className="flex items-center gap-3">
                  <FileText size={24} style={{ color: 'var(--accent)' }} />
                  <div>
                    <p className="font-medium">{selectedDoc.name}</p>
                    <p className="text-sm opacity-60">{selectedDoc.document_type}</p>
                    <p className="text-sm opacity-60">Uploaded by: {selectedDoc.user_name}</p>
                  </div>
                </div>
              </div>
              
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleDownload(selectedDoc.id, selectedDoc.file_name)}
              >
                <Download size={16} className="mr-2" /> Download to Review
              </Button>
              
              <div>
                <label className="text-sm font-medium">Update Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="mt-2" data-testid="doc-status-select">
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
                <label className="text-sm font-medium">Notes for Client</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes (e.g., reason for rejection, what needs to be fixed)"
                  className="mt-2"
                  rows={4}
                  data-testid="doc-notes-input"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDoc(null)}>Cancel</Button>
            <Button onClick={handleUpdateStatus} disabled={updating} className="btn-primary" data-testid="update-doc-status-btn">
              {updating ? <span className="spinner" style={{ width: 20, height: 20 }}></span> : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminDocuments;
