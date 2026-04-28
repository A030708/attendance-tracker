// src/components/StudentProfileSetup.jsx - Updated with full name editing
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./StudentProfileSetup.css";

const StudentProfileSetup = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [registerNo, setRegisterNo] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        
        if (authError || !authData?.user) {
          setError("Failed to load user");
          setLoading(false);
          return;
        }

        const currentUser = authData.user;
        setUser(currentUser);

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(`
            id, 
            full_name, 
            role, 
            register_no, 
            email, 
            parent_email,
            roll_no_updated_at,
            roll_no_updated_by,
            active,
            is_active,
            created_at
          `)
          .eq("id", currentUser.id)
          .single();

        if (profileError) {
          console.error("Profile error:", profileError);
          setError("Failed to load profile");
          setLoading(false);
          return;
        }

        setProfile(profileData);
        setRegisterNo(profileData.register_no || "");
        setFullName(profileData.full_name || "");
        setLoading(false);
      } catch (err) {
        console.error("Load error:", err);
        setError("Failed to load profile data");
        setLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  // Validate roll number format (11 characters, alphanumeric, uppercase)
  const validateRollNumber = (rollNo) => {
    const trimmed = rollNo.trim();
    
    if (!trimmed) {
      return "Register Number is required";
    }
    
    // Must be exactly 11 characters (letters and numbers only, all uppercase)
    if (!/^[A-Z0-9]{11}$/.test(trimmed)) {
      return "Register Number must be exactly 11 characters (letters and numbers only, all uppercase)";
    }
    
    return null;
  };

  // Validate full name
  const validateFullName = (name) => {
    const trimmed = name.trim();
    
    if (!trimmed) {
      return "Full Name is required";
    }
    
    if (trimmed.length < 2) {
      return "Full Name must be at least 2 characters";
    }
    
    if (trimmed.length > 100) {
      return "Full Name must be less than 100 characters";
    }
    
    return null;
  };

  // Handle register number change - auto uppercase and filter
  const handleRegisterNoChange = (value) => {
    // Convert to uppercase, allow only alphanumeric, limit to 11 characters
    const uppercaseValue = value.toUpperCase();
    const alphanumericValue = uppercaseValue.replace(/[^A-Z0-9]/g, "");
    const limitedValue = alphanumericValue.slice(0, 11);
    
    setRegisterNo(limitedValue);
    
    // Clear validation error when user starts typing
    if (validationError && validationError.includes("Register Number")) {
      setValidationError("");
    }
  };

  // Handle full name change
  const handleFullNameChange = (value) => {
    setFullName(value);
    
    // Clear validation error when user starts typing
    if (validationError && validationError.includes("Full Name")) {
      setValidationError("");
    }
  };

  // Check if student can edit roll number and full name (within 7 days of registration/creation)
  const canEditProfile = () => {
    if (!profile.register_no && !profile.full_name) return true; // Never set before - can set
    
    // Check if within 7 days of profile creation OR last update
    const referenceDate = profile.roll_no_updated_at || profile.created_at;
    
    if (!referenceDate) return true; // No timestamp - can edit
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return new Date(referenceDate) > sevenDaysAgo;
  };

  const handleSave = async () => {
    // Check if student can edit
    if (!canEditProfile()) {
      setError("Editing period has expired (7 days). Contact your teacher if you need to make changes.");
      return;
    }

    // Validate roll number
    const rollError = validateRollNumber(registerNo);
    const nameError = validateFullName(fullName);
    
    if (rollError || nameError) {
      setValidationError(rollError || nameError);
      return;
    }

    const cleanRoll = registerNo.trim();
    const cleanName = fullName.trim();

    setSaving(true);
    setError("");
    setValidationError("");

    try {
      // Check if roll number already exists (excluding current user)
      const { data: existing, error: checkError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("register_no", cleanRoll)
        .neq("id", profile.id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        setError(`Register Number ${cleanRoll} is already assigned to ${existing.full_name || existing.email || "another student"}`);
        setSaving(false);
        return;
      }

      // Update register_no and full_name with timestamp
      const updateData = {
        register_no: cleanRoll,
        full_name: cleanName,
        roll_no_updated_at: new Date().toISOString(),
      };

      const { error: saveError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile.id);

      if (saveError) {
        if (saveError.code === "23505") { // Unique violation
          setError("This Register Number is already assigned to another student");
        } else if (saveError.code === "23514") { // Check constraint violation
          setError("Register Number must be exactly 11 alphanumeric characters");
        } else {
          setError(saveError.message || "Failed to save details");
        }
        setSaving(false);
        return;
      }

      // Update local state
      setProfile((p) => ({
        ...p,
        register_no: cleanRoll,
        full_name: cleanName,
        roll_no_updated_at: new Date().toISOString(),
      }));

      // Success feedback
      const successMessage = `Profile updated successfully! ✅\n\nYour new details:\n• Full Name: ${cleanName}\n• Register Number: ${cleanRoll}\n\nYou have 7 days from now to make any corrections.`;
      
      alert(successMessage);

    } catch (err) {
      console.error("Save error:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  // Don't show if still loading
  if (loading) return null;
  
  // Only show for students
  if (!profile || profile.role !== "student") return null;

  // Calculate days remaining for editing
  const getDaysRemaining = () => {
    if ((!profile.register_no && !profile.full_name) || !canEditProfile()) return 0;
    
    const referenceDate = profile.roll_no_updated_at || profile.created_at;
    if (!referenceDate) return 7;
    
    const lastUpdate = new Date(referenceDate);
    const sevenDaysFromUpdate = new Date(lastUpdate);
    sevenDaysFromUpdate.setDate(lastUpdate.getDate() + 7);
    
    const now = new Date();
    const diffTime = sevenDaysFromUpdate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  };

  const daysRemaining = getDaysRemaining();
  const canEdit = canEditProfile();
  const hasRequiredInfo = profile.register_no && profile.full_name;

  return (
    <div className="student-profile-setup">
      <div className="setup-header">
        <h3>
          {!hasRequiredInfo ? "Complete Your Profile" : "Update Your Profile"}
        </h3>
        
        <p className="setup-subtitle">
          {!hasRequiredInfo ? (
            "Please set your Full Name and Register Number. You can edit these within 7 days."
          ) : canEdit ? (
            <>
              You can edit your Full Name and Register Number within 7 days of setting them.
              <span className="days-remaining">
                ⏰ {daysRemaining} day(s) remaining to make changes
              </span>
            </>
          ) : (
            "Your editing period has expired (7 days)."
          )}
        </p>
      </div>

      {/* Error Messages */}
      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {validationError && (
        <div className="alert alert-warning">
          <strong>Validation Error:</strong> {validationError}
        </div>
      )}

      {/* Full Name Input */}
      <div className="form-group">
        <label htmlFor="fullName">
          Full Name *
          <span className="hint">(Your complete name as per records)</span>
        </label>
        <input
          id="fullName"
          type="text"
          placeholder="Enter your full name"
          value={fullName}
          onChange={(e) => handleFullNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !saving && canEdit) handleSave();
          }}
          disabled={!canEdit}
          className={validationError && validationError.includes("Full Name") ? "input-error" : ""}
        />
      </div>

      {/* Register Number Input */}
      <div className="form-group">
        <label htmlFor="registerNo">
          Register Number *
          <span className="hint">(11 characters, letters and numbers only, all uppercase)</span>
        </label>
        <input
          id="registerNo"
          type="text"
          placeholder="e.g., 03SU24MC822"
          value={registerNo}
          onChange={(e) => handleRegisterNoChange(e.target.value)}
          onKeyDown={(e) => {
            // Prevent spaces
            if (e.key === " ") e.preventDefault();
            // Allow Enter to submit
            if (e.key === "Enter" && !saving && canEdit) handleSave();
          }}
          maxLength={11}
          disabled={!canEdit}
          className={validationError && validationError.includes("Register Number") ? "input-error" : ""}
        />
        <div className="input-info">
          {registerNo.length > 0 && (
            <span className={`char-count ${registerNo.length === 11 ? "valid" : "invalid"}`}>
              {registerNo.length}/11 characters
            </span>
          )}
        </div>
      </div>

      {/* Read-only Information Display */}
      <div className="read-only-info">
        <h4>Additional Information</h4>
        
        <div className="info-grid">
          {/* Email - Read only */}
          <div className="info-item">
            <span className="info-label">Student Email:</span>
            <span className="info-value">
              <code>{profile.email || "Not set"}</code>
              <span className="info-note">👨‍🏫 Managed by teacher</span>
            </span>
          </div>

          {/* Parent Email - Read only */}
          {profile.parent_email && (
            <div className="info-item">
              <span className="info-label">Parent Email:</span>
              <span className="info-value">
                <code>{profile.parent_email}</code>
                <span className="info-note">👨‍🏫 Managed by teacher</span>
              </span>
            </div>
          )}

          {/* Last Updated */}
          {profile.roll_no_updated_at && (
            <div className="info-item">
              <span className="info-label">Last Updated:</span>
              <span className="info-value">
                {new Date(profile.roll_no_updated_at).toLocaleDateString()} at {new Date(profile.roll_no_updated_at).toLocaleTimeString()}
              </span>
            </div>
          )}

          {/* Account Created */}
          {profile.created_at && (
            <div className="info-item">
              <span className="info-label">Account Created:</span>
              <span className="info-value">
                {new Date(profile.created_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Save Button (only show if can edit) */}
      {canEdit && (
        <div className="form-actions">
          <button
            onClick={handleSave}
            disabled={saving || !registerNo.trim() || registerNo.length !== 11 || !fullName.trim()}
            className="save-button"
          >
            {saving ? (
              <>
                <span className="spinner"></span>
                Saving...
              </>
            ) : (
              hasRequiredInfo ? "Update Profile" : "Complete Profile"
            )}
          </button>
          
          <div className="validation-summary">
            <p><strong>Before saving, ensure:</strong></p>
            <ul>
              <li className={fullName.trim().length >= 2 ? "valid" : "invalid"}>
                ✓ Full Name is at least 2 characters
              </li>
              <li className={registerNo.length === 11 ? "valid" : "invalid"}>
                ✓ Register Number is exactly 11 characters
              </li>
              <li className={registerNo.length === 11 && /^[A-Z0-9]{11}$/.test(registerNo) ? "valid" : "invalid"}>
                ✓ Register Number contains only letters & numbers (uppercase)
              </li>
            </ul>
          </div>
          
          <p className="form-note">
            <strong>Important Notes:</strong> 
            <br/>• You can edit Full Name and Register Number within 7 days of setting them
            <br/>• After 7 days, both fields will be locked
            <br/>• Email and parent email are managed by your teacher via CSV
            <br/>• Contact your teacher for changes after editing period
          </p>
        </div>
      )}

      {/* Message when editing period expired */}
      {!canEdit && hasRequiredInfo && (
        <div className="expired-message">
          <div className="expired-icon">🔒</div>
          <h4>Editing Period Expired</h4>
          <p>
            Your 7-day editing period has ended. 
            If you need to change your Full Name or Register Number, please contact your teacher.
          </p>
          
          <div className="current-profile">
            <div className="profile-item">
              <span className="profile-label">Full Name:</span>
              <span className="profile-value"><strong>{profile.full_name}</strong></span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Register Number:</span>
              <span className="profile-value"><code>{profile.register_no}</code></span>
            </div>
          </div>
          
          <button
            onClick={() => {
              if (window.confirm("Do you want to contact your teacher for profile changes?")) {
                // This could open email or redirect to contact page
                window.location.href = "mailto:teacher@example.com?subject=Profile Change Request";
              }
            }}
            className="contact-teacher-btn"
          >
            📧 Contact Teacher for Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default StudentProfileSetup;