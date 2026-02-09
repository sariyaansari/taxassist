import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../App";
import { toast } from "sonner";
import { MessageCircle, Send, User, FileText, ExternalLink, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const AdminMessages = () => {
  const navigate = useNavigate();
  const [recentChats, setRecentChats] = useState([]);
  const [userRequests, setUserRequests] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchRecentChats();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchConversation(selectedUser.user_id);
      fetchUserRequests(selectedUser.user_id);
    }
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchRecentChats = async () => {
    try {
      const res = await api.get("/admin/messages/recent");
      setRecentChats(res.data);
      if (res.data.length > 0 && !selectedUser) {
        setSelectedUser(res.data[0]);
      }
    } catch (err) {
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  const fetchConversation = async (userId) => {
    try {
      const res = await api.get(`/messages/conversation/${userId}`);
      setMessages(res.data);
    } catch (err) {
      setMessages([]);
    }
  };

  const fetchUserRequests = async (userId) => {
    try {
      const res = await api.get("/admin/requests");
      const userReqs = res.data.filter(r => r.user_id === userId);
      setUserRequests(userReqs);
    } catch (err) {
      setUserRequests([]);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    
    setSending(true);
    try {
      await api.post("/messages", {
        content: newMessage,
        recipient_id: selectedUser.user_id
      });
      setNewMessage("");
      fetchConversation(selectedUser.user_id);
      fetchRecentChats();
    } catch (err) {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>Messages</h1>
          <p className="opacity-70 mt-1">Communicate with clients and view their cases</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : recentChats.length === 0 ? (
          <div className="empty-state bg-white rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No messages yet</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-4 gap-6 h-[calc(100vh-250px)]">
            {/* Chat List */}
            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <h2 className="font-semibold">Conversations</h2>
              </div>
              <div className="overflow-y-auto max-h-[calc(100%-60px)]">
                {recentChats.map((chat) => (
                  <button
                    key={chat.user_id}
                    onClick={() => setSelectedUser(chat)}
                    className={`w-full p-4 text-left border-b transition-colors ${
                      selectedUser?.user_id === chat.user_id ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                    style={{ borderColor: 'var(--border)' }}
                    data-testid={`chat-${chat.user_id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                        <User size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{chat.user_name}</p>
                          {!chat.is_read && (
                            <Badge className="bg-red-500 text-white text-xs">New</Badge>
                          )}
                        </div>
                        <p className="text-sm opacity-60 truncate">{chat.last_message}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Window */}
            <div className="lg:col-span-2 bg-white rounded-xl border flex flex-col" style={{ borderColor: 'var(--border)' }}>
              {selectedUser ? (
                <>
                  <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                      <User size={18} />
                    </div>
                    <div>
                      <p className="font-semibold">{selectedUser.user_name}</p>
                      <p className="text-sm opacity-60">Client</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`max-w-[80%] p-3 rounded-lg ${
                          msg.sender_type === 'admin'
                            ? 'ml-auto'
                            : ''
                        }`}
                        style={{ 
                          backgroundColor: msg.sender_type === 'admin' ? 'var(--primary)' : 'var(--secondary)',
                          color: msg.sender_type === 'admin' ? 'white' : 'inherit'
                        }}
                        data-testid={`msg-${msg.id}`}
                      >
                        <p className="text-xs font-medium opacity-70 mb-1">{msg.sender_name}</p>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs opacity-60 mt-2">
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex gap-3">
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your reply... (Enter to send)"
                        className="flex-1"
                        data-testid="admin-message-input"
                      />
                      <Button
                        onClick={handleSend}
                        disabled={sending || !newMessage.trim()}
                        className="btn-primary self-end"
                        data-testid="admin-send-btn"
                      >
                        <Send size={20} />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="opacity-60">Select a conversation</p>
                </div>
              )}
            </div>

            {/* User Info & Cases Panel */}
            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <h2 className="font-semibold">Client Info</h2>
              </div>
              {selectedUser ? (
                <div className="p-4 space-y-4">
                  {/* User Info */}
                  <div className="text-center pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                      <User size={28} />
                    </div>
                    <p className="font-semibold">{selectedUser.user_name}</p>
                  </div>

                  {/* Active Cases */}
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <FileText size={16} style={{ color: 'var(--accent)' }} />
                      Active Cases ({userRequests.length})
                    </h3>
                    {userRequests.length === 0 ? (
                      <p className="text-sm opacity-60">No active cases</p>
                    ) : (
                      <div className="space-y-2">
                        {userRequests.map((req) => (
                          <div 
                            key={req.id}
                            className="p-3 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                            style={{ backgroundColor: 'var(--secondary)' }}
                            onClick={() => navigate('/admin/requests')}
                            data-testid={`user-case-${req.id}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium text-sm">{req.plan_name}</p>
                              <ExternalLink size={14} className="opacity-50" />
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar size={12} />
                              <span>FY {req.financial_year}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={`status-${req.status} text-xs`}>
                                {req.status.replace('_', ' ')}
                              </Badge>
                              <Badge className={`status-${req.payment_status} text-xs`}>
                                {req.payment_status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate('/admin/documents')}
                    >
                      <FileText size={16} className="mr-2" />
                      View Documents
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center opacity-60">
                  Select a conversation to view client info
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminMessages;
