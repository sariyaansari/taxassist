import { useState, useEffect, useRef } from "react";
import { ClientLayout } from "../components/ClientLayout";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ClientMessages = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await api.get("/messages");
      setMessages(res.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    
    setSending(true);
    try {
      await api.post("/messages", { content: newMessage });
      setNewMessage("");
      fetchMessages();
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
    <ClientLayout>
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl border h-[calc(100vh-250px)] flex flex-col" style={{ borderColor: 'var(--border)' }}>
          {/* Header */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h1 className="text-xl font-semibold" style={{ fontFamily: 'Fraunces, serif' }}>Chat with Support</h1>
            <p className="text-sm opacity-60">We typically respond within a few hours</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="spinner"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 opacity-60">
                <p>No messages yet.</p>
                <p className="text-sm">Send a message to get started!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[80%] p-4 ${msg.sender_type === 'client' ? 'chat-bubble-client ml-auto' : 'chat-bubble-admin'}`}
                  data-testid={`message-${msg.id}`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs opacity-60 mt-2">
                    {new Date(msg.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex gap-3">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message... (Press Enter to send)"
                className="flex-1 min-h-[60px] max-h-[120px]"
                data-testid="chat-input"
              />
              <Button
                onClick={handleSend}
                disabled={sending || !newMessage.trim()}
                className="btn-primary self-end"
                data-testid="send-btn"
              >
                <Send size={20} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientMessages;