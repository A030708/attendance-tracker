// src/auth/OrganizationLogin.jsx - FIXED CLEANUP SECTION
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./OrganizationLogin.css";

const OrganizationLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");

  const navigate = useNavigate();

  // Generate unique org code with SINGLE HYPHEN (6 characters)
  const generateOrgCode = () => {
    // Generate 6 uppercase alphanumeric characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `ORG-${code}`; // SINGLE HYPHEN, 6 CHARS
  };

  // Email validation function
  const isValidOrgEmail = (email) => {
    if (!email) return false;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    
    const domain = email.split('@')[1].toLowerCase();
    
    // Block temporary email domains
    const tempDomains = [
      'tempmail.com', '10minutemail.com', 'guerrillamail.com',
      'mailinator.com', 'yopmail.com', 'disposableemail.com',
      'tempmail.net', 'throwawaymail.com', 'maildrop.cc',
      'getairmail.com', 'temp-mail.org', 'sharklasers.com',
      'fakeinbox.com', 'tempmailaddress.com'
    ];
    
    if (tempDomains.some(temp => domain.includes(temp))) {
      return false;
    }
    
    // Allow .org, .edu domains and gmail
    const allowedDomains = ['.org', '.edu'];
    return allowedDomains.some(allowed => domain.endsWith(allowed)) || domain === 'gmail.com';
  };

  // Organization name validation
  const isValidOrgName = (name) => {
    if (!name) return false;
    const nameRegex = /^[A-Za-z\s]+$/;
    return nameRegex.test(name) && name.trim().length > 0;
  };

  // Check for existing email
  const checkExistingEmail = async (email) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("email")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      
      if (error) {
        console.error("Error checking email:", error);
        return false; // Assume not exists
      }
      return !!data;
    } catch (err) {
      console.error("Exception checking email:", err);
      return false;
    }
  };

  // Check for existing organization name
  const checkExistingOrgName = async (name) => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("name")
        .ilike("name", name)
        .maybeSingle();
      
      if (error) {
        console.error("Error checking org name:", error);
        return false;
      }
      return !!data;
    } catch (err) {
      console.error("Exception checking org name:", err);
      return false;
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setShowCode(false);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanOrgName = orgName.trim();

    try {
      // ============================
      // SIGN UP (CREATE ORGANIZATION)
      // ============================
      if (isSignUp) {
        // Validate inputs
        if (!cleanOrgName) {
          setError("Please enter your organization name");
          setLoading(false);
          return;
        }

        if (!isValidOrgName(cleanOrgName)) {
          setError("Organization name can only contain letters and spaces");
          setLoading(false);
          return;
        }

        if (!isValidOrgEmail(cleanEmail)) {
          setError("Only .org, .edu domains or gmail.com are allowed. Temporary emails are not permitted.");
          setLoading(false);
          return;
        }

        // Validate password strength
        if (cleanPassword.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }

        // Check for duplicates
        console.log("Checking for duplicates...");
        
        // Check email exists
        const emailExists = await checkExistingEmail(cleanEmail);
        if (emailExists) {
          setError("This email is already registered. Please use a different email or login.");
          setLoading(false);
          return;
        }

        // Check organization name exists
        const orgNameExists = await checkExistingOrgName(cleanOrgName);
        if (orgNameExists) {
          setError("An organization with this name already exists. Please choose a different name.");
          setLoading(false);
          return;
        }

        // Generate unique org code (SINGLE HYPHEN)
        let orgCode = generateOrgCode();
        console.log("Generated org code:", orgCode);

        // 1) Sign up org admin user using Supabase Auth
        console.log("Creating auth user...");
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password: cleanPassword,
            options: {
              data: {
                full_name: cleanOrgName,
                role: "org_admin",
              },
              emailRedirectTo: `${window.location.origin}/organization/login`,
            },
          });

        if (signUpError) {
          console.error("Auth signup error:", signUpError);
          if (signUpError.message.includes("already registered")) {
            throw new Error("This email is already registered. Please login instead.");
          }
          throw signUpError;
        }

        const user = signUpData?.user;
        if (!user) {
          throw new Error(
            "Sign up succeeded but user is null. Please check your email for verification link."
          );
        }

        console.log("Auth user created with ID:", user.id);

        // Track what we've created for rollback
        let profileCreated = false;
        let organizationCreated = false;
        
        try {
          // 2) Create profile first
          console.log("Creating profile...");
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              email: cleanEmail,
              full_name: cleanOrgName,
              role: "org_admin",
              two_factor_enabled: false,
              org_code: orgCode,
            })
            .select("id")
            .single();

          if (profileError) {
            console.error("Profile creation error:", profileError);
            
            if (profileError.code === '23505') { // Unique violation
              throw new Error("This email is already registered. Please use a different email.");
            }
            throw new Error("Failed to create user profile: " + profileError.message);
          }

          profileCreated = true;
          console.log("Profile created successfully");

          // 3) Create organization
          console.log("Creating organization...");
          const { data: org, error: orgError } = await supabase
            .from("organizations")
            .insert({
              name: cleanOrgName,
              org_code: orgCode,
              created_by: user.id,
            })
            .select("id, name, org_code")
            .single();

          if (orgError) {
            console.error("Organization creation error:", orgError);
            
            if (orgError.code === '23505') { // Unique violation
              throw new Error("An organization with this name or code already exists.");
            }
            throw new Error("Failed to create organization: " + orgError.message);
          }

          organizationCreated = true;
          console.log("Organization created successfully");

          // 4) Update profile with organization_id
          console.log("Linking profile to organization...");
          const { error: updateProfileError } = await supabase
            .from("profiles")
            .update({
              organization_id: org.id,
            })
            .eq("id", user.id);

          if (updateProfileError) {
            console.error("Profile update error:", updateProfileError);
            throw new Error("Failed to link organization to user profile.");
          }

          console.log("Organization signup completed successfully");

          setGeneratedCode(orgCode);
          setSuccess(
            `🎉 Organization created successfully!\n\n` +
            `Organization: ${cleanOrgName}\n` +
            `Admin Email: ${cleanEmail}\n` +
            `Organization Code: ${orgCode}\n\n` +
            `1. Please check your email (${cleanEmail}) for verification link\n` +
            `2. Save your organization code above\n` +
            `3. After email verification, you can login and setup 2FA`
          );
          setShowCode(true);
          
          // Clear sensitive data
          setPassword("");
          setOrgName("");
          
        } catch (innerError) {
          // Cleanup in case of failure
          console.error("Rolling back due to error:", innerError);
          
          // Delete profile if created but organization failed
          if (profileCreated && !organizationCreated) {
            try {
              const { error: deleteError } = await supabase
                .from("profiles")
                .delete()
                .eq("id", user.id);
              
              if (deleteError) {
                console.error("Failed to delete profile during rollback:", deleteError);
              } else {
                console.log("Profile deleted during rollback");
              }
            } catch (deleteErr) {
              console.error("Exception deleting profile:", deleteErr);
            }
          }
          
          // Delete organization if something went wrong after creation
          if (organizationCreated) {
            try {
              const { error: deleteError } = await supabase
                .from("organizations")
                .delete()
                .eq("created_by", user.id);
              
              if (deleteError) {
                console.error("Failed to delete organization during rollback:", deleteError);
              } else {
                console.log("Organization deleted during rollback");
              }
            } catch (deleteErr) {
              console.error("Exception deleting organization:", deleteErr);
            }
          }
          
          // Re-throw the error to be caught by outer catch
          throw innerError;
        }
        
        return;
      }

      // ============================
      // LOGIN (ORG ADMIN)
      // ============================
      console.log("Starting login process...");
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

      if (signInError) {
        console.error("Login error:", signInError);
        if (signInError.message.includes("Invalid login credentials")) {
          throw new Error("Invalid email or password. Please try again.");
        } else if (signInError.message.includes("Email not confirmed")) {
          throw new Error("Please verify your email first. Check your inbox for verification link.");
        }
        throw signInError;
      }

      const user = signInData?.user;
      if (!user) throw new Error("Could not load user");

      console.log("User logged in with ID:", user.id);

      // Check if email is verified
      if (!user.email_confirmed_at && !user.confirmed_at) {
        await supabase.auth.signOut();
        throw new Error("Please verify your email first. Check your inbox for verification link.");
      }

      // Check profile from profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, two_factor_enabled, full_name, organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile fetch error:", profileError);
        throw new Error("Failed to load user profile. Please try again.");
      }

      if (!profile) {
        await supabase.auth.signOut();
        throw new Error("User profile not found. Please contact support.");
      }

      if (profile.role !== "org_admin") {
        await supabase.auth.signOut();
        throw new Error("Access denied. You are not registered as an organization admin.");
      }

      // Check if user has an organization
      if (!profile.organization_id) {
        throw new Error("Your account is not associated with any organization. Please contact support.");
      }

      console.log("Login successful, checking 2FA status...");

      // Check if 2FA is enabled
      if (profile.two_factor_enabled) {
        // Redirect to 2FA verification page
        navigate("/organization/verify-2fa", { 
          state: { 
            email: cleanEmail, 
            userId: user.id,
            organizationName: profile.full_name 
          }
        });
      } else {
        // First time login - redirect to 2FA setup
        navigate("/organization/setup-2fa", { 
          state: { 
            email: cleanEmail, 
            userId: user.id,
            organizationName: profile.full_name 
          }
        });
      }
      
    } catch (err) {
      console.error("Auth process error:", err);
      
      // User-friendly error messages
      let userErrorMessage = err.message || "Something went wrong. Please try again.";
      
      // Map specific error codes to user-friendly messages
      if (err.message.includes("23505")) {
        if (err.message.includes("profiles_email_unique")) {
          userErrorMessage = "This email is already registered. Please use a different email or login.";
        } else if (err.message.includes("organizations_name_unique")) {
          userErrorMessage = "An organization with this name already exists. Please choose a different name.";
        } else {
          userErrorMessage = "This information is already registered. Please use different details.";
        }
      } else if (err.message.includes("23503")) {
        userErrorMessage = "Database reference error. Please try again.";
      } else if (err.message.includes("network")) {
        userErrorMessage = "Network error. Please check your connection and try again.";
      }
      
      setError(userErrorMessage);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCode)
      .then(() => {
        const copyBtn = document.getElementById("copy-btn");
        if (copyBtn) {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = "Copied!";
          copyBtn.style.background = "#4CAF50";
          setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = "";
          }, 2000);
        }
      })
      .catch(() => {
        // Fallback copy method
        const textArea = document.createElement("textarea");
        textArea.value = generatedCode;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          const copyBtn = document.getElementById("copy-btn");
          if (copyBtn) {
            copyBtn.textContent = "Copied!";
            setTimeout(() => {
              copyBtn.textContent = "Copy";
            }, 2000);
          }
        } catch (err) {
          alert("Failed to copy to clipboard. Please copy manually: " + generatedCode);
        }
        document.body.removeChild(textArea);
      });
  };

  const handleToggleMode = () => {
    setIsSignUp(!isSignUp);
    setError("");
    setSuccess("");
    setShowCode(false);
    setPassword("");
    if (!isSignUp) {
      setOrgName(""); // Clear org name when switching to signup
    }
  };

  const handleBackToHome = () => {
    navigate("/");
  };

  return (
    <div className="org-auth-container">
      <div className="org-auth-card">
        <div className="org-auth-header">
          <div className="org-icon">
            <i className="fas fa-university"></i>
          </div>
          <h1>{isSignUp ? "Create Organization" : "Organization Login"}</h1>
          <p className="org-subtitle">
            {isSignUp 
              ? "Set up your educational institution account" 
              : "Access your organization dashboard"}
          </p>
        </div>

        <div className={`role-badge ${isSignUp ? "signup" : "login"}`}>
          <i className="fas fa-user-shield"></i>
          <span>Organization Administrator</span>
          {!isSignUp && (
            <span className="security-badge">
              <i className="fas fa-shield-alt"></i> 2FA Protected
            </span>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            <i className="fas fa-exclamation-circle"></i>
            <div className="error-content">
              <strong>Error:</strong>
              <span>{error}</span>
              {error.includes("already registered") && (
                <div className="error-suggestion">
                  <button
                    type="button"
                    className="suggestion-btn"
                    onClick={() => {
                      if (error.includes("email")) {
                        setIsSignUp(false);
                        setError("");
                      }
                    }}
                  >
                    <i className="fas fa-sign-in-alt"></i>
                    {error.includes("email") ? "Go to Login" : "Try Different Name"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <i className="fas fa-check-circle"></i>
            <div className="success-content">
              <span style={{ whiteSpace: 'pre-line' }}>{success}</span>
            </div>
          </div>
        )}

        {showCode && (
          <div className="org-code-display">
            <h3><i className="fas fa-key"></i> Your Organization Code</h3>
            <div className="code-box">
              <code>{generatedCode}</code>
              <button 
                id="copy-btn" 
                className="copy-btn"
                onClick={copyToClipboard}
              >
                <i className="fas fa-copy"></i> Copy
              </button>
            </div>
            <div className="code-instruction">
              <p><strong>Important Security Information:</strong></p>
              <ul>
                <li>This code is unique to your organization</li>
                <li>Share only with authorized teachers/students</li>
                <li>Keep it confidential - it provides access to your organization</li>
                <li>You can regenerate it later if compromised</li>
              </ul>
            </div>
            <div className="code-actions">
              <button
                className="secondary-action-btn"
                onClick={() => {
                  setIsSignUp(false);
                  setShowCode(false);
                  setSuccess("");
                  setError("");
                  // Keep email pre-filled for login
                }}
              >
                <i className="fas fa-sign-in-alt"></i>
                Proceed to Login
              </button>
              <button
                className="tertiary-action-btn"
                onClick={() => {
                  setShowCode(false);
                  setSuccess("");
                  setIsSignUp(true);
                  setOrgName("");
                  setPassword("");
                }}
              >
                <i className="fas fa-plus-circle"></i>
                Create Another Organization
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleAuth} className={`org-auth-form ${showCode ? 'has-code' : ''}`}>
          {isSignUp && (
            <div className="form-group">
              <label>
                <i className="fas fa-building"></i> Organization Name *
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                placeholder="e.g., University of Technology"
                className="with-icon"
                disabled={showCode || loading}
                maxLength={100}
              />
              <small className="validation-note">
                Only letters and spaces allowed • Must be unique
              </small>
            </div>
          )}

          <div className="form-group">
            <label>
              <i className="fas fa-envelope"></i> Admin Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@yourinstitution.edu"
              className="with-icon"
              disabled={showCode || loading}
            />
            <small className="validation-note">
              Only .org, .edu domains or gmail.com • Must be unique
            </small>
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-lock"></i> Password *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder={isSignUp ? "Minimum 6 characters" : "Enter your password"}
              className="with-icon"
              disabled={showCode || loading}
              minLength={6}
            />
            {isSignUp && (
              <small>Use a strong, unique password • Minimum 6 characters</small>
            )}
          </div>

          {!showCode && (
            <button 
              className={`auth-button ${loading ? 'loading' : ''}`} 
              type="submit" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Processing...</span>
                </>
              ) : isSignUp ? (
                <>
                  <i className="fas fa-plus-circle"></i>
                  <span>Create Organization</span>
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt"></i>
                  <span>Login to Dashboard</span>
                </>
              )}
            </button>
          )}

          {!isSignUp && !showCode && (
            <div className="two-factor-note">
              <i className="fas fa-shield-alt"></i>
              <span>
                Two-Factor Authentication will be required for security
              </span>
            </div>
          )}
        </form>

        {!showCode && (
          <div className="org-auth-footer">
            <div className="toggle-section">
              <p>
                {isSignUp
                  ? "Already have an organization?"
                  : "Need to create an organization?"}
                <button
                  type="button"
                  onClick={handleToggleMode}
                  className="toggle-mode-btn"
                  disabled={loading}
                >
                  {isSignUp ? "Login here" : "Sign up here"}
                  <i className={`fas fa-arrow-right ${isSignUp ? '' : 'signup-arrow'}`}></i>
                </button>
              </p>
            </div>

            <div className="divider">
              <span>or</span>
            </div>

            <button
              type="button"
              className="back-button"
              onClick={handleBackToHome}
              disabled={loading}
            >
              <i className="fas fa-arrow-left"></i>
              Back to Role Selection
            </button>

            <div className="security-info">
              <h4><i className="fas fa-info-circle"></i> Security & Uniqueness</h4>
              <ul>
                <li><strong>Unique Email:</strong> Each email can register only one organization</li>
                <li><strong>Unique Name:</strong> Organization names must be unique</li>
                <li><strong>Domain Restriction:</strong> Only .org, .edu domains or gmail.com</li>
                <li><strong>No Temporary Emails:</strong> Disposable email providers are blocked</li>
                <li><strong>2FA Required:</strong> All organization admins require 2FA</li>
                <li><strong>Email Verification:</strong> Required before first login</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationLogin;