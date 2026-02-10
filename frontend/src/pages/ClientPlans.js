import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClientLayout } from "../components/ClientLayout";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { Check, Briefcase, User, Tag, X, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const ClientPlans = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [activeOffers, setActiveOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [financialYear, setFinancialYear] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // Offer state
  const [offerCode, setOfferCode] = useState("");
  const [validatingOffer, setValidatingOffer] = useState(false);
  const [appliedOffer, setAppliedOffer] = useState(null);
  const [offerError, setOfferError] = useState("");

  const currentYear = new Date().getFullYear();
  const financialYears = [
    `${currentYear - 1}-${currentYear}`,
    `${currentYear - 2}-${currentYear - 1}`,
    `${currentYear - 3}-${currentYear - 2}`
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [plansRes, offersRes] = await Promise.all([
        api.get("/plans"),
        api.get("/offers/active").catch(() => ({ data: [] }))
      ]);
      setPlans(plansRes.data);
      setActiveOffers(offersRes.data);
    } catch (err) {
      toast.error("Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setAppliedOffer(null);
    setOfferCode("");
    setOfferError("");
    setShowDialog(true);
  };

  const handleApplyOffer = async () => {
    if (!offerCode.trim()) return;
    
    setValidatingOffer(true);
    setOfferError("");
    
    try {
      const res = await api.post("/offers/validate", {
        code: offerCode,
        email: user?.email || "",
        phone: user?.phone || ""
      });
      
      // Check if offer applies to this plan
      if (res.data.applicable_plans && !res.data.applicable_plans.includes(selectedPlan.id)) {
        setOfferError("This offer is not applicable to the selected plan");
        return;
      }
      
      setAppliedOffer(res.data);
      toast.success("Offer applied successfully!");
    } catch (err) {
      setOfferError(err.response?.data?.detail || "Invalid offer code");
    } finally {
      setValidatingOffer(false);
    }
  };

  const removeOffer = () => {
    setAppliedOffer(null);
    setOfferCode("");
    setOfferError("");
  };

  const calculateFinalPrice = () => {
    if (!selectedPlan) return 0;
    if (!appliedOffer) return selectedPlan.price;
    
    if (appliedOffer.discount_type === "percentage") {
      return selectedPlan.price - (selectedPlan.price * appliedOffer.discount_value / 100);
    }
    return Math.max(0, selectedPlan.price - appliedOffer.discount_value);
  };

  const handleSubmit = async () => {
    if (!financialYear) {
      toast.error("Please select a financial year");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        plan_id: selectedPlan.id,
        financial_year: financialYear
      };
      
      if (appliedOffer) {
        payload.offer_code = appliedOffer.code;
        payload.offer_email = user?.email;
        payload.offer_phone = user?.phone;
      }
      
      const res = await api.post("/requests", payload);
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

        {/* Active Offers Banner */}
        {activeOffers.length > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gift size={20} className="text-orange-500" />
              <span className="font-semibold text-orange-800">Special Offers Available!</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeOffers.map((offer, idx) => (
                <Badge 
                  key={idx} 
                  className="bg-orange-100 text-orange-700 hover:bg-orange-200 cursor-pointer"
                  onClick={() => setOfferCode(offer.code)}
                >
                  {offer.code}: {offer.discount_type === "percentage" ? `${offer.discount_value}% OFF` : `₹${offer.discount_value} OFF`}
                </Badge>
              ))}
            </div>
          </div>
        )}

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
                <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Fraunces, serif' }}>Start Tax Filing</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
              <p className="font-semibold">{selectedPlan?.name}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm opacity-70">Plan Price</span>
                <span className="text-xl font-bold mono" style={{ color: 'var(--accent)' }}>
                  ₹{selectedPlan?.price.toLocaleString()}
                </span>
              </div>
            </div>
            
            <div>
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

            {/* Offer Code Section */}
            <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <Label className="flex items-center gap-2">
                <Tag size={16} />
                Have an offer code?
              </Label>
              
              {appliedOffer ? (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-green-800">{appliedOffer.code} applied!</p>
                    <p className="text-sm text-green-600">
                      {appliedOffer.discount_type === "percentage" 
                        ? `${appliedOffer.discount_value}% discount`
                        : `₹${appliedOffer.discount_value} off`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={removeOffer} className="text-red-500">
                    <X size={18} />
                  </Button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Input
                    value={offerCode}
                    onChange={(e) => {
                      setOfferCode(e.target.value.toUpperCase());
                      setOfferError("");
                    }}
                    placeholder="Enter offer code"
                    className="flex-1 uppercase"
                    data-testid="offer-code-input"
                  />
                  <Button 
                    variant="outline" 
                    onClick={handleApplyOffer}
                    disabled={!offerCode.trim() || validatingOffer}
                  >
                    {validatingOffer ? "..." : "Apply"}
                  </Button>
                </div>
              )}
              {offerError && (
                <p className="text-sm text-red-500 mt-1">{offerError}</p>
              )}
            </div>

            {/* Final Price */}
            {appliedOffer && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm line-through opacity-50">₹{selectedPlan?.price.toLocaleString()}</span>
                  <div className="text-right">
                    <p className="text-xs text-green-600 mb-1">After discount</p>
                    <span className="text-2xl font-bold mono text-green-700">
                      ₹{calculateFinalPrice().toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !financialYear} className="btn-primary" data-testid="confirm-plan-btn">
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
    <div className="plan-card card-hover h-full flex flex-col" data-testid={`plan-card-${plan.id}`}>
      <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Fraunces, serif' }}>{plan.name}</h3>
      <p className="opacity-70 text-sm mb-4 flex-grow-0">{plan.description}</p>
      
      <div className="mb-4">
        <span className="text-3xl font-bold mono" style={{ color: 'var(--accent)' }}>₹{plan.price.toLocaleString()}</span>
      </div>

      <div className="mb-6 flex-grow">
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
        className="w-full btn-primary mt-auto"
        data-testid={`select-plan-${plan.id}`}
      >
        Select Plan
      </Button>
    </div>
  );
};

export default ClientPlans;