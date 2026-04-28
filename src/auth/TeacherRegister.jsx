// src/components/auth/TeacherRegister.jsx
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { Link, useNavigate } from "react-router-dom";
import "./TeacherRegister.css";

const TeacherRegister = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    orgCode: "",
    subject: "",
    phone: "",
    qualification: "",
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [validatingOrg, setValidatingOrg] = useState(false);
  const [orgInfo, setOrgInfo] = useState(null);
  const navigate = useNavigate();

  const validateOrgCode = async () => {
    if (!formData.orgCode.trim()) {
      setMessage({ type: "error", text: "Please enter organization code" });
      return;
    }

    setValidatingOrg(true);
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, org_code")
        .eq("org_code", formData.orgCode.trim().toUpperCase())
        .single();

      if (error || !data) {
        setMessage({ 
          type: "error", 
          text: "Invalid organization code. Please check with your administrator." 
        });
        setOrgInfo(null);
      } else {
        setOrgInfo(data);
        setMessage({ 
          type: "success", 
          text: `Organization found: ${data.name}` 
        });
      }
    } catch (err) {
      console.error("Org validation error:", err);
      setMessage({ 
        type: "error", 
        text: "Error validating organization code" 
      });
    } finally {
      setValidatingOrg(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!orgInfo) {
      setMessage({ 
        type: "error", 
        text: "Please enter and validate your organization code first" 
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }

    if (formData.password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      // Check if email already exists
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", formData.email.trim().toLowerCase())
        .single();

      if (existing) {
        setMessage({ 
          type: "error", 
          text: "Email already registered. Please use a different email or login." 
        });
        setLoading(false);
        return;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName.trim(),
            role: "teacher",
            org_code: formData.orgCode.trim().toUpperCase(),
            phone: formData.phone.trim(),
            subject: formData.subject.trim(),
            qualification: formData.qualification.trim(),
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create profile record
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: authData.user.id,
            full_name: formData.fullName.trim(),
            email: formData.email.trim().toLowerCase(),
            role: "teacher",
            org_code: formData.orgCode.trim().toUpperCase(),
            organization_id: orgInfo.id,
            phone: formData.phone.trim(),
            subject: formData.subject.trim(),
            qualification: formData.qualification.trim(),
            active: true,
          });

        if (profileError) {
          // Rollback auth if profile creation fails
          await supabase.auth.admin.deleteUser(authData.user.id);
          throw profileError;
        }

        // Send welcome email (optional)
        await sendWelcomeEmail(formData.email, orgInfo.name);

        setMessage({
          type: "success",
          text: `Registration successful! Welcome to ${orgInfo.name}. Check your email to verify your account.`
        });

        // Reset form
        setFormData({
          fullName: "",
          email: "",
          password: "",
          confirmPassword: "",
          orgCode: formData.orgCode, // Keep org code
          subject: "",
          phone: "",
          qualification: "",
        });

        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    } catch (error) {
      console.error("Registration error:", error);
      setMessage({
        type: "error",
        text: error.message || "Registration failed. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const sendWelcomeEmail = async (email, orgName) => {
    try {
      // You can implement email sending logic here
      // or use Supabase Edge Functions
      console.log(`Welcome email sent to ${email} for ${orgName}`);
    } catch (err) {
      console.error("Email sending error:", err);
    }
  };

  return (
    <div className="teacher-register-container">
      <div className="register-wrapper">
        {/* Animation Section */}
        <div className={`register-animation ${orgInfo ? 'active' : ''}`}>
          <div className="animation-content">
            <div className="welcome-message">
              <h2>WELCOME!</h2>
              <p>We're delighted to have you here.</p>
              {orgInfo && (
                <div className="org-welcome">
                  <p>You're joining: <strong>{orgInfo.name}</strong></p>
                  <p>Organization Code: <code>{orgInfo.org_code}</code></p>
                </div>
              )}
              <p>If you need any assistance, feel free to reach out.</p>
            </div>
            <div className="animation-illustration">
              <div className="teacher-icon">👨‍🏫</div>
              <div className="pulse-ring"></div>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="register-form-box">
          <div className="form-header">
            <h1>Teacher Registration</h1>
            <p>Join your educational institution</p>
          </div>

          {message.text && (
            <div className={`message ${message.type}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="register-form">
            {/* Organization Code (Required First) */}
            <div className="form-group org-code-group">
              <label htmlFor="orgCode">
                Organization Code *
                <span className="hint">Get this from your administrator</span>
              </label>
              <div className="org-code-input">
                <input
                  type="text"
                  id="orgCode"
                  name="orgCode"
                  value={formData.orgCode}
                  onChange={handleChange}
                  placeholder="Enter your organization code"
                  className={orgInfo ? "valid" : ""}
                  required
                  disabled={loading}
                  style={{ textTransform: 'uppercase' }}
                />
                <button
                  type="button"
                  onClick={validateOrgCode}
                  disabled={!formData.orgCode.trim() || loading || validatingOrg}
                  className="btn-validate"
                >
                  {validatingOrg ? "Validating..." : "Verify"}
                </button>
              </div>
            </div>

            {orgInfo && (
              <>
                {/* Personal Information */}
                <div className="form-group">
                  <label htmlFor="fullName">Full Name *</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="subject">Primary Subject *</label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  >
                    <option value="">Select Subject</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Science">Science</option>
                    <option value="English">English</option>
                    <option value="History">History</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                    <option value="Physical Education">Physical Education</option>
                    <option value="Art">Art</option>
                    <option value="Music">Music</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="qualification">Qualification</label>
                  <input
                    type="text"
                    id="qualification"
                    name="qualification"
                    value={formData.qualification}
                    onChange={handleChange}
                    placeholder="e.g., M.Ed, B.Sc, etc."
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Enter your phone number"
                    disabled={loading}
                  />
                </div>

                {/* Password Fields */}
                <div className="form-group">
                  <label htmlFor="password">
                    Password *
                    <span className="hint">Minimum 6 characters</span>
                  </label>
                  <div className="password-input">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create a password"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="btn-toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password *</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    required
                    disabled={loading}
                  />
                </div>

                {/* Terms and Conditions */}
                <div className="form-group terms">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      required
                      disabled={loading}
                    />
                    <span>
                      I agree to the <a href="/terms">Terms of Service</a> and 
                      <a href="/privacy"> Privacy Policy</a>
                    </span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="btn-register"
                  disabled={loading || !orgInfo}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Creating Account...
                    </>
                  ) : (
                    "Register as Teacher"
                  )}
                </button>
              </>
            )}

            {/* Already have account */}
            <div className="auth-links">
              <p>
                Already have an account?{" "}
                <Link to="/login">Sign in here</Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TeacherRegister;