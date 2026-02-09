import { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../App";
import { toast } from "sonner";
import { Search, Check, X, AlertTriangle, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const AdminDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await api.get("/admin/documents");
      setDocuments(res.data);
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
      fetchDocuments();
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const handleDownload = async (docId) => {
    try {
      const res = await api.get(`/documents/${docId}/download`);
      const link = document.createElement('a');
      link.href = `data:application/octet-stream;base64,${res.data.file_data}`;
      link.download = res.data.file_name;
      link.click();
    } catch (err) {
      toast.error("Failed to download document");
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doc.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doc.document_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
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
          <p className="opacity-70 mt-1">Review and approve client documents</p>
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
            placeholder="Search documents..."
            className="pl-10"
            data-testid="doc-search-input"
          />
        </div>

        {/* Documents Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="empty-state bg-white rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No documents found</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-xl border p-5"
                style={{ borderColor: 'var(--border)' }}
                data-testid={`doc-card-${doc.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--secondary)' }}>
                    <FileText size={24} style={{ color: 'var(--accent)' }} />
                  </div>
                  <Badge className={`status-${doc.status}`}>{doc.status.replace('_', ' ')}</Badge>
                </div>
                
                <h3 className="font-semibold mb-1">{doc.name}</h3>
                <p className="text-sm opacity-60 mb-1">{doc.document_type}</p>
                <p className="text-sm opacity-60 mb-3">By: {doc.user_name}</p>
                
                {doc.admin_notes && (
                  <div className="text-sm p-2 rounded mb-3" style={{ backgroundColor: 'var(--secondary)' }}>
                    <AlertTriangle size={14} className="inline mr-1" style={{ color: 'var(--warning)' }} />
                    {doc.admin_notes}
                  </div>
                )}
                
                <p className="text-xs opacity-50 mb-4">
                  Uploaded: {new Date(doc.uploaded_at).toLocaleString()}
                </p>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(doc.id)}
                    data-testid={`download-doc-${doc.id}`}
                  >
                    <Download size={16} className="mr-1" /> Download
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleReview(doc)}
                    className="btn-primary"
                    data-testid={`review-doc-${doc.id}`}
                  >
                    Review
                  </Button>
                </div>
              </div>
            ))}
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
              <div className="file-preview">
                <FileText size={24} style={{ color: 'var(--accent)' }} />
                <div>
                  <p className="font-medium">{selectedDoc.name}</p>
                  <p className="text-sm opacity-60">{selectedDoc.document_type}</p>
                </div>
              </div>
              
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
                  placeholder="Add notes for the client (e.g., reason for rejection, requested changes)"
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