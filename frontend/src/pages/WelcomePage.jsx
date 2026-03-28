import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

function SetupCard({ title, subtitle, cta, onClick, accentClass }) {
  return (
    <div className={`setup-card ${accentClass}`}>
      <div className="setup-card-glow" />

      <h2>{title}</h2>
      <p className="setup-subtitle">{subtitle}</p>

      <button className="auth-primary-btn" onClick={onClick}>
        {cta}
      </button>
    </div>
  );
}

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="auth-shell">
      <div className="auth-bg-orb auth-bg-orb-1" />
      <div className="auth-bg-orb auth-bg-orb-2" />

      <main className="auth-layout auth-layout-centered">
        <section className="auth-hero-card centered">
          <div className="auth-hero-topline">TESTOPS SETUP</div>

          <h1>How do you want to use TestOps?</h1>

          <p className="auth-hero-text small">
            Choose your setup. You can change this later.
          </p>

          <div className="setup-grid minimal">
            <SetupCard
              title="Organization"
              subtitle="For teams managing multiple APIs and projects"
              cta="Continue as Organization"
              accentClass="setup-card-org"
              onClick={() => navigate("/login/organization")}
            />

            <SetupCard
              title="Individual"
              subtitle="For personal use and quick test generation"
              cta="Continue as Individual"
              accentClass="setup-card-individual"
              onClick={() => navigate("/login/individual")}
            />
          </div>

          <button className="auth-link-btn" onClick={() => navigate("/")}>
            ← Back to home
          </button>
        </section>
      </main>
    </div>
  );
}
