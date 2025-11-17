import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import {
  FileText,
  Users,
  ChartColumn,
  Tag,
  Tractor,
  UserPlus,
  Network,
  LogOut,
  ChevronDown,
  Warehouse,
} from "lucide-react";

// Import modular sections
import DailyTransactions from "./DailyTransactions";
import Reports from "./Reports";
import AgriStore from "./Store";
import Employees from "./Employees";
import LedgerCodes from "./LedgerCodes";
import UserManager from "./UserManager";
import VehicalManager from "./VehicalManager";

// ✅ Helper to load user role from localStorage
function getStoredUser() {
  try {
    const data = localStorage.getItem("userData");
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [name, setName] = useState("");
  const [activeSection, setActiveSection] = useState("daily-transactions");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // ✅ Shared (global) data — visible to every logged-in user
  const [dailyTransactionsData, setDailyTransactionsData] = useState([]);

  // ✅ Load global data (shared among users)
  useEffect(() => {
    const saved = localStorage.getItem("sharedData");
    if (saved) {
      setDailyTransactionsData(JSON.parse(saved));
    }
  }, []);

  // ✅ Save data globally so every user sees same thing
  useEffect(() => {
    localStorage.setItem("sharedData", JSON.stringify(dailyTransactionsData));
  }, [dailyTransactionsData]);

  // ✅ Firebase Auth + get role from localStorage
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        window.location.href = "/";
      } else {
        const storedUser = getStoredUser();
        setUser(currentUser);
        setRole(storedUser?.role || "read"); // default role: read
        setName(storedUser?.name || "");
      }
    });
    return () => unsubscribe();
  }, []);

  // ✅ Logout
  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("userData");
    window.location.href = "/";
  };

  // ✅ Main content switch
  const renderContent = () => {
    const sharedProps = {
      role,
      data: dailyTransactionsData,
      setData: setDailyTransactionsData,
    };

    switch (activeSection) {
      case "daily-transactions":
        return <DailyTransactions {...sharedProps} />;
      case "reports":
        return <Reports {...sharedProps} />;
      case "Agristore":
        return <AgriStore {...sharedProps} />;
      case "employees":
        return <Employees {...sharedProps} />;
      case "ledger-codes":
        return <LedgerCodes {...sharedProps} />;
      case "bikes":
        return <VehicalManager {...sharedProps} />;
      case "user-manager":
        return role === "admin" ? (
          <UserManager />
        ) : (
          <div className="access-denied">
            <div className="denied-icon">🔒</div>
            <h3>Access Denied</h3>
            <p>Only Administrators can manage users</p>
          </div>
        );
      default:
        return <DailyTransactions {...sharedProps} />;
    }
  };

  // Menu items configuration
  const menuItems = [
    { id: "daily-transactions", label: "Daily Transactions", icon: FileText, color: "green" },
    { id: "reports", label: "Reports", icon: ChartColumn, color: "red" },
    { id: "Agristore", label: "Agri Store", icon: Warehouse, color: "blue" },
    { id: "employees", label: "Employees", icon: Users, color: "purple" },
    { id: "bikes", label: "Vehicles", icon: Tractor, color: "orange" },
    ...(role === "admin" ? [
      { id: "user-manager", label: "User Management", icon: UserPlus, color: "gray" },
      { id: "ledger-codes", label: "Ledger Codes", icon: Tag, color: "indigo" }
    ] : [])
  ];

  const getColorClasses = (color, isActive) => {
    const colorMap = {
      green: isActive ? 
        "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg" : 
        "text-gray-700 hover:bg-green-50 hover:text-green-600",
      red: isActive ? 
        "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg" : 
        "text-gray-700 hover:bg-red-50 hover:text-red-600",
      blue: isActive ? 
        "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg" : 
        "text-gray-700 hover:bg-blue-50 hover:text-blue-600",
      purple: isActive ? 
        "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg" : 
        "text-gray-700 hover:bg-purple-50 hover:text-purple-600",
      orange: isActive ? 
        "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg" : 
        "text-gray-700 hover:bg-orange-50 hover:text-orange-600",
      gray: isActive ? 
        "bg-gradient-to-r from-gray-600 to-gray-700 text-white shadow-lg" : 
        "text-gray-700 hover:bg-gray-50 hover:text-gray-600",
      indigo: isActive ? 
        "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg" : 
        "text-gray-700 hover:bg-indigo-50 hover:text-indigo-600"
    };
    return colorMap[color] || colorMap.green;
  };

  return (
    <div className="dashboard-container">
      {/* Background Animation */}
      <div className="background-animation">
        <div className="animation-container"></div>
        <div className="gradient-overlay"></div>
      </div>

      {/* Main Layout */}
      <div className="dashboard-layout">
        {/* Main Content */}
        <main className="main-content">
          {/* Top Header with Navigation */}
          <header className="top-header">
            {/* Left Section: Logo */}
            <div className="header-left">
              <div className="logo-section">
                <div className="logo-wrapper">
                  <div className="logo-circle">
                    <img
                      src="/logo.png"
                      alt="Agriculture Logo"
                      className="logo-image"
                    />
                  </div>
                  <div className="logo-text">
                    <h2>Agriculture</h2>
                    <p>Management System</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Center Section: Navigation Menu */}
            <div className="header-center">
              <nav className="navigation-menu">
                {menuItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`nav-button ${getColorClasses(item.color, activeSection === item.id)}`}
                    >
                      <div className="nav-button-icon">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <span className="nav-button-label">{item.label}</span>
                      {activeSection === item.id && (
                        <div className="nav-button-active-indicator"></div>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Right Section: User Info */}
            <div className="header-right">
              {/* <div className="breadcrumb">
                <span className="section-title">
                  {menuItems.find(item => item.id === activeSection)?.label || "Dashboard"}
                </span>
              </div> */}

              <div className="user-dropdown">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="user-dropdown-btn"
                >
                  <div className="user-avatar-sm">
                    {name ? name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <span className="user-name-sm">{name || "User"}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {userDropdownOpen && (
                  <div className="dropdown-menu">
                    <div className="dropdown-header">
                      <p className="user-email">{user?.email}</p>
                      <p className="user-role-badge capitalize">{role}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="logout-btn"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Content Area */}
          <div className="content-area">
            {renderContent()}
          </div>
        </main>
      </div>

      <style jsx>{`
        .dashboard-container {
          height: 100vh;
          width: 100vw;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
        }

        .background-animation {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #0a5c36 0%, #1e8449 25%, #27ae60 50%, #2ecc71 75%, #58d68d 100%);
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

        .dashboard-layout {
          display: flex;
          height: 100vh;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
        }

        /* Main Content Styles */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: rgba(249, 250, 251, 0.8);
        }

        .top-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          box-shadow: 0 2px 15px rgba(0, 0, 0, 0.08);
          position: relative;
          z-index: 40;
          gap: 24px;
        }

        .header-left {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .logo-section {
          display: flex;
          align-items: center;
        }

        .logo-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-circle {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: linear-gradient(135deg, #27ae60, #2ecc71);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
        }

        .logo-image {
          width: 26px;
          height: 26px;
          object-fit: contain;
          filter: brightness(0) invert(1);
        }

        .logo-text h2 {
          font-size: 18px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0;
          line-height: 1.2;
        }

        .logo-text p {
          font-size: 11px;
          color: #666;
          margin: 0;
          line-height: 1.2;
        }

        /* Center Section: Navigation Menu */
        .header-center {
          flex: 1;
          display: flex;
          justify-content: center;
        }

        .navigation-menu {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .nav-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 500;
          font-size: 14px;
          position: relative;
          white-space: nowrap;
          min-width: fit-content;
        }

        .nav-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .nav-button-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
        }

        .nav-button-label {
          font-size: 13px;
          font-weight: 500;
        }

        .nav-button-active-indicator {
          position: absolute;
          bottom: -12px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: pulse 2s infinite;
        }

        /* Right Section */
        .header-right {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-shrink: 0;
        }

        .breadcrumb {
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 8px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: #1a1a1a;
        }

        .user-dropdown {
          position: relative;
        }

        .user-dropdown-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px 12px;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .user-dropdown-btn:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        .user-avatar-sm {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: linear-gradient(135deg, #27ae60, #2ecc71);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 14px;
        }

        .user-name-sm {
          font-weight: 500;
          color: #333;
          font-size: 14px;
        }

        .dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 8px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(0, 0, 0, 0.1);
          min-width: 200px;
          z-index: 30;
        }

        .dropdown-header {
          padding: 16px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .user-email {
          font-size: 14px;
          color: #666;
          margin: 0 0 4px 0;
        }

        .user-role-badge {
          font-size: 12px;
          background: linear-gradient(135deg, #27ae60, #2ecc71);
          color: white;
          padding: 4px 8px;
          border-radius: 6px;
          display: inline-block;
        }

        .logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: none;
          border: none;
          cursor: pointer;
          color: #666;
          transition: background 0.2s;
        }

        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
        }

        .content-area {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
        }

        /* Access Denied Styling */
        .access-denied {
          text-align: center;
          padding: 60px 20px;
          color: #666;
        }

        .denied-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .access-denied h3 {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #333;
        }

        /* Animations */
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        /* Floating elements for background */
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
          font-size: 20px;
        }

        .floating-seed::before {
          content: '🌱';
          font-size: 18px;
        }

        .floating-wheat::before {
          content: '🌾';
          font-size: 19px;
        }

        @keyframes float {
          0% {
            transform: translateY(100vh) rotate(0deg);
          }
          100% {
            transform: translateY(-100px) rotate(360deg);
          }
        }

        /* Responsive Design */
        @media (max-width: 1200px) {
          .navigation-menu {
            gap: 6px;
          }
          
          .nav-button {
            padding: 8px 12px;
            font-size: 13px;
          }
          
          .nav-button-label {
            font-size: 12px;
          }
        }

        @media (max-width: 1024px) {
          .top-header {
            flex-wrap: wrap;
            gap: 16px;
            padding: 12px 16px;
          }
          
          .header-center {
            order: 3;
            flex: 1 1 100%;
            margin-top: 8px;
          }
          
          .navigation-menu {
            justify-content: flex-start;
            overflow-x: auto;
            padding-bottom: 4px;
          }
          
          .header-left, .header-right {
            flex: 1;
          }
          
          .header-right {
            justify-content: flex-end;
          }
        }

        @media (max-width: 768px) {
          .top-header {
            padding: 10px 12px;
          }

          .logo-text h2 {
            font-size: 16px;
          }

          .logo-text p {
            font-size: 10px;
          }

          .logo-circle {
            width: 38px;
            height: 38px;
          }

          .logo-image {
            width: 22px;
            height: 22px;
          }

          .nav-button {
            padding: 6px 10px;
            font-size: 12px;
          }

          .nav-button-label {
            font-size: 11px;
          }

          .section-title {
            font-size: 13px;
          }

          .user-name-sm {
            display: none;
          }

          .breadcrumb {
            padding: 6px 12px;
          }

          .content-area {
            padding: 16px;
          }
        }

        @media (max-width: 480px) {
          .logo-text {
            display: none;
          }

          .navigation-menu {
            gap: 4px;
          }

          .nav-button {
            padding: 6px 8px;
          }

          .nav-button-label {
            font-size: 10px;
          }

          .breadcrumb {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}