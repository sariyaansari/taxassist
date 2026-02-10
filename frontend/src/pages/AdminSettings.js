import { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { Settings, Mail, Bell, Save, Shield, Check, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const AdminSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    notification_email: "",
    new_case_email_enabled: true,
    payment_email_enabled: true,
    message_email_enabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // CA Admin permissions
  const [admins, setAdmins] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const isSuperAdmin = user?.admin_role === "super_admin";

  useEffect(() => {
    if (isSuperAdmin) {
      fetchData();
    }
  }, [isSuperAdmin]);

  const fetchData = async () => {
    try {
      const [settingsRes, adminsRes, permissionsRes] = await Promise.all([
        api.get("/admin/settings"),
        api.get("/admin/admins"),
        api.get("/admin/permissions/available")
      ]);
      setSettings(settingsRes.data);
      setAdmins(adminsRes.data.filter(a => a.admin_role === "ca_admin"));
      setAvailablePermissions(permissionsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put("/admin/settings", settings);
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAdmin = (admin) => {
    setSelectedAdmin(admin);
    setSelectedPermissions(admin.permissions || []);
  };

  const handleSavePermissions = async () => {
    if (!selectedAdmin) return;
    
    setSavingPermissions(true);
    try {
      await api.put(`/admin/users/${selectedAdmin.id}/permissions`, {
        permissions: selectedPermissions
      });
      toast.success("Permissions updated successfully");
      fetchData();
      setSelectedAdmin(null);
    } catch (err) {
      toast.error("Failed to update permissions");
    } finally {
      setSavingPermissions(false);
    }
  };

  const togglePermission = (permId) => {
    if (selectedPermissions.includes(permId)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== permId));
    } else {
      setSelectedPermissions([...selectedPermissions, permId]);
    }
  };

  if (!isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="empty-state bg-white rounded-xl border p-12" style={{ borderColor: 'var(--border)' }}>
          <Settings className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="opacity-60">Only Super Admins can access settings</p>
        </div>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <div className="spinner"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>Settings</h1>
          <p className="opacity-70 mt-1">Configure notifications and admin permissions</p>
        </div>

        <Tabs defaultValue="notifications">
          <TabsList>
            <TabsTrigger value="notifications">
              <Bell size={16} className="mr-2" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="permissions">
              <Shield size={16} className="mr-2" /> CA Admin Permissions
            </TabsTrigger>
          </TabsList>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-6">
            <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-xl font-semibold mb-6" style={{ fontFamily: 'Fraunces, serif' }}>Email Notifications</h2>
              
              <div className="space-y-6">
                <div>
                  <Label className="text-base">Admin Notification Email</Label>
                  <p className="text-sm opacity-60 mb-2">All admin notifications will be sent to this email</p>
                  <Input
                    type="email"
                    value={settings.notification_email || ""}
                    onChange={(e) => setSettings({ ...settings, notification_email: e.target.value })}
                    placeholder="admin@taxassist.com"
                    className="max-w-md"
                    data-testid="notification-email-input"
                  />
                </div>

                <div className="border-t pt-6" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="font-semibold mb-4">Notification Preferences</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                      <div>
                        <p className="font-medium">New Case Created</p>
                        <p className="text-sm opacity-60">Get notified when a client creates a new tax filing request</p>
                      </div>
                      <Switch
                        checked={settings.new_case_email_enabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, new_case_email_enabled: checked })}
                        data-testid="new-case-email-switch"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                      <div>
                        <p className="font-medium">Payment Received</p>
                        <p className="text-sm opacity-60">Get notified when a client makes a payment</p>
                      </div>
                      <Switch
                        checked={settings.payment_email_enabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, payment_email_enabled: checked })}
                        data-testid="payment-email-switch"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                      <div>
                        <p className="font-medium">New Messages</p>
                        <p className="text-sm opacity-60">Get notified when a client sends a message</p>
                      </div>
                      <Switch
                        checked={settings.message_email_enabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, message_email_enabled: checked })}
                        data-testid="message-email-switch"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveSettings} disabled={saving} className="btn-primary" data-testid="save-settings-btn">
                    {saving ? (
                      <span className="spinner" style={{ width: 20, height: 20 }}></span>
                    ) : (
                      <>
                        <Save size={18} className="mr-2" /> Save Settings
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="mt-6">
            <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Fraunces, serif' }}>CA Admin Permissions</h2>
              <p className="text-sm opacity-60 mb-6">Control what each CA Admin can access and do in the system</p>

              {admins.length === 0 ? (
                <div className="text-center py-12 opacity-60">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No CA Admins found</p>
                  <p className="text-sm">Create CA Admin users from the Users page</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {admins.map((admin) => (
                    <div 
                      key={admin.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                      style={{ borderColor: 'var(--border)' }}
                      data-testid={`admin-permissions-${admin.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                        >
                          {admin.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold">{admin.name}</p>
                          <p className="text-sm opacity-60">{admin.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(admin.permissions || []).slice(0, 3).map((perm, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {perm.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                          {(admin.permissions || []).length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{admin.permissions.length - 3}
                            </Badge>
                          )}
                          {(!admin.permissions || admin.permissions.length === 0) && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                              <AlertTriangle size={12} className="mr-1" /> No permissions
                            </Badge>
                          )}
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSelectAdmin(admin)}
                          data-testid={`edit-permissions-${admin.id}`}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Permissions Dialog */}
      <Dialog open={!!selectedAdmin} onOpenChange={() => setSelectedAdmin(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Fraunces, serif' }}>
              Edit Permissions - {selectedAdmin?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm opacity-60 mb-4">
              Select which features this admin can access. Changes take effect immediately after saving.
            </p>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {availablePermissions.map((perm) => (
                <label
                  key={perm.id}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedPermissions.includes(perm.id) ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                  }`}
                >
                  <Checkbox
                    checked={selectedPermissions.includes(perm.id)}
                    onCheckedChange={() => togglePermission(perm.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-medium">{perm.name}</p>
                    <p className="text-sm opacity-60">{perm.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAdmin(null)}>Cancel</Button>
            <Button 
              onClick={handleSavePermissions} 
              disabled={savingPermissions} 
              className="btn-primary"
              data-testid="save-permissions-btn"
            >
              {savingPermissions ? "Saving..." : "Save Permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminSettings;
