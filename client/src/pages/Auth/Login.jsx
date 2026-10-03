import React, { useState } from "react";
import SignupModal from "./components/SignupModal";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";
import ResetPassword from "./ResetPassword";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [resetToken, setResetToken] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!identifier) {
      setError("Please enter your credentials.");
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/auth/login", {
        identifier,
        password,
      });

      if (res.data.resetRequired) {
        setResetToken(res.data.resetToken);
        return;
      }

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (resetToken) {
    return <ResetPassword resetToken={resetToken} />;
  }

  return (
    <div className="auth-container">
      <div className="login-card">
        <h2>Login</h2>

        {error && <p className="error-text">{error}</p>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Username / Email / Phone</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter username, email or phone"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="signup-text">
          New user?{" "}
          <span className="signup-link" onClick={() => setShowSignup(true)}>
            Sign up
          </span>
        </p>
      </div>

      {showSignup && <SignupModal onClose={() => setShowSignup(false)} />}
    </div>
  );
}
