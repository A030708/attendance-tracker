// src/components/teacher/CreateClass.jsx
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CreateClass({ onCreated }) {   // 👈 added prop
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [loading, setLoading] = useState(false);

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

    setLoading(true);

    try {
      const { data: userRes, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error("Auth error:", userError);
        alert("Error checking login. Please login again.");
        setLoading(false);
        return;
      }

      const user = userRes?.user;
      if (!user) {
        alert("Please login again");
        setLoading(false);
        return;
      }

      const classCode = generateClassCode();

      const { data, error } = await supabase
        .from("classes")
        .insert([
          {
            teacher_id: user.id,
            name: name.trim(),
            section: section.trim() || null,
            class_code: classCode,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Create class error:", error);
        alert(error.message || "Failed to create class");
        setLoading(false);
        return;
      }

      alert(`Class created!\nClass Code: ${data.class_code}`);
      setName("");
      setSection("");

      // 👇 notify parent dashboard to refresh classes
      if (onCreated) {
        onCreated(data);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("Unexpected error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-class">
      <h3>Create Class</h3>

      <div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Class Name"
        />
      </div>

      <br />

      <div>
        <input
          value={section}
          onChange={(e) => setSection(e.target.value)}
          placeholder="Section (optional)"
        />
      </div>

      <br />

      <button onClick={handleCreate} disabled={loading}>
        {loading ? "Creating..." : "Create Class"}
      </button>
    </div>
  );
}
