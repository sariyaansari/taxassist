import { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { Users, UserPlus, Shield, Edit2, Mail, Phone, Calendar, FileText, Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminUsers = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("clients");
  
  // User details modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [userRequests, setUserRequests] = useState([]);
  
  // Admin creation modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    admin_role: "ca_admin"
  });
  const [creating, setCreating] = useState(false);
  
  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to_email: "",
    subject: "",
    message: ""
  });
  const [sendingEmail, setSendingEmail] = useState(false);

  const isSuperAdmin = currentUser?.admin_role === "super_admin";

  useEffect(() => {
    fetchUsers();
    if (isSuperAdmin) {
      fetchAdmins();
    }
  }, [isSuperAdmin]);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data.filter(u => u.user_type === "client"));
    } catch (err) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await api.get("/admin/admins");
      setAdmins(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewUser = async (user) => {
    setSelectedUser(user);
    try {
      const res = await api.get(`/admin/users/${user.id}`);
      setUserRequests(res.data.requests || []);
    } catch (err) {
      setUserRequests([]);
    }
  };

  const handleCreateAdmin = async () => {
    if (!adminForm.name || !adminForm.email || !adminForm.password) {
      toast.error("Please fill all required fields");
      return;
    }
    
    setCreating(true);
    try {
      await api.post("/admin/users/admin", adminForm);
      toast.success("Admin user created successfully");
      setShowAdminModal(false);
      setAdminForm({ name: "", email: "", phone: "", password: "", admin_role: "ca_admin" });
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create admin");
    } finally {
      setCreating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailForm.to_email || !emailForm.subject || !emailForm.message) {
      toast.error("Please fill all fields");
      return;
    }
    
    setSendingEmail(true);
    try {
      await api.post("/admin/email/send", emailForm);
      toast.success("Email sent successfully");
      setShowEmailModal(false);
      setEmailForm({ to_email: "", subject: "", message: "" });
    } catch (err) {
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const openEmailModal = (email) => {
    setEmailForm({ ...emailForm, to_email: email });
    setShowEmailModal(true);
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAdmins = admins.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>User Management</h1>
            <p className="opacity-70 mt-1">Manage clients and admin users</p>
          </div>
          {isSuperAdmin && (
            <Button onClick={() => setShowAdminModal(true)} className="btn-primary" data-testid="add-admin-btn">
              <UserPlus size={20} className="mr-2" /> Add Admin
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={20} />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-10"
            data-testid="user-search"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="clients">
              <Users size={16} className="mr-2" /> Clients ({users.length})
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="admins">
                <Shield size={16} className="mr-2" /> Admins ({admins.length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Clients Tab */}
          <TabsContent value="clients" className="mt-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="spinner"></div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="empty-state bg-white rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No clients found</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Phone</th>
                      <th>Cases</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} data-testid={`user-row-${user.id}`}>
                        <td>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm opacity-60">{user.email}</p>
                        </td>
                        <td>{user.phone || "-"}</td>
                        <td>
                          <Badge variant="outline">{user.request_count || 0} cases</Badge>
                        </td>
                        <td className="text-sm opacity-60">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleViewUser(user)}>
                              <Eye size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEmailModal(user.email)}>
                              <Mail size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Admins Tab */}
          {isSuperAdmin && (
            <TabsContent value="admins" className="mt-6">
              {filteredAdmins.length === 0 ? (
                <div className="empty-state bg-white rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No admin users found</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAdmins.map((admin) => (
                    <div 
                      key={admin.id} 
                      className="bg-white rounded-xl border p-5"
                      style={{ borderColor: admin.admin_role === 'super_admin' ? 'var(--accent)' : 'var(--border)' }}
                      data-testid={`admin-card-${admin.id}`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" 
                          style={{ backgroundColor: admin.admin_role === 'super_admin' ? 'var(--accent)' : 'var(--primary)', color: 'white' }}>
                          <Shield size={20} />
                        </div>
                        <Badge className={admin.admin_role === 'super_admin' ? 'bg-orange-100 text-orange-700' : ''}>
                          {admin.admin_role === 'super_admin' ? 'Super Admin' : 'CA Admin'}
                        </Badge>
                      </div>
                      <h3 className="font-semibold">{admin.name}</h3>
                      <p className="text-sm opacity-60 mb-1">{admin.email}</p>
                      <p className="text-sm opacity-60 flex items-center gap-1">
                        <Phone size={12} /> {admin.phone || "Not set"}
                      </p>
                      <p className="text-xs opacity-50 mt-3">
                        <Calendar size={12} className="inline mr-1" />
                        Joined: {new Date(admin.created_at).toLocaleDateString()}
                      </p>
                      {admin.id === currentUser?.id && (
                        <Badge className="mt-3 bg-green-100 text-green-700">You</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* User Details Modal */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Fraunces, serif' }}>Client Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6 py-4">
              {/* User Info */}
              <div className="flex items-center gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                  <span className="text-2xl font-bold">{selectedUser.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{selectedUser.name}</h3>
                  <p className="opacity-60">{selectedUser.email}</p>
                  <p className="opacity-60">{selectedUser.phone}</p>
                </div>
                <Button 
                  variant="outline" 
                  className="ml-auto"
                  onClick={() => {
                    setSelectedUser(null);
                    openEmailModal(selectedUser.email);
                  }}
                >
                  <Mail size={16} className="mr-2" /> Send Email
                </Button>
              </div>

              {/* Cases */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText size={18} /> Cases ({userRequests.length})
                </h3>
                {userRequests.length === 0 ? (
                  <p className="text-sm opacity-60">No cases yet</p>
                ) : (
                  <div className="space-y-3">
                    {userRequests.map((req) => (
                      <div key={req.id} className="p-4 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{req.plan_name}</p>
                            <p className="text-sm opacity-60">FY {req.financial_year}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`status-${req.status}`}>{req.status.replace('_', ' ')}</Badge>
                            <Badge className={`status-${req.payment_status}`}>{req.payment_status}</Badge>
                          </div>
                        </div>
                        <p className="text-sm opacity-50 mt-2">
                          Created: {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Admin Modal */}
      <Dialog open={showAdminModal} onOpenChange={setShowAdminModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Fraunces, serif' }}>Create Admin User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={adminForm.name}
                onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                className="mt-2"
                data-testid="admin-name"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                className="mt-2"
                data-testid="admin-email"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={adminForm.phone}
                onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Password *</Label>
              <Input
                type="password"
                value={adminForm.password}
                onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                className="mt-2"
                data-testid="admin-password"
              />
            </div>
            <div>
              <Label>Role *</Label>
              <Select value={adminForm.admin_role} onValueChange={(v) => setAdminForm({ ...adminForm, admin_role: v })}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin (Full Access)</SelectItem>
                  <SelectItem value="ca_admin">CA Admin (Limited Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdminModal(false)}>Cancel</Button>
            <Button onClick={handleCreateAdmin} disabled={creating} className="btn-primary">
              {creating ? "Creating..." : "Create Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Email Modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Fraunces, serif' }}>Send Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>To</Label>
              <Input value={emailForm.to_email} readOnly className="mt-2 bg-gray-50" />
            </div>
            <div>
              <Label>Subject *</Label>
              <Input
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                className="mt-2"
                placeholder="Email subject"
                data-testid="email-subject"
              />
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea
                value={emailForm.message}
                onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                className="mt-2"
                rows={6}
                placeholder="Type your message..."
                data-testid="email-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailModal(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail} className="btn-primary">
              {sendingEmail ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUsers;
