import { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { Tag, Plus, Edit2, Trash2, Calendar, Users, Percent, DollarSign, Copy, Check, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AdminOffers = () => {
  const { user } = useAuth();
  const [offers, setOffers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  const isSuperAdmin = user?.admin_role === "super_admin";

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    discount_type: "percentage",
    discount_value: "",
    valid_from: "",
    valid_until: "",
    max_uses: "",
    applicable_plans: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [offersRes, plansRes] = await Promise.all([
        api.get("/admin/offers"),
        api.get("/admin/plans")
      ]);
      setOffers(offersRes.data);
      setPlans(plansRes.data.filter(p => p.is_active));
    } catch (err) {
      toast.error("Failed to load offers");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (offer = null) => {
    if (offer) {
      setEditingOffer(offer);
      setFormData({
        code: offer.code,
        name: offer.name,
        description: offer.description,
        discount_type: offer.discount_type,
        discount_value: offer.discount_value.toString(),
        valid_from: offer.valid_from.split("T")[0],
        valid_until: offer.valid_until.split("T")[0],
        max_uses: offer.max_uses?.toString() || "",
        applicable_plans: offer.applicable_plans || []
      });
    } else {
      setEditingOffer(null);
      const today = new Date().toISOString().split("T")[0];
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      setFormData({
        code: "",
        name: "",
        description: "",
        discount_type: "percentage",
        discount_value: "",
        valid_from: today,
        valid_until: nextMonth,
        max_uses: "",
        applicable_plans: []
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.code || !formData.name || !formData.discount_value || !formData.valid_until) {
      toast.error("Please fill all required fields");
      return;
    }

    const payload = {
      code: formData.code.toUpperCase(),
      name: formData.name,
      description: formData.description,
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value),
      valid_from: new Date(formData.valid_from).toISOString(),
      valid_until: new Date(formData.valid_until + "T23:59:59").toISOString(),
      max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
      applicable_plans: formData.applicable_plans.length > 0 ? formData.applicable_plans : null
    };

    setSubmitting(true);
    try {
      if (editingOffer) {
        await api.put(`/admin/offers/${editingOffer.id}`, payload);
        toast.success("Offer updated successfully!");
      } else {
        await api.post("/admin/offers", payload);
        toast.success("Offer created successfully!");
      }
      setShowDialog(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (offerId) => {
    if (!window.confirm("Are you sure you want to deactivate this offer?")) return;

    try {
      await api.delete(`/admin/offers/${offerId}`);
      toast.success("Offer deactivated");
      fetchData();
    } catch (err) {
      toast.error("Failed to deactivate offer");
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const isOfferActive = (offer) => {
    const now = new Date();
    const validFrom = new Date(offer.valid_from);
    const validUntil = new Date(offer.valid_until);
    return offer.is_active && now >= validFrom && now <= validUntil;
  };

  const activeOffers = offers.filter(o => isOfferActive(o));
  const inactiveOffers = offers.filter(o => !isOfferActive(o));

  if (!isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="empty-state bg-white rounded-xl border p-12" style={{ borderColor: 'var(--border)' }}>
          <Gift className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="opacity-60">Only Super Admins can manage offers</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>Discount Offers</h1>
            <p className="opacity-70 mt-1">Create and manage promotional offers</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="btn-primary" data-testid="create-offer-btn">
            <Plus size={20} className="mr-2" /> Create Offer
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : offers.length === 0 ? (
          <div className="empty-state bg-white rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <Tag className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="mb-4">No offers created yet</p>
            <Button onClick={() => handleOpenDialog()} className="btn-primary">Create First Offer</Button>
          </div>
        ) : (
          <>
            {/* Active Offers */}
            {activeOffers.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  Active Offers ({activeOffers.length})
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeOffers.map((offer) => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      onEdit={handleOpenDialog}
                      onDelete={handleDelete}
                      onCopy={copyCode}
                      copiedCode={copiedCode}
                      plans={plans}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Inactive Offers */}
            {inactiveOffers.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  Expired/Inactive Offers ({inactiveOffers.length})
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inactiveOffers.map((offer) => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      onEdit={handleOpenDialog}
                      onDelete={handleDelete}
                      onCopy={copyCode}
                      copiedCode={copiedCode}
                      plans={plans}
                      inactive
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Fraunces, serif' }}>
              {editingOffer ? "Edit Offer" : "Create New Offer"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Offer Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="SAVE20"
                  className="mt-2 uppercase"
                  disabled={!!editingOffer}
                  data-testid="offer-code-input"
                />
              </div>
              <div>
                <Label>Discount Type *</Label>
                <Select value={formData.discount_type} onValueChange={(v) => setFormData({ ...formData, discount_type: v })}>
                  <SelectTrigger className="mt-2" data-testid="discount-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Offer Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="New Year Special"
                className="mt-2"
                data-testid="offer-name-input"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Get 20% off on all plans"
                className="mt-2"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Discount Value *</Label>
                <div className="relative mt-2">
                  <Input
                    type="number"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    placeholder={formData.discount_type === "percentage" ? "20" : "500"}
                    className="pr-10"
                    data-testid="discount-value-input"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50">
                    {formData.discount_type === "percentage" ? "%" : "₹"}
                  </span>
                </div>
              </div>
              <div>
                <Label>Max Uses (optional)</Label>
                <Input
                  type="number"
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                  placeholder="Unlimited"
                  className="mt-2"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valid From *</Label>
                <Input
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  className="mt-2"
                  data-testid="valid-from-input"
                />
              </div>
              <div>
                <Label>Valid Until *</Label>
                <Input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  className="mt-2"
                  data-testid="valid-until-input"
                />
              </div>
            </div>
            <div>
              <Label>Applicable Plans (leave empty for all)</Label>
              <div className="mt-2 space-y-2 max-h-32 overflow-y-auto p-2 border rounded-lg" style={{ borderColor: 'var(--border)' }}>
                {plans.map((plan) => (
                  <label key={plan.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.applicable_plans.includes(plan.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, applicable_plans: [...formData.applicable_plans, plan.id] });
                        } else {
                          setFormData({ ...formData, applicable_plans: formData.applicable_plans.filter(id => id !== plan.id) });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{plan.name} - ₹{plan.price}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="btn-primary" data-testid="save-offer-btn">
              {submitting ? <span className="spinner" style={{ width: 20, height: 20 }}></span> : (editingOffer ? "Update" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

const OfferCard = ({ offer, onEdit, onDelete, onCopy, copiedCode, plans, inactive }) => {
  const discountText = offer.discount_type === "percentage" 
    ? `${offer.discount_value}% OFF` 
    : `₹${offer.discount_value} OFF`;

  const applicablePlanNames = offer.applicable_plans 
    ? plans.filter(p => offer.applicable_plans.includes(p.id)).map(p => p.name)
    : [];

  return (
    <div 
      className={`bg-white rounded-xl border p-6 ${inactive ? 'opacity-60' : ''}`} 
      style={{ borderColor: 'var(--border)' }}
      data-testid={`offer-card-${offer.id}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: inactive ? 'var(--muted)' : 'var(--accent)', color: 'white' }}
          >
            {offer.discount_type === "percentage" ? <Percent size={24} /> : <DollarSign size={24} />}
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: inactive ? 'inherit' : 'var(--accent)' }}>{discountText}</p>
            <p className="text-sm opacity-60">{offer.name}</p>
          </div>
        </div>
        {!offer.is_active && <Badge variant="secondary">Deactivated</Badge>}
      </div>

      <div 
        className="flex items-center gap-2 p-3 rounded-lg mb-4 cursor-pointer"
        style={{ backgroundColor: 'var(--secondary)' }}
        onClick={() => onCopy(offer.code)}
      >
        <code className="font-bold text-lg flex-1">{offer.code}</code>
        {copiedCode === offer.code ? (
          <Check size={18} className="text-green-600" />
        ) : (
          <Copy size={18} className="opacity-50" />
        )}
      </div>

      <p className="text-sm opacity-70 mb-4">{offer.description || "No description"}</p>

      <div className="space-y-2 text-sm mb-4">
        <div className="flex items-center gap-2 opacity-70">
          <Calendar size={14} />
          <span>
            {new Date(offer.valid_from).toLocaleDateString()} - {new Date(offer.valid_until).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-2 opacity-70">
          <Users size={14} />
          <span>
            Used: {offer.current_uses || 0}{offer.max_uses ? ` / ${offer.max_uses}` : ' (unlimited)'}
          </span>
        </div>
      </div>

      {applicablePlanNames.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase opacity-50 mb-2">Applicable Plans</p>
          <div className="flex flex-wrap gap-1">
            {applicablePlanNames.slice(0, 2).map((name, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">{name}</Badge>
            ))}
            {applicablePlanNames.length > 2 && (
              <Badge variant="secondary" className="text-xs">+{applicablePlanNames.length - 2}</Badge>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(offer)} data-testid={`edit-offer-${offer.id}`}>
          <Edit2 size={16} className="mr-1" /> Edit
        </Button>
        {offer.is_active && (
          <Button variant="outline" size="sm" onClick={() => onDelete(offer.id)} className="text-red-600">
            <Trash2 size={16} className="mr-1" /> Deactivate
          </Button>
        )}
      </div>
    </div>
  );
};

export default AdminOffers;
