import { useState } from "react";
import { supabase } from "../lib/supabase";
import "./ForgotPassword.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setErrorMsg("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      console.error(error);
      setErrorMsg(error.message || "Something went wrong. Try again.");
    } else {
      setMessage(
        "Password reset link has been sent to your email. Please check Inbox/Spam."
      );
    }
  };

  return (
    <div className="fp-container">
      <form className="fp-card" onSubmit={handleSubmit}>
        <h2 className="fp-title">Forgot Password</h2>

        {message && <p className="fp-success">{message}</p>}
        {errorMsg && <p className="fp-error">{errorMsg}</p>}

        <label className="fp-label">Email address</label>
        <input
          type="email"
          className="fp-input"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button className="fp-button" type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
    </div>
  );
};

export default ForgotPassword;
