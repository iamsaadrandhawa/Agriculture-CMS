import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
// import { Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Animation for floating elements
  useEffect(() => {
    const createFloatingElement = () => {
      const container = document.querySelector('.animation-container');
      if (!container) return;

      const element = document.createElement('div');
      const types = ['leaf', 'seed', 'wheat'];
      const type = types[Math.floor(Math.random() * types.length)];

      element.className = `floating-element floating-${type}`;
      element.style.left = `${Math.random() * 100}%`;
      element.style.animationDuration = `${15 + Math.random() * 20}s`;
      element.style.opacity = `${0.2 + Math.random() * 0.5}`;

      container.appendChild(element);

      // Remove element after animation completes
      setTimeout(() => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }, 30000);
    };

    // Create initial floating elements
    for (let i = 0; i < 15; i++) {
      setTimeout(createFloatingElement, i * 500);
    }

    // Continue creating elements periodically
    const interval = setInterval(createFloatingElement, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 🔹 Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 🔹 Fetch Firestore record for this user
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      let userData = null;

      if (userDocSnap.exists()) {
        userData = userDocSnap.data();

        // 🚫 If user status is inactive — block login
        if (userData.status && userData.status.toLowerCase() === "inactive") {
          console.warn(`🚫 User ${user.email} is inactive. Login blocked.`);
          setError("Your account is inactive. Please contact the administrator.");
          setLoading(false);
          return;
        }

        console.log(`✅ Welcome ${user.email}! Role: ${userData.role}`);
      } else {
        console.warn("⚠️ User document not found in Firestore. Assigning default role.");
        userData = { role: "read", email: user.email, status: "active" };
      }

      // 🔹 Save user data locally
      const dataToStore = {
        uid: user.uid,
        email: user.email,
        role: userData.role,
        name: userData.name || "",
        status: userData.status || "active",
      };

      localStorage.setItem("userData", JSON.stringify(dataToStore));

      // 🔹 Redirect to dashboard
      navigate("/dashboard", { state: dataToStore });

    } catch (err) {
      console.error("❌ Login error:", err);
      setError("Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Background with gradient and animation container */}
      <div className="background-container">
        <div className="animation-container"></div>
        <div className="gradient-overlay"></div>
      </div>

      {/* Main content */}
      <div className="content-wrapper">
        <div className="login-card">
          {/* Logo with animation */}
          <div className="logo-container">
            <div className="logo-animation">
              <div className="logo-circle">
                <img
                  src="/logo.png"
                  alt="Agriculture Logo"
                  className="logo-image"
                />
              </div>
              <div className="pulse-ring"></div>
              <div className="pulse-ring delay-1"></div>
            </div>
          </div>

          {/* Welcome text */}
          <div className="welcome-section">
            <h1 className="welcome-title">Welcome Back</h1>

          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label className="input-label">Email Address</label>
              <div className="input-container">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="form-input"
                  placeholder="you@example.com"
                />
                <span className="input-icon">✉️</span>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div className="input-container">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="form-input"
                  placeholder="••••••••"
                />
                <span className="input-icon">🔒</span>
              </div>
            </div>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="login-button"
            >
              {loading ? (
                <>
                  <span className="button-spinner"></span>
                  Logging in...
                </>
              ) : (
                "Login to Dashboard"
              )}
            </button>
            {/* <div className="text-center mt-6">
              <p className="text-sm text-gray-600">
                Need to create an admin account?{" "}
                <Link
                  to="/signup"
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  Create Admin
                </Link>
              </p>
            </div> */}
          </form>

          <div className="footer">
            <p className="footer-text">
              © {new Date().getFullYear()} by SAAD.Fresh air therapy.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-container {
          height: 100vh;
          width: 100vw;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
        }
        
        .background-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            linear-gradient(135deg, #0a5c36 0%, #1e8449 25%, #27ae60 50%, #2ecc71 75%, #58d68d 100%);
          z-index: -2;
        }
        
        .animation-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: -1;
        }
        
        .gradient-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 20% 80%, rgba(120, 219, 166, 0.3) 0%, transparent 50%),
                      radial-gradient(circle at 80% 20%, rgba(46, 204, 113, 0.2) 0%, transparent 50%),
                      radial-gradient(circle at 40% 40%, rgba(39, 174, 96, 0.15) 0%, transparent 50%);
          z-index: -1;
        }
        
        .content-wrapper {
          width: 100%;
          max-width: 440px;
          padding: 20px;
          z-index: 1;
        }
        
        .login-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 24px;
          padding: 40px 32px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2);
          position: relative;
          overflow: hidden;
        }
        
        .login-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #27ae60, #2ecc71, #58d68d);
        }
        
        .logo-container {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }
        
        .logo-animation {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .logo-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #27ae60, #2ecc71);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px rgba(39, 174, 96, 0.3);
          z-index: 2;
          position: relative;
        }
        
        .logo-image {
          width: 50px;
          height: 50px;
          object-fit: contain;
          filter: brightness(0) invert(1);
        }
        
        .pulse-ring {
          position: absolute;
          width: 100px;
          height: 100px;
          border: 2px solid rgba(39, 174, 96, 0.4);
          border-radius: 50%;
          animation: pulse 3s infinite;
          z-index: 1;
        }
        
        .delay-1 {
          animation-delay: 1s;
          width: 120px;
          height: 120px;
        }
        
        .welcome-section {
          text-align: center;
          margin-bottom: 32px;
        }
        
        .welcome-title {
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 8px;
        }
        
        .welcome-subtitle {
          font-size: 16px;
          color: #666;
          line-height: 1.5;
        }
        
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .input-label {
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }
        
        .input-container {
          position: relative;
        }
        
        .form-input {
          width: 100%;
          padding: 16px 48px 16px 16px;
          border: 1.5px solid #e1e8ed;
          border-radius: 12px;
          font-size: 16px;
          transition: all 0.3s ease;
          background: white;
          color: #333;
        }
        
        .form-input:focus {
          outline: none;
          border-color: #27ae60;
          box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.1);
        }
        
        .input-icon {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 18px;
        }
        
        .error-message {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(231, 76, 60, 0.1);
          border: 1px solid rgba(231, 76, 60, 0.2);
          border-radius: 8px;
          color: #c0392b;
          font-size: 14px;
        }
        
        .error-icon {
          font-size: 16px;
        }
        
        .login-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #27ae60, #2ecc71);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
          position: relative;
          overflow: hidden;
        }
        
        .login-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(39, 174, 96, 0.4);
        }
        
        .login-button:active:not(:disabled) {
          transform: translateY(0);
        }
        
        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }
        
        .button-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid transparent;
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        .footer {
          margin-top: 32px;
          text-align: center;
        }
        
        .footer-text {
          font-size: 14px;
          color: #888;
        }
        
        /* Floating elements */
        .floating-element {
          position: absolute;
          pointer-events: none;
          z-index: -1;
          animation-name: float;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        
        .floating-leaf::before {
          content: '🍃';
          font-size: 24px;
        }
        
        .floating-seed::before {
          content: '🌱';
          font-size: 20px;
        }
        
        .floating-wheat::before {
          content: '🌾';
          font-size: 22px;
        }
        
        /* Animations */
        @keyframes float {
          0% {
            transform: translateY(100vh) rotate(0deg);
          }
          100% {
            transform: translateY(-100px) rotate(360deg);
          }
        }
        
        @keyframes pulse {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          70% {
            transform: scale(1.2);
            opacity: 0;
          }
          100% {
            transform: scale(0.8);
            opacity: 0;
          }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* Responsive adjustments */
        @media (max-width: 480px) {
          .content-wrapper {
            padding: 16px;
          }
          
          .login-card {
            padding: 32px 24px;
          }
          
          .welcome-title {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}