import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { toast } from "sonner";
import { FileText, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success("Welcome back!");
      navigate(user.user_type === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--secondary)' }}>
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8" data-testid="logo-link">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
              <FileText className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold" style={{ fontFamily: 'Fraunces, serif', color: 'var(--primary)' }}>TaxAssist</span>
          </Link>

          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Fraunces, serif' }}>Welcome Back</h1>
          <p className="opacity-70 mb-8">Sign in to continue to your dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-2"
                data-testid="email-input"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  data-testid="password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
                  data-testid="toggle-password"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3"
              data-testid="login-submit"
            >
              {loading ? <span className="spinner" style={{ width: 20, height: 20 }}></span> : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-center">
            Don't have an account?{" "}
            <Link to="/register" className="font-semibold hover:underline" style={{ color: 'var(--accent)' }} data-testid="register-link">
              Sign Up
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12" style={{ backgroundColor: 'var(--primary)' }}>
        <div className="text-white text-center max-w-md">
          <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Fraunces, serif' }}>Simplify Your Tax Filing</h2>
          <p className="opacity-80 text-lg">Access your documents, track progress, and communicate with experts all in one place.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;