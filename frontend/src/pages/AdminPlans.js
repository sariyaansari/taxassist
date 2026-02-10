import { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../App";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, User, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const AdminPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    plan_type: "salary",
    price: "",
    required_documents: "",
    features: ""
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await api.get("/admin/plans");
      setPlans(res.data);
    } catch (err) {
      toast.error("Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (plan = null) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        description: plan.description,
        plan_type: plan.plan_type,
        price: plan.price.toString(),
        required_documents: plan.required_documents.join("\n"),
        features: plan.features.join("\n")
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: "",
        description: "",
        plan_type: "salary",
        price: "",
        required_documents: "",
        features: ""
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.description || !formData.price) {
      toast.error("Please fill all required fields");
      return;
    }

    const payload = {
      name: formData.name,
      description: formData.description,
      plan_type: formData.plan_type,
      price: parseFloat(formData.price),
      required_documents: formData.required_documents.split("\n").filter(d => d.trim()),
      features: formData.features.split("\n").filter(f => f.trim())
    };

    setSubmitting(true);
    try {
      if (editingPlan) {
        await api.put(`/admin/plans/${editingPlan.id}`, payload);
        toast.success("Plan updated successfully!");
      } else {
        await api.post("/admin/plans", payload);
        toast.success("Plan created successfully!");
      }
      setShowDialog(false);
      fetchPlans();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (planId) => {
    if (!window.confirm("Are you sure you want to deactivate this plan?")) return;
    
    try {
      await api.delete(`/admin/plans/${planId}`);
      toast.success("Plan deactivated");
      fetchPlans();
    } catch (err) {
      toast.error("Failed to deactivate plan");
    }
  };

  const salaryPlans = plans.filter(p => p.plan_type === 'salary' && p.is_active);
  const businessPlans = plans.filter(p => p.plan_type === 'business' && p.is_active);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>Tax Plans</h1>
            <p className="opacity-70 mt-1">Create and manage tax filing plans</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="btn-primary" data-testid="create-plan-btn">
            <Plus size={20} className="mr-2" /> Create Plan
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : plans.length === 0 ? (
          <div className="empty-state bg-white rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <p className="mb-4">No plans created yet</p>
            <Button onClick={() => handleOpenDialog()} className="btn-primary">Create First Plan</Button>
          </div>
        ) : (
          <>
            {/* Salary Plans */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <User size={20} style={{ color: 'var(--accent)' }} />
                <h2 className="text-xl font-semibold">Salary Plans ({salaryPlans.length})</h2>
              </div>
              {salaryPlans.length === 0 ? (
                <p className="text-sm opacity-60 p-4 bg-gray-50 rounded-lg">No salary plans created yet</p>
              ) : (
                <div className="grid sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {salaryPlans.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} onEdit={handleOpenDialog} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>

            {/* Business Plans */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Briefcase size={20} style={{ color: 'var(--accent)' }} />
                <h2 className="text-xl font-semibold">Business Plans ({businessPlans.length})</h2>
              </div>
              {businessPlans.length === 0 ? (
                <p className="text-sm opacity-60 p-4 bg-gray-50 rounded-lg">No business plans created yet</p>
              ) : (
                <div className="grid sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {businessPlans.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} onEdit={handleOpenDialog} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Fraunces, serif' }}>
              {editingPlan ? "Edit Plan" : "Create New Plan"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Plan Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Basic Salary Filing"
                className="mt-2"
                data-testid="plan-name-input"
              />
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the plan"
                className="mt-2"
                data-testid="plan-desc-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Plan Type *</Label>
                <Select value={formData.plan_type} onValueChange={(v) => setFormData({ ...formData, plan_type: v })}>
                  <SelectTrigger className="mt-2" data-testid="plan-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salary">Salary</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price (₹) *</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="999"
                  className="mt-2"
                  data-testid="plan-price-input"
                />
              </div>
            </div>
            <div>
              <Label>Required Documents (one per line)</Label>
              <Textarea
                value={formData.required_documents}
                onChange={(e) => setFormData({ ...formData, required_documents: e.target.value })}
                placeholder="Form 16\nPAN Card\nAadhar Card"
                className="mt-2"
                rows={4}
                data-testid="plan-docs-input"
              />
            </div>
            <div>
              <Label>Features (one per line)</Label>
              <Textarea
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                placeholder="Expert review\n24/7 support\nFast processing"
                className="mt-2"
                rows={4}
                data-testid="plan-features-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="btn-primary" data-testid="save-plan-btn">
              {submitting ? <span className="spinner" style={{ width: 20, height: 20 }}></span> : (editingPlan ? "Update" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

const PlanCard = ({ plan, onEdit, onDelete }) => (
  <div className="bg-white rounded-xl border p-6 h-full flex flex-col" style={{ borderColor: 'var(--border)' }} data-testid={`plan-card-${plan.id}`}>
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-semibold truncate">{plan.name}</h3>
        <Badge variant="outline" className="mt-1">{plan.plan_type}</Badge>
      </div>
      <p className="text-2xl font-bold mono shrink-0 ml-2" style={{ color: 'var(--accent)' }}>₹{plan.price.toLocaleString()}</p>
    </div>
    <p className="text-sm opacity-70 mb-4 line-clamp-2">{plan.description}</p>
    <div className="mb-4 flex-grow">
      <p className="text-xs font-semibold uppercase opacity-50 mb-2">Required Docs</p>
      <div className="flex flex-wrap gap-1">
        {plan.required_documents.slice(0, 3).map((doc, idx) => (
          <Badge key={idx} variant="secondary" className="text-xs">{doc}</Badge>
        ))}
        {plan.required_documents.length > 3 && (
          <Badge variant="secondary" className="text-xs">+{plan.required_documents.length - 3}</Badge>
        )}
      </div>
    </div>
    <div className="flex gap-2 mt-auto">
      <Button variant="outline" size="sm" onClick={() => onEdit(plan)} data-testid={`edit-plan-${plan.id}`}>
        <Edit2 size={16} className="mr-1" /> Edit
      </Button>
      <Button variant="outline" size="sm" onClick={() => onDelete(plan.id)} className="text-red-600" data-testid={`delete-plan-${plan.id}`}>
        <Trash2 size={16} className="mr-1" /> Deactivate
      </Button>
    </div>
  </div>
);

export default AdminPlans;