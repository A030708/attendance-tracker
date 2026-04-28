// src/auth/TwoFactorSetup.jsx - FIXED VERSION
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import QRCode from "qrcode";
import { supabase } from "../lib/supabase";
import "./TwoFactorSetup.css";

const TwoFactorSetup = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Show QR, 2: Verify
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);
  const [copied, setCopied] = useState(false);
  
  // Get user data from location state or session
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    // Get user data from location state
    if (location.state) {
      setUserData(location.state);
    } else {
      // Try to get from session storage
      const storedUser = sessionStorage.getItem("2fa_setup_user");
      if (storedUser) {
        setUserData(JSON.parse(storedUser));
      } else {
        // Redirect back to login if no user data
        navigate("/organization/login");
      }
    }
  }, [location, navigate]);

  useEffect(() => {
    if (step === 1 && userData) {
      generateSecret();
    }
  }, [step, userData]);

  const generateSecret = async () => {
    try {
      if (!userData) {
        setError("User information not found. Please login again.");
        return;
      }

      const email = userData.email;
      
      // Generate random secret (Base32 format for Google Authenticator)
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
      let secret = "";
      for (let i = 0; i < 32; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      setSecret(secret);

      // Generate QR code URL for Google Authenticator
      const otpauthUrl = `otpauth://totp/SchoolApp:${encodeURIComponent(email)}?secret=${secret}&issuer=SchoolApp&algorithm=SHA1&digits=6&period=30`;

      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      setQrCodeUrl(qrCodeDataUrl);

      // Store temp secret in profiles table
      if (userData.userId) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ two_factor_temp_secret: secret })
          .eq("id", userData.userId);

        if (updateError) throw updateError;
      }

      // Save user data to session storage for persistence
      sessionStorage.setItem("2fa_setup_user", JSON.stringify(userData));
    } catch (err) {
      console.error("QR generation error:", err);
      setError("Failed to generate QR code. Please try again.");
    }
  };

  const generateBackupCodes = () => {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      // Generate 8-character alphanumeric codes
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    setBackupCodes(codes);
    return codes;
  };

  const verifyCode = async () => {
    if (!verificationCode.match(/^\d{6}$/)) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    if (!userData?.userId) {
      setError("User session expired. Please login again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // In a real app, you would verify the TOTP code with a backend API
      // For this example, we'll simulate the verification
      
      // Generate backup codes
      const backupCodes = generateBackupCodes();
      
      // Enable 2FA in database
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          two_factor_enabled: true,
          two_factor_secret: secret,
          two_factor_backup_codes: backupCodes,
          two_factor_temp_secret: null,
        })
        .eq("id", userData.userId);

      if (updateError) {
        console.error("Database update error:", updateError);
        throw new Error("Failed to enable 2FA in database");
      }

      // Mark 2FA as verified for this session
      sessionStorage.setItem(`2fa_verified_${userData.userId}`, 'true');
      
      // Clear setup data
      sessionStorage.removeItem("2fa_setup_user");
      
      setStep(3); // Show backup codes
    } catch (err) {
      console.error("Verification error:", err);
      setError("Verification failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    const text = backupCodes.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const downloadBackupCodes = () => {
    const text = `School Management System - 2FA Backup Codes\n
Organization: ${userData?.email || 'Your Account'}\n
Generated: ${new Date().toLocaleDateString()}\n
IMPORTANT: Save these codes in a secure location. Each code can be used only once.\n\n
Backup Codes:\n${backupCodes.join('\n')}\n\n
Instructions:\n
1. If you lose access to your authenticator app, use one of these codes to login.\n
2. Each code can be used only once.\n
3. After using a code, it will be removed from your account.\n
4. You can generate new backup codes from your account settings.\n`;
    
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `2fa-backup-codes-${userData?.email?.split('@')[0] || 'organization'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleComplete = () => {
    // Redirect to dashboard
    navigate("/organization/dashboard");
  };

  const handleCancel = () => {
    // Clear session data and redirect to login
    sessionStorage.removeItem("2fa_setup_user");
    navigate("/organization/login");
  };

  if (!userData) {
    return (
      <div className="two-factor-container">
        <div className="two-factor-card">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading 2FA setup...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="two-factor-container">
      <div className="two-factor-card">
        <div className="two-factor-header">
          <div className="two-factor-icon">
            <i className="fas fa-shield-alt"></i>
          </div>
          <h1>Two-Factor Authentication Setup</h1>
          <p className="two-factor-subtitle">
            Add an extra layer of security to your organization account
          </p>
          <p className="user-email-display">
            <i className="fas fa-user"></i> {userData.email}
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        )}

        {step === 1 && (
          <div className="two-factor-step">
            <h2>
              <i className="fas fa-qrcode"></i> Step 1: Scan QR Code
            </h2>
            <div className="qr-instructions">
              <p>
                1. Install <strong>Google Authenticator</strong> on your phone
                <br />
                2. Open the app and tap <strong>"+"</strong>
                <br />
                3. Choose <strong>"Scan a QR code"</strong>
                <br />
                4. Scan the QR code below
              </p>
            </div>

            <div className="qr-code-container">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR Code" className="qr-code" />
              ) : (
                <div className="qr-placeholder">
                  <i className="fas fa-spinner fa-spin"></i>
                  <p>Generating QR code...</p>
                </div>
              )}
            </div>

            <div className="manual-secret">
              <p>
                <strong>Can't scan?</strong> Enter this code manually in Google Authenticator:
              </p>
              <div className="secret-box">
                <code>{secret || "Generating..."}</code>
                {secret && (
                  <button
                    className="copy-secret-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(secret);
                      alert("Secret copied to clipboard!");
                    }}
                  >
                    <i className="fas fa-copy"></i> Copy
                  </button>
                )}
              </div>
              <small className="secret-note">
                In Google Authenticator, choose "Enter a setup key" and paste this code
              </small>
            </div>

            <div className="button-group">
              <button
                className="next-button"
                onClick={() => setStep(2)}
                disabled={!secret}
              >
                <i className="fas fa-arrow-right"></i>
                Next: Verify Code
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="two-factor-step">
            <h2>
              <i className="fas fa-check-circle"></i> Step 2: Verify Code
            </h2>
            <div className="verify-instructions">
              <p>
                Open Google Authenticator and enter the 6-digit code for <strong>SchoolApp</strong>:
              </p>
            </div>

            <div className="verify-form">
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="code-input"
                autoFocus
              />
              <div className="code-hint">Enter 6-digit code from Google Authenticator</div>
            </div>

            <div className="button-group">
              <button
                className="secondary-button"
                onClick={() => setStep(1)}
              >
                <i className="fas fa-arrow-left"></i>
                Back to QR Code
              </button>
              <button
                className="verify-button"
                onClick={verifyCode}
                disabled={loading || verificationCode.length !== 6}
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Verifying...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i>
                    Verify & Enable 2FA
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="two-factor-step">
            <h2>
              <i className="fas fa-key"></i> Step 3: Backup Codes
            </h2>
            <div className="backup-warning">
              <i className="fas fa-exclamation-triangle"></i>
              <div>
                <strong>IMPORTANT:</strong> Save these backup codes in a safe place.
                You can use them if you lose access to your authenticator app.
                Each code can be used only once.
              </div>
            </div>

            <div className="backup-codes-container">
              <div className="backup-codes-grid">
                {backupCodes.map((code, index) => (
                  <div key={index} className="backup-code">
                    <span className="code-number">{index + 1}.</span>
                    <span className="code-value">{code}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="backup-actions">
              <button
                className="copy-button"
                onClick={copyBackupCodes}
              >
                <i className="fas fa-copy"></i>
                {copied ? "Copied!" : "Copy All Codes"}
              </button>
              <button
                className="download-button"
                onClick={downloadBackupCodes}
              >
                <i className="fas fa-download"></i>
                Download as TXT
              </button>
            </div>

            <div className="button-group">
              <button
                className="complete-button"
                onClick={handleComplete}
              >
                <i className="fas fa-check-circle"></i>
                Complete Setup & Go to Dashboard
              </button>
            </div>
          </div>
        )}

        <div className="cancel-section">
          <button
            className="cancel-button"
            onClick={handleCancel}
          >
            <i className="fas fa-times"></i>
            Cancel 2FA Setup
          </button>
        </div>

        <div className="security-tips">
          <h4><i className="fas fa-lightbulb"></i> Security Tips:</h4>
          <ul>
            <li>Never share your backup codes with anyone</li>
            <li>Store backup codes in a password manager or secure location</li>
            <li>If you lose both your phone and backup codes, contact support immediately</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorSetup;