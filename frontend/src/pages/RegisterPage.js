import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { toast } from "sonner";
import { FileText, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, phone, password, confirmPassword } = formData;
    
    if (!name || !email || !phone || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await register({ name, email, phone, password, user_type: "client" });
      toast.success("Account created successfully!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--secondary)' }}>
      {/* Left Side - Visual */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12" style={{ backgroundColor: 'var(--primary)' }}>
        <div className="text-white text-center max-w-md">
          <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Fraunces, serif' }}>Start Your Tax Journey</h2>
          <p className="opacity-80 text-lg">Create an account to get started with hassle-free tax filing.</p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8" data-testid="logo-link">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
              <FileText className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold" style={{ fontFamily: 'Fraunces, serif', color: 'var(--primary)' }}>TaxAssist</span>
          </Link>

          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Fraunces, serif' }}>Create Account</h1>
          <p className="opacity-70 mb-8">Fill in your details to get started</p>

          <form onSubmit={handleSubmit} className="space-y-5" data-testid="register-form">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                className="mt-2"
                data-testid="name-input"
              />
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="mt-2"
                data-testid="email-input"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 9876543210"
                className="mt-2"
                data-testid="phone-input"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  data-testid="password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className="mt-2"
                data-testid="confirm-password-input"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3"
              data-testid="register-submit"
            >
              {loading ? <span className="spinner" style={{ width: 20, height: 20 }}></span> : "Create Account"}
            </Button>
          </form>

          <p className="mt-6 text-center">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: 'var(--accent)' }} data-testid="login-link">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;