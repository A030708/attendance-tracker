// src/components/student/JoinClass.jsx
import { useState } from "react";
import { supabase } from "../../lib/supabase.js";

export default function JoinClass({ onJoined }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) {
      alert("Enter class code");
      return;
    }

    setLoading(true);

    try {
      const { data: userRes, error: userError } =
        await supabase.auth.getUser();
      if (userError) {
        console.error("Auth error:", userError);
        alert("Please login again");
        setLoading(false);
        return;
      }

      const user = userRes?.user;
      if (!user) {
        alert("Please login again");
        setLoading(false);
        return;
      }

      const normalizedCode = code.trim().toUpperCase();

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "join_class",
        { p_class_code: normalizedCode }
      );

      if (rpcError) {
        console.error("RPC Error:", rpcError);
        alert(rpcError.message || "Failed to join class");
        setLoading(false);
        return;
      }

      console.log("join_class result:", rpcData);

      if (rpcData && rpcData.class_id && rpcData.student_id) {
        alert("You have joined the class successfully!");
        setCode("");

        // Tell dashboard to reload OR just hard reload
        if (onJoined) {
          onJoined(rpcData);
        } else {
          window.location.reload();
        }
      } else {
        alert("Unable to join class. Please try again.");
      }
    } catch (err) {
      console.error("Unexpected error in handleJoin:", err);
      alert("Unexpected error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="join-class">
      <h3>Join Class</h3>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Enter Class Code"
        style={{ width: 220, marginBottom: 10 }}
      />

      <button disabled={loading} onClick={handleJoin}>
        {loading ? "Joining..." : "Join Class"}
      </button>
    </div>
  );
}
