import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ClientLayout } from "../components/ClientLayout";
import { api } from "../App";
import { toast } from "sonner";
import { Upload, FileText, Check, X, AlertTriangle, CreditCard, Send, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ClientRequest = () => {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [request, setRequest] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Upload state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [docType, setDocType] = useState("");
  const [docName, setDocName] = useState("");
  
  // Payment state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [requestId]);

  const fetchData = async () => {
    try {
      const [reqRes, docsRes, msgRes] = await Promise.all([
        api.get(`/requests/${requestId}`),
        api.get(`/requests/${requestId}/documents`),
        api.get("/messages")
      ]);
      setRequest(reqRes.data);
      setDocuments(docsRes.data);
      setMessages(msgRes.data);
    } catch (err) {
      toast.error("Failed to load request details");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setUploadFile(file);
      setDocName(file.name.split('.')[0]);
      setShowUploadDialog(true);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !docType || !docName) {
      toast.error("Please fill all fields");
      return;
    }
    
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        await api.post(`/requests/${requestId}/documents`, {
          name: docName,
          document_type: docType,
          file_data: base64,
          file_name: uploadFile.name
        });
        toast.success("Document uploaded successfully!");
        setShowUploadDialog(false);
        setUploadFile(null);
        setDocType("");
        setDocName("");
        fetchData();
      };
      reader.readAsDataURL(uploadFile);
    } catch (err) {
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    setSendingMessage(true);
    try {
      await api.post("/messages", { content: newMessage });
      toast.success("Message sent!");
      setNewMessage("");
      fetchData();
    } catch (err) {
      toast.error("Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    
    setProcessing(true);
    try {
      await api.post("/payments", {
        request_id: requestId,
        amount: request.price,
        payment_method: paymentMethod
      });
      toast.success("Payment successful!");
      setShowPaymentDialog(false);
      fetchData();
    } catch (err) {
      toast.error("Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    return <Badge className={`status-${status}`}>{status.replace('_', ' ')}</Badge>;
  };

  if (loading) {
    return (
      <ClientLayout>
        <div className="flex justify-center py-12">
          <div className="spinner"></div>
        </div>
      </ClientLayout>
    );
  }

  if (!request) return null;

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Back Button & Header */}
        <div>
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4" data-testid="back-btn">
            <ArrowLeft size={20} className="mr-2" /> Back to Dashboard
          </Button>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>{request.plan_name}</h1>
              <p className="opacity-70">FY {request.financial_year} • {request.plan_type === 'salary' ? 'Salary' : 'Business'}</p>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(request.status)}
              {getStatusBadge(request.payment_status)}
            </div>
          </div>
        </div>

        {/* Payment Card */}
        {request.payment_status === 'unpaid' && (
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--accent)', borderWidth: 2 }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Payment Required</h3>
                <p className="text-sm opacity-70">Complete payment to start the review process</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold mono" style={{ color: 'var(--accent)' }}>₹{request.price.toLocaleString()}</p>
                <Button onClick={() => setShowPaymentDialog(true)} className="mt-2 btn-primary" data-testid="pay-now-btn">
                  <CreditCard size={18} className="mr-2" /> Pay Now
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Document Upload Section */}
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold" style={{ fontFamily: 'Fraunces, serif' }}>Documents</h2>
            <Button onClick={() => fileInputRef.current?.click()} className="btn-primary" data-testid="upload-doc-btn">
              <Upload size={18} className="mr-2" /> Upload Document
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
          </div>

          {/* Required Documents Checklist */}
          <div className="mb-6">
            <h3 className="font-medium mb-3">Required Documents:</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {request.required_documents.map((doc, idx) => {
                const uploaded = documents.find(d => d.document_type === doc);
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                    {uploaded ? (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--success)' }}>
                        <Check size={14} className="text-white" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-dashed" style={{ borderColor: 'var(--border)' }}></div>
                    )}
                    <span className={uploaded ? 'opacity-100' : 'opacity-60'}>{doc}</span>
                    {uploaded && <Badge className={`status-${uploaded.status} ml-auto`}>{uploaded.status}</Badge>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Uploaded Documents */}
          {documents.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Uploaded Documents:</h3>
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="file-preview" data-testid={`doc-${doc.id}`}>
                    <FileText size={24} style={{ color: 'var(--accent)' }} />
                    <div className="flex-1">
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-sm opacity-60">{doc.document_type} • {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                    </div>
                    <Badge className={`status-${doc.status}`}>{doc.status}</Badge>
                    {doc.admin_notes && (
                      <div className="text-sm" style={{ color: 'var(--warning)' }}>
                        <AlertTriangle size={14} className="inline mr-1" />
                        {doc.admin_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Messages Section */}
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-semibold mb-6" style={{ fontFamily: 'Fraunces, serif' }}>Messages</h2>
          
          <div className="space-y-4 max-h-80 overflow-y-auto mb-6">
            {messages.length === 0 ? (
              <p className="text-center opacity-60 py-8">No messages yet. Send a message to get started.</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[80%] p-4 ${msg.sender_type === 'client' ? 'chat-bubble-client ml-auto' : 'chat-bubble-admin'}`}
                  data-testid={`message-${msg.id}`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-xs opacity-60 mt-1">
                    {msg.sender_name} • {new Date(msg.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-3">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1"
              data-testid="message-input"
            />
            <Button
              onClick={handleSendMessage}
              disabled={sendingMessage || !newMessage.trim()}
              className="btn-primary"
              data-testid="send-message-btn"
            >
              <Send size={20} />
            </Button>
          </div>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Fraunces, serif' }}>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-medium mb-2">Selected File:</p>
              <p className="file-preview text-sm">{uploadFile?.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Document Name</label>
              <Input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="mt-2"
                data-testid="doc-name-input"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Document Type</label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="mt-2" data-testid="doc-type-select">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {request.required_documents.map((doc) => (
                    <SelectItem key={doc} value={doc}>{doc}</SelectItem>
                  ))}
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading} className="btn-primary" data-testid="confirm-upload-btn">
              {uploading ? <span className="spinner" style={{ width: 20, height: 20 }}></span> : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Fraunces, serif' }}>Complete Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center py-4" style={{ backgroundColor: 'var(--secondary)' }}>
              <p className="text-sm opacity-60">Total Amount</p>
              <p className="text-4xl font-bold mono" style={{ color: 'var(--accent)' }}>₹{request.price.toLocaleString()}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="mt-2" data-testid="payment-method-select">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Credit/Debit Card</SelectItem>
                  <SelectItem value="netbanking">Net Banking</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button onClick={handlePayment} disabled={processing} className="btn-primary" data-testid="confirm-payment-btn">
              {processing ? <span className="spinner" style={{ width: 20, height: 20 }}></span> : "Pay Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientRequest;