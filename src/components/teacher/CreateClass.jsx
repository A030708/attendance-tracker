// src/components/teacher/CreateClass.jsx
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function CreateClass({ onCreated }) {
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  // Load teacher's profile to get organization_id
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("organization_id, org_code, full_name")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Error loading profile:", profileError);
          setError("Failed to load your profile");
          return;
        }

        setProfile(profileData);
        
        // Debug log
        console.log("Teacher profile for class creation:", {
          hasOrgId: !!profileData?.organization_id,
          orgId: profileData?.organization_id,
          orgCode: profileData?.org_code
        });

        if (!profileData?.organization_id) {
          setError("❌ Your account is not linked to any organization. Please contact your admin.");
        }
      } catch (err) {
        console.error("Error in loadProfile:", err);
        setError("Error loading profile");
      }
    };

    loadProfile();
  }, []);

  const generateClassCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      alert("Enter class name");
      return;
    }

    // Check if teacher has organization_id
    if (!profile?.organization_id) {
      alert("❌ Cannot create class: Your account is not linked to any organization.\n\nPlease contact your organization administrator to fix this.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: userRes, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error("Auth error:", userError);
        setError("Error checking login. Please login again.");
        setLoading(false);
        return;
      }

      const user = userRes?.user;
      if (!user) {
        setError("Please login again");
        setLoading(false);
        return;
      }

      const classCode = generateClassCode();

      console.log("Creating class with:", {
        teacher_id: user.id,
        organization_id: profile.organization_id,
        name: name.trim(),
        section: section.trim() || null,
        class_code: classCode
      });

      const { data, error } = await supabase
        .from("classes")
        .insert([
          {
            teacher_id: user.id,
            organization_id: profile.organization_id, // CRITICAL: Add organization_id
            name: name.trim(),
            section: section.trim() || null,
            class_code: classCode,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Create class error:", error);
        setError(error.message || "Failed to create class");
        alert(`❌ Error: ${error.message || "Failed to create class"}`);
        setLoading(false);
        return;
      }

      alert(`✅ Class created successfully!\n\nClass Name: ${data.name}\nClass Code: ${data.class_code}\nOrganization ID: ${data.organization_id}`);
      setName("");
      setSection("");


      // Notify parent dashboard to refresh classes
      if (onCreated) {
        onCreated(data);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("Unexpected error. Please try again.");
      alert("Unexpected error creating class. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-class">
      <h3>Create New Class</h3>

      {error && (
        <div className="error-message" style={{ color: "#ef4444", padding: "10px", background: "#fee", borderRadius: "5px", marginBottom: "15px" }}>
          {error}
        </div>
      )}

      {profile && !profile.organization_id && (
        <div className="warning-message" style={{ color: "#f59e0b", padding: "10px", background: "#fef3c7", borderRadius: "5px", marginBottom: "15px" }}>
          ⚠️ Your account is not linked to any organization. You cannot create classes until this is fixed.
          <br />
          <small>Contact your organization administrator to link your account.</small>
        </div>
      )}

      <div className="form-group">
        <label>Class Name *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Mathematics 101"
          disabled={!profile?.organization_id || loading}
        />
      </div>

      <div className="form-group">
        <label>subject (optional)</label>
        <input
          value={section}
          onChange={(e) => setSection(e.target.value)}
          placeholder="subject"
          disabled={!profile?.organization_id || loading}
        />
      </div>

      <br />

      <button 
        onClick={handleCreate} 
        disabled={loading || !profile?.organization_id}
        style={{
          backgroundColor: profile?.organization_id ? "#3b82f6" : "#9ca3af",
          cursor: profile?.organization_id && !loading ? "pointer" : "not-allowed",
          padding: "10px 20px",
          borderRadius: "5px",
          border: "none",
          color: "white",
          fontWeight: "bold"
        }}
      >
        {loading ? "Creating..." : profile?.organization_id ? "Create Class" : "Cannot Create (No Organization)"}
      </button>
    </div>
  );
}