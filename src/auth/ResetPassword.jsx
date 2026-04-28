import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./ResetPassword.css";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    // If the reset link is invalid/expired, Supabase adds error to URL hash
    const hash = window.location.hash;
    if (hash.includes("error=")) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const msg =
        params.get("error_description") ||
        "Reset link is invalid or expired. Please request again.";
      setLinkError(msg.replace(/\+/g, " "));
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (linkError) {
      alert(linkError);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Password updated successfully. Please login.");
      window.location.href = "/login";
    }
  };

  return (
    <div className="rp-container">
      <form className="rp-card" onSubmit={handleSubmit}>
        <h2 className="rp-title">Reset Password</h2>

        {linkError && (
          <p className="rp-error">
            {linkError}
            <br />
            Please go back and request a new reset link.
          </p>
        )}

        <input
          type="password"
          placeholder="Enter new password"
          className="rp-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="rp-button" type="submit" disabled={loading}>
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
