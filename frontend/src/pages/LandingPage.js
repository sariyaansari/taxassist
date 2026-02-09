import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { FileText, Shield, MessageCircle, CreditCard, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const LandingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const features = [
    {
      icon: <FileText className="w-8 h-8" />,
      title: "Easy Document Upload",
      description: "Securely upload all your tax documents in one place"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Expert Review",
      description: "Our tax experts review every document thoroughly"
    },
    {
      icon: <MessageCircle className="w-8 h-8" />,
      title: "Direct Communication",
      description: "Chat directly with your assigned tax consultant"
    },
    {
      icon: <CreditCard className="w-8 h-8" />,
      title: "Transparent Pricing",
      description: "No hidden fees, pay only for what you need"
    }
  ];

  const steps = [
    { num: "01", title: "Create Account", desc: "Sign up and complete your profile" },
    { num: "02", title: "Choose Plan", desc: "Select the right plan for your needs" },
    { num: "03", title: "Upload Documents", desc: "Submit required documents securely" },
    { num: "04", title: "Get Filed", desc: "We handle the rest, you relax" }
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-header px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
              <FileText className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold" style={{ fontFamily: 'Fraunces, serif', color: 'var(--primary)' }}>TaxAssist</span>
          </Link>
          <nav className="flex items-center gap-4">
            {user ? (
              <Button
                data-testid="dashboard-btn"
                onClick={() => navigate(user.user_type === "admin" ? "/admin" : "/dashboard")}
                className="btn-primary"
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Link to="/login" className="font-medium hover:opacity-70" data-testid="login-link">
                  Login
                </Link>
                <Button
                  data-testid="get-started-btn"
                  onClick={() => navigate("/register")}
                  className="btn-primary"
                >
                  Get Started
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl animate-fade-in-up">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>
              Tax Filing Made <span style={{ color: 'var(--accent)' }}>Simple</span>
            </h1>
            <p className="text-xl opacity-90 mb-8 leading-relaxed">
              Whether you're a salaried professional or a business owner, we make tax filing stress-free. Upload documents, track progress, and get expert assistance.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                data-testid="hero-get-started"
                onClick={() => navigate("/register")}
                className="px-8 py-4 text-lg font-semibold rounded-full"
                style={{ backgroundColor: 'var(--accent)', color: 'white' }}
              >
                Start Filing <ArrowRight className="inline ml-2" />
              </Button>
              <Button
                data-testid="hero-learn-more"
                variant="outline"
                className="px-8 py-4 text-lg font-semibold rounded-full border-white text-white hover:bg-white hover:text-primary"
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4" style={{ fontFamily: 'Fraunces, serif' }}>Why Choose TaxAssist?</h2>
          <p className="text-center text-lg opacity-70 mb-12 max-w-2xl mx-auto">
            We combine technology with expertise to deliver a seamless tax filing experience
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="feature-card animate-fade-in-up"
                style={{ animationDelay: `${idx * 0.1}s` }}
                data-testid={`feature-card-${idx}`}
              >
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--secondary)', color: 'var(--accent)' }}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="opacity-70">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12" style={{ fontFamily: 'Fraunces, serif' }}>How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, idx) => (
              <div key={idx} className="text-center" data-testid={`step-${idx}`}>
                <div className="text-6xl font-bold opacity-20 mb-4" style={{ fontFamily: 'Fraunces, serif' }}>{step.num}</div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="opacity-70">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Fraunces, serif' }}>Ready to File Your Taxes?</h2>
          <p className="text-lg opacity-70 mb-8">
            Join thousands of satisfied customers who trust TaxAssist for their tax filing needs.
          </p>
          <Button
            data-testid="cta-get-started"
            onClick={() => navigate("/register")}
            className="btn-primary px-12 py-4 text-lg rounded-full"
          >
            Get Started Today
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6" style={{ color: 'var(--primary)' }} />
            <span className="font-semibold">TaxAssist</span>
          </div>
          <p className="opacity-70 text-sm">© 2025 TaxAssist. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;