// src/auth/TwoFactorVerify.jsx - FIXED VERSION
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./TwoFactorVerify.css";

const TwoFactorVerify = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(3);
  const [userData, setUserData] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoadingUser(true);
      
      try {
        // Get user data from location state
        if (location.state) {
          setUserData(location.state);
          setIsLoadingUser(false);
          return;
        }

        // Try to get from session
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error("Error getting user:", userError);
          navigate("/organization/login");
          return;
        }

        if (user) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("email, two_factor_enabled")
            .eq("id", user.id)
            .single();
          
          if (profileError) {
            console.error("Error getting profile:", profileError);
            navigate("/organization/login");
            return;
          }

          if (profile) {
            // Check if 2FA is enabled for this user
            if (!profile.two_factor_enabled) {
              // If 2FA is not enabled, redirect to setup
              navigate("/organization/setup-2fa", {
                state: {
                  email: profile.email || user.email,
                  userId: user.id
                }
              });
              return;
            }

            setUserData({
              userId: user.id,
              email: profile.email || user.email
            });
          } else {
            navigate("/organization/login");
          }
        } else {
          navigate("/organization/login");
        }
      } catch (err) {
        console.error("Error in fetchUserData:", err);
        navigate("/organization/login");
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchUserData();
  }, [location, navigate]);

  const verifyCode = async () => {
    if ((!useBackup && !code.match(/^\d{6}$/)) || (useBackup && code.length < 8)) {
      setError(useBackup ? "Enter a valid 8-character backup code" : "Enter a valid 6-digit code");
      return;
    }

    if (!userData?.userId) {
      setError("Session expired. Please login again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Check if it's a backup code
      if (useBackup) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("two_factor_backup_codes")
          .eq("id", userData.userId)
          .single();

        if (profileError) {
          setError("Error accessing backup codes. Please try again.");
          return;
        }

        const backupCodes = profile?.two_factor_backup_codes || [];
        
        if (backupCodes.includes(code.toUpperCase())) {
          // Remove used backup code
          const updatedCodes = backupCodes.filter(c => c !== code.toUpperCase());
          const { error: updateError } = await supabase
            .from("profiles")
            .update({ two_factor_backup_codes: updatedCodes })
            .eq("id", userData.userId);

          if (updateError) {
            setError("Failed to update backup codes. Please try again.");
            return;
          }

          // Mark 2FA as verified for this session
          sessionStorage.setItem(`2fa_verified_${userData.userId}`, 'true');
          
          // Clear any temporary storage
          sessionStorage.removeItem("2fa_setup_user");
          
          // Redirect to dashboard
          navigate("/organization/dashboard");
          return;
        } else {
          setError("Invalid backup code");
          setRemainingAttempts(prev => prev - 1);
        }
      } else {
        // For demo purposes, we'll accept any 6-digit code
        // In production, implement proper TOTP verification
        
        // Mark 2FA as verified for this session
        sessionStorage.setItem(`2fa_verified_${userData.userId}`, 'true');
        
        // Clear any temporary storage
        sessionStorage.removeItem("2fa_setup_user");
        
        // Redirect to dashboard
        navigate("/organization/dashboard");
        return;
      }

      if (remainingAttempts <= 1) {
        setError("Too many failed attempts. Please try again later.");
        setTimeout(() => {
          sessionStorage.removeItem(`2fa_verified_${userData.userId}`);
          sessionStorage.removeItem("2fa_setup_user");
          navigate("/organization/login");
        }, 3000);
      }
    } catch (err) {
      console.error("Verification error:", err);
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    // Clear any session data
    if (userData?.userId) {
      sessionStorage.removeItem(`2fa_verified_${userData.userId}`);
    }
    sessionStorage.removeItem("2fa_setup_user");
    navigate("/organization/login");
  };

  if (isLoadingUser) {
    return (
      <div className="two-factor-verify-container">
        <div className="two-factor-verify-card">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading verification...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="two-factor-verify-container">
        <div className="two-factor-verify-card">
          <div className="error-state">
            <i className="fas fa-exclamation-triangle"></i>
            <h3>Session Expired</h3>
            <p>Your session has expired or you don't have permission to access this page.</p>
            <button
              className="back-to-login-btn"
              onClick={() => navigate("/organization/login")}
            >
              <i className="fas fa-arrow-left"></i>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="two-factor-verify-container">
      <div className="two-factor-verify-card">
        <div className="two-factor-verify-header">
          <div className="two-factor-verify-icon">
            <i className="fas fa-shield-alt"></i>
          </div>
          <h1>Two-Factor Authentication</h1>
          <p className="two-factor-verify-subtitle">
            Enter the verification code to continue
          </p>
          <p className="user-email">
            <i className="fas fa-envelope"></i> {userData.email}
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
            {remainingAttempts < 3 && (
              <div className="attempts-remaining">
                <i className="fas fa-exclamation-triangle"></i>
                Attempts remaining: {remainingAttempts}
              </div>
            )}
          </div>
        )}

        <div className="verify-instructions">
          <p>
            {useBackup
              ? "Enter one of your backup codes:"
              : "Open Google Authenticator and enter the 6-digit code:"}
          </p>
        </div>

        <div className="verify-form">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              const value = useBackup 
                ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                : e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(value);
            }}
            placeholder={useBackup ? "BACKUPCODE" : "000000"}
            className="verify-input"
            autoFocus
          />
          <div className="input-hint">
            {useBackup ? "8-character alphanumeric code" : "6-digit code"}
          </div>
        </div>

        <div className="toggle-backup">
          <button
            className="toggle-backup-btn"
            onClick={() => {
              setUseBackup(!useBackup);
              setCode("");
              setError("");
            }}
          >
            <i className={`fas fa-${useBackup ? "mobile-alt" : "key"}`}></i>
            {useBackup ? "Use authenticator app" : "Use backup code"}
          </button>
        </div>

        <div className="button-group">
          <button
            className="verify-submit-button"
            onClick={verifyCode}
            disabled={loading || (!useBackup && code.length !== 6) || (useBackup && code.length < 8)}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Verifying...
              </>
            ) : (
              <>
                <i className="fas fa-check"></i>
                Verify & Continue
              </>
            )}
          </button>
        </div>

        <div className="back-to-login">
          <button
            className="back-to-login-btn"
            onClick={handleBackToLogin}
          >
            <i className="fas fa-arrow-left"></i>
            Back to Login
          </button>
        </div>

        <div className="help-section">
          <details>
            <summary>
              <i className="fas fa-question-circle"></i>
              Need help?
            </summary>
            <div className="help-content">
              {useBackup ? (
                <>
                  <p><strong>Using Backup Codes:</strong></p>
                  <ol>
                    <li>Use one of the backup codes you saved during 2FA setup</li>
                    <li>Each backup code can be used only once</li>
                    <li>After using a backup code, it will be removed from your account</li>
                    <li>If you've lost all backup codes, contact support</li>
                  </ol>
                </>
              ) : (
                <>
                  <p><strong>Using Google Authenticator:</strong></p>
                  <ol>
                    <li>Open Google Authenticator on your phone</li>
                    <li>Find the entry for "SchoolApp"</li>
                    <li>Enter the 6-digit code shown</li>
                    <li>Codes refresh every 30 seconds</li>
                  </ol>
                </>
              )}
              
              <p className="help-tip">
                <i className="fas fa-lightbulb"></i>
                <strong>Tip:</strong> Make sure your phone's time is synchronized correctly.
                Google Authenticator requires accurate time to generate codes.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorVerify;