import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ClientLayout } from "../components/ClientLayout";
import { api } from "../App";
import { toast } from "sonner";
import { Upload, FileText, Check, X, AlertTriangle, CreditCard, Send, ArrowLeft, RefreshCw, Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const ClientRequest = () => {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [request, setRequest] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Upload state
  const [uploadingFor, setUploadingFor] = useState(null);
  const [replaceDocId, setReplaceDocId] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [docName, setDocName] = useState("");
  const [docPassword, setDocPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  
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

  // Get document for a specific type
  const getDocumentForType = (docType) => {
    return documents.find(d => d.document_type === docType);
  };

  // Check if all required documents are uploaded and approved
  const allDocsApproved = () => {
    if (!request) return false;
    return request.required_documents.every(docType => {
      const doc = getDocumentForType(docType);
      return doc && doc.status === 'approved';
    });
  };

  // Check if all required documents are uploaded (any status)
  const allDocsUploaded = () => {
    if (!request) return false;
    return request.required_documents.every(docType => {
      const doc = getDocumentForType(docType);
      return doc !== undefined;
    });
  };

  // Check if there are rejected documents that need re-upload
  const hasRejectedDocs = () => {
    return documents.some(d => d.status === 'rejected' || d.status === 'needs_revision');
  };

  // Handle click on required document - opens upload dialog
  const handleDocumentClick = (docType) => {
    const existingDoc = getDocumentForType(docType);
    
    if (existingDoc && (existingDoc.status === 'rejected' || existingDoc.status === 'needs_revision')) {
      // Replace rejected document
      setReplaceDocId(existingDoc.id);
    } else if (existingDoc) {
      // Document exists and is not rejected - no action
      return;
    }
    
    setUploadingFor(docType);
    setDocName(docType);
    fileInputRef.current?.click();
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setUploadFile(file);
      if (!docName) {
        setDocName(file.name.split('.')[0]);
      }
    }
    e.target.value = ''; // Reset input
  };

  // Upload document
  const handleUpload = async () => {
    if (!uploadFile || !uploadingFor || !docName) {
      toast.error("Please select a file");
      return;
    }
    
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        try {
          await api.post(`/requests/${requestId}/documents`, {
            name: docName,
            document_type: uploadingFor,
            file_data: base64,
            file_name: uploadFile.name,
            password: hasPassword ? docPassword : null
          });
          toast.success(replaceDocId ? "Document replaced successfully!" : "Document uploaded successfully!");
          resetUploadState();
          fetchData();
        } catch (err) {
          if (err.response?.data?.detail?.includes("approved")) {
            toast.error("This document is approved. Please message admin to request changes.");
          } else {
            toast.error(err.response?.data?.detail || "Failed to upload document");
          }
          setUploading(false);
        }
      };
      reader.readAsDataURL(uploadFile);
    } catch (err) {
      toast.error("Failed to read file");
      setUploading(false);
    }
  };

  const resetUploadState = () => {
    setUploadFile(null);
    setUploadingFor(null);
    setReplaceDocId(null);
    setDocName("");
    setDocPassword("");
    setHasPassword(false);
    setUploading(false);
  };

  // Send message
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

  // Process payment
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

  const getDocStatus = (docType) => {
    const doc = getDocumentForType(docType);
    if (!doc) return { status: 'missing', label: 'Upload Required', color: 'var(--muted)' };
    
    const statusMap = {
      pending: { label: 'Under Review', color: 'var(--warning)' },
      approved: { label: 'Approved', color: 'var(--success)' },
      rejected: { label: 'Rejected - Reupload', color: 'var(--error)' },
      needs_revision: { label: 'Needs Changes', color: 'var(--warning)' }
    };
    
    return { status: doc.status, ...statusMap[doc.status], doc };
  };

  const getProgress = () => {
    if (!request) return 0;
    const total = request.required_documents.length;
    const approved = request.required_documents.filter(dt => {
      const doc = getDocumentForType(dt);
      return doc && doc.status === 'approved';
    }).length;
    return Math.round((approved / total) * 100);
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

  const canPay = allDocsUploaded() && request.payment_status === 'unpaid' && !hasRejectedDocs();

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        />

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
              <Badge className={`status-${request.status}`}>{request.status.replace('_', ' ')}</Badge>
              <Badge className={`status-${request.payment_status}`}>{request.payment_status}</Badge>
            </div>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Document Progress</h2>
            <span className="mono font-bold" style={{ color: 'var(--accent)' }}>{getProgress()}%</span>
          </div>
          <div className="progress-bar h-3 mb-2">
            <div className="progress-fill" style={{ width: `${getProgress()}%` }}></div>
          </div>
          <p className="text-sm opacity-60">
            {getProgress() === 100 ? 'All documents approved! Ready for filing.' : 
             allDocsUploaded() ? 'Documents under review. We\'ll notify you of any updates.' :
             'Upload all required documents to proceed.'}
          </p>
        </div>

        {/* Required Documents - Click to Upload */}
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-semibold mb-6" style={{ fontFamily: 'Fraunces, serif' }}>Required Documents</h2>
          <p className="text-sm opacity-60 mb-4">Click on any document to upload. If rejected, click to replace.</p>
          
          <div className="grid gap-4">
            {request.required_documents.map((docType, idx) => {
              const docStatus = getDocStatus(docType);
              const isClickable = docStatus.status === 'missing' || docStatus.status === 'rejected' || docStatus.status === 'needs_revision';
              
              return (
                <div
                  key={idx}
                  onClick={() => isClickable && handleDocumentClick(docType)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isClickable ? 'cursor-pointer hover:shadow-md hover:border-orange-300' : 'cursor-default'
                  }`}
                  style={{ 
                    borderColor: docStatus.status === 'missing' ? 'var(--border)' : docStatus.color,
                    backgroundColor: docStatus.status === 'approved' ? '#f0fdf4' : 
                                    docStatus.status === 'rejected' || docStatus.status === 'needs_revision' ? '#fef2f2' : 
                                    'white'
                  }}
                  data-testid={`doc-slot-${idx}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        docStatus.status === 'missing' ? 'border-2 border-dashed' : ''
                      }`} style={{ 
                        borderColor: docStatus.status === 'missing' ? 'var(--border)' : 'transparent',
                        backgroundColor: docStatus.status === 'missing' ? 'transparent' : `${docStatus.color}20`
                      }}>
                        {docStatus.status === 'missing' ? (
                          <Upload size={20} className="opacity-40" />
                        ) : docStatus.status === 'approved' ? (
                          <Check size={24} style={{ color: docStatus.color }} />
                        ) : docStatus.status === 'rejected' || docStatus.status === 'needs_revision' ? (
                          <RefreshCw size={20} style={{ color: docStatus.color }} />
                        ) : (
                          <FileText size={20} style={{ color: docStatus.color }} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{docType}</p>
                        <p className="text-sm" style={{ color: docStatus.color }}>{docStatus.label}</p>
                        {docStatus.doc?.admin_notes && (
                          <p className="text-sm mt-1 text-red-600">
                            <AlertTriangle size={12} className="inline mr-1" />
                            {docStatus.doc.admin_notes}
                          </p>
                        )}
                      </div>
                    </div>
                    {isClickable && (
                      <Button variant="outline" size="sm" className="shrink-0">
                        {docStatus.status === 'missing' ? 'Upload' : 'Replace'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Additional Document Upload */}
          <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
            <Button
              variant="outline"
              onClick={() => {
                setUploadingFor("Other");
                setDocName("");
                fileInputRef.current?.click();
              }}
              className="w-full"
              data-testid="upload-additional-btn"
            >
              <Plus size={18} className="mr-2" /> Upload Additional Document
            </Button>
          </div>
        </div>

        {/* Payment Section - Only show if all docs uploaded and not rejected */}
        {canPay && (
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--accent)', borderWidth: 2 }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Ready for Payment</h3>
                <p className="text-sm opacity-70">All documents uploaded. Complete payment to start review.</p>
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

        {/* Payment Already Done */}
        {request.payment_status === 'paid' && (
          <div className="bg-green-50 rounded-xl border border-green-200 p-6">
            <div className="flex items-center gap-3">
              <Check size={24} className="text-green-600" />
              <div>
                <h3 className="font-semibold text-green-800">Payment Complete</h3>
                <p className="text-sm text-green-600">Your tax filing is being processed by our team.</p>
              </div>
            </div>
          </div>
        )}

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
                  className={`max-w-[80%] p-4 rounded-lg ${msg.sender_type === 'client' ? 'ml-auto' : ''}`}
                  style={{ 
                    backgroundColor: msg.sender_type === 'client' ? 'var(--primary)' : 'var(--secondary)',
                    color: msg.sender_type === 'client' ? 'white' : 'inherit'
                  }}
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

      {/* Upload Confirmation Dialog */}
      <Dialog open={!!uploadFile} onOpenChange={() => resetUploadState()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Fraunces, serif' }}>
              {replaceDocId ? 'Replace Document' : 'Upload Document'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
              <p className="font-medium">{uploadFile?.name}</p>
              <p className="text-sm opacity-60">For: {uploadingFor}</p>
              {replaceDocId && (
                <p className="text-sm text-orange-600 mt-1">This will replace the existing document</p>
              )}
            </div>
            <div>
              <Label>Document Name</Label>
              <Input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="mt-2"
                placeholder="Enter document name"
                data-testid="doc-name-input"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasPassword"
                checked={hasPassword}
                onCheckedChange={setHasPassword}
              />
              <label htmlFor="hasPassword" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                <Lock size={14} /> This document has a password
              </label>
            </div>
            {hasPassword && (
              <div>
                <Label>Document Password</Label>
                <Input
                  type="text"
                  value={docPassword}
                  onChange={(e) => setDocPassword(e.target.value)}
                  className="mt-2"
                  placeholder="Enter password to open document"
                  data-testid="doc-password-input"
                />
                <p className="text-xs opacity-60 mt-1">This will help our team open your document</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetUploadState}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading} className="btn-primary" data-testid="confirm-upload-btn">
              {uploading ? <span className="spinner" style={{ width: 20, height: 20 }}></span> : (replaceDocId ? "Replace" : "Upload")}
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
            <div className="text-center py-4 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
              <p className="text-sm opacity-60">Total Amount</p>
              <p className="text-4xl font-bold mono" style={{ color: 'var(--accent)' }}>₹{request.price.toLocaleString()}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Payment Method</label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {['upi', 'card', 'netbanking'].map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      paymentMethod === method ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid={`payment-${method}`}
                  >
                    <p className="font-medium capitalize">{method === 'upi' ? 'UPI' : method === 'card' ? 'Card' : 'Net Banking'}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button onClick={handlePayment} disabled={processing || !paymentMethod} className="btn-primary" data-testid="confirm-payment-btn">
              {processing ? <span className="spinner" style={{ width: 20, height: 20 }}></span> : "Pay Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientRequest;
