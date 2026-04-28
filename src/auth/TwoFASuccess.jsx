// src/auth/TwoFASuccess.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./TwoFASuccess.css";

const TwoFASuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/organization/dashboard");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const handleGoToDashboard = () => {
    navigate("/organization/dashboard");
  };

  return (
    <div className="twofa-success-container">
      <div className="twofa-success-card">
        <div className="success-icon">
          <i className="fas fa-check-circle"></i>
        </div>
        
        <h1>Two-Factor Authentication Verified!</h1>
        
        <div className="success-message">
          <p>
            <i className="fas fa-shield-alt"></i>
            <strong>Your account is now secured with 2FA</strong>
          </p>
          <p className="security-tip">
            Every login will require a code from your Google Authenticator app.
          </p>
        </div>

        <div className="backup-reminder">
          <i className="fas fa-exclamation-triangle"></i>
          <div>
            <strong>Remember:</strong> Save your backup codes in a safe place.
            They can be used if you lose access to your authenticator app.
          </div>
        </div>

        <button 
          className="dashboard-button"
          onClick={handleGoToDashboard}
        >
          <i className="fas fa-tachometer-alt"></i>
          Go to Dashboard
        </button>

        <div className="redirect-timer">
          <p>Redirecting to dashboard in 3 seconds...</p>
        </div>
      </div>
    </div>
  );
};

export default TwoFASuccess;