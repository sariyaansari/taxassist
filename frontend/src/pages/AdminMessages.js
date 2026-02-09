import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../App";
import { toast } from "sonner";
import { MessageCircle, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const AdminMessages = () => {
  const [recentChats, setRecentChats] = useState([]);
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>Messages</h1>
          <p className="opacity-70 mt-1">Communicate with clients</p>
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
          <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
            {/* Chat List */}
            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <h2 className="font-semibold">Recent Conversations</h2>
              </div>
              <div className="overflow-y-auto max-h-[calc(100%-60px)]">
                {recentChats.map((chat) => (
                  <button
                    key={chat.user_id}
                    onClick={() => setSelectedUser(chat)}
                    className={`w-full p-4 text-left border-b transition-colors ${
                      selectedUser?.user_id === chat.user_id ? 'bg-secondary' : 'hover:bg-gray-50'
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
                        className={`max-w-[80%] p-4 ${
                          msg.sender_type === 'admin'
                            ? 'chat-bubble-client ml-auto'
                            : 'chat-bubble-admin'
                        }`}
                        data-testid={`msg-${msg.id}`}
                      >
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
                        placeholder="Type your reply..."
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
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminMessages;