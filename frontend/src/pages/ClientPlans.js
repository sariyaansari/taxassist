import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClientLayout } from "../components/ClientLayout";
import { api } from "../App";
import { toast } from "sonner";
import { Check, Briefcase, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ClientPlans = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [financialYear, setFinancialYear] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentYear = new Date().getFullYear();
  const financialYears = [
    `${currentYear - 1}-${currentYear}`,
    `${currentYear - 2}-${currentYear - 1}`,
    `${currentYear - 3}-${currentYear - 2}`
  ];

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await api.get("/plans");
      setPlans(res.data);
    } catch (err) {
      toast.error("Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!financialYear) {
      toast.error("Please select a financial year");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/requests", {
        plan_id: selectedPlan.id,
        financial_year: financialYear
      });
      toast.success("Tax filing request created!");
      setShowDialog(false);
      navigate(`/request/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  };

  const salaryPlans = plans.filter(p => p.plan_type === 'salary');
  const businessPlans = plans.filter(p => p.plan_type === 'business');

  return (
    <ClientLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>Choose Your Plan</h1>
          <p className="opacity-70 mt-1">Select the plan that best fits your tax filing needs</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : plans.length === 0 ? (
          <div className="empty-state bg-white rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <p>No plans available at the moment. Please check back later.</p>
          </div>
        ) : (
          <>
            {/* Salary Plans */}
            {salaryPlans.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-6 h-6" style={{ color: 'var(--accent)' }} />
                  <h2 className="text-xl font-semibold" style={{ fontFamily: 'Fraunces, serif' }}>For Salaried Individuals</h2>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {salaryPlans.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} onSelect={handleSelectPlan} />
                  ))}
                </div>
              </div>
            )}

            {/* Business Plans */}
            {businessPlans.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="w-6 h-6" style={{ color: 'var(--accent)' }} />
                  <h2 className="text-xl font-semibold" style={{ fontFamily: 'Fraunces, serif' }}>For Business Owners</h2>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {businessPlans.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} onSelect={handleSelectPlan} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Select Financial Year Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Fraunces, serif' }}>Start Tax Filing</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-4">You selected: <strong>{selectedPlan?.name}</strong></p>
            <Label htmlFor="fy">Select Financial Year</Label>
            <Select value={financialYear} onValueChange={setFinancialYear}>
              <SelectTrigger className="mt-2" data-testid="fy-select">
                <SelectValue placeholder="Choose financial year" />
              </SelectTrigger>
              <SelectContent>
                {financialYears.map((fy) => (
                  <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="btn-primary" data-testid="confirm-plan-btn">
              {submitting ? <span className="spinner" style={{ width: 20, height: 20 }}></span> : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

const PlanCard = ({ plan, onSelect }) => {
  return (
    <div className="plan-card card-hover" data-testid={`plan-card-${plan.id}`}>
      <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Fraunces, serif' }}>{plan.name}</h3>
      <p className="opacity-70 text-sm mb-4">{plan.description}</p>
      
      <div className="mb-4">
        <span className="text-3xl font-bold mono" style={{ color: 'var(--accent)' }}>₹{plan.price.toLocaleString()}</span>
      </div>

      <div className="mb-6">
        <p className="text-sm font-semibold mb-2">What's Included:</p>
        <ul className="space-y-2">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--success)' }} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-6">
        <p className="text-sm font-semibold mb-2">Required Documents:</p>
        <ul className="space-y-1">
          {plan.required_documents.map((doc, idx) => (
            <li key={idx} className="text-sm opacity-70">• {doc}</li>
          ))}
        </ul>
      </div>

      <Button 
        onClick={() => onSelect(plan)} 
        className="w-full btn-primary"
        data-testid={`select-plan-${plan.id}`}
      >
        Select Plan
      </Button>
    </div>
  );
};

export default ClientPlans;