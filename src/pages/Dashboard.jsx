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
  ExternalLink,
  MessageCircle,
  Mail,
  Globe,
  Shield,
  Zap,
  Building,
  Landmark,
  Wallet,
} from "lucide-react";
import "./Dropdown.css";

// Import modular sections
import DailyTransactions from "./DailyTransactions";
import Reports from "./Reports";
import AgriStore from "./Store";
import Employees from "./Employees";
import LedgerCodes from "./LedgerCodes";
import UserManager from "./UserManager";
import VehicalManager from "./VehicalManager";
import BankManager from "./BankManager"; // We'll create this

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
  const [banksData, setBanksData] = useState([]);
  const [cashBalance, setCashBalance] = useState(0);

  // ✅ Load global data (shared among users)
  useEffect(() => {
    const savedTransactions = localStorage.getItem("sharedData");
    const savedBanks = localStorage.getItem("banksData");
    const savedCash = localStorage.getItem("cashBalance");

    if (savedTransactions) {
      setDailyTransactionsData(JSON.parse(savedTransactions));
    }
    if (savedBanks) {
      setBanksData(JSON.parse(savedBanks));
    }
    if (savedCash) {
      setCashBalance(parseFloat(savedCash));
    }
  }, []);

  // ✅ Save data globally so every user sees same thing
  useEffect(() => {
    localStorage.setItem("sharedData", JSON.stringify(dailyTransactionsData));
    localStorage.setItem("banksData", JSON.stringify(banksData));
    localStorage.setItem("cashBalance", cashBalance.toString());
  }, [dailyTransactionsData, banksData, cashBalance]);

  // ✅ Calculate total bank balance
  const totalBankBalance = banksData.reduce((total, bank) => total + (parseFloat(bank.balance) || 0), 0);
  const totalBalance = totalBankBalance + cashBalance;

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
        
        // Qodigi Performance Logging
        console.log(`🚀 QODIGI SYSTEM: Dashboard loaded for ${storedUser?.email}`);
        console.log(`🎯 QODIGI ROLE: ${storedUser?.role} | Platform: qodigi-rms-v1.0`);
      }
    });
    return () => unsubscribe();
  }, []);

  // ✅ Logout with Qodigi tracking
  const handleLogout = async () => {
    console.log(`🔐 QODIGI AUTH: User ${name} logging out`);
    await signOut(auth);
    localStorage.removeItem("userData");
    window.location.href = "/";
  };

  // ✅ Contact Qodigi functions
  const handleContactQodigi = () => {
    console.log("🌐 QODIGI: Navigating to qodigi.netlify.app");
    window.open("https://qodigi.netlify.app", "_blank", "noopener,noreferrer");
  };

  // ✅ Main content switch
  const renderContent = () => {
    const sharedProps = {
      role,
      data: dailyTransactionsData,
      setData: setDailyTransactionsData,
      banksData,
      setBanksData,
      cashBalance,
      setCashBalance,
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
      case "bikes":
        return <VehicalManager {...sharedProps} />;
      case "banks":
        return <BankManager {...sharedProps} />;
      case "user-manager":
        return role === "admin" ? <UserManager {...sharedProps} /> : (
          <div className="access-denied">
            <Network className="denied-icon" />
            <h3>Access Denied</h3>
            <p>You do not have permission to access User Management.</p>
          </div>
        );
      case "ledger-manager":
        return role === "admin" ? <LedgerCodes {...sharedProps} /> : (
          <div className="access-denied"> 
            <Shield className="denied-icon" />
            <h3>Access Denied</h3>
            <p>You do not have permission to access Ledger Codes.</p>
          </div>
        );
      default:
        return <DailyTransactions {...sharedProps} />;
    }
  };

  // Menu items configuration (simplified - moved admin items to dropdown)
  const menuItems = [
    { id: "daily-transactions", label: "Daily Transactions", icon: FileText, color: "green" },
    { id: "reports", label: "Reports", icon: ChartColumn, color: "red" },
    { id: "Agristore", label: "Agri Store", icon: Warehouse, color: "blue" },
    { id: "employees", label: "Employees", icon: Users, color: "purple" },
    { id: "bikes", label: "Vehicles", icon: Tractor, color: "orange" },
    { id: "banks", label: "Banks", icon: Landmark, color: "indigo" },
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
        
        {/* Qodigi Background Signature */}
        <div className="qodigi-watermark">
          <div className="qodigi-text">QODIGI</div>
          <div className="qodigi-subtext">TECHNOLOGY</div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="dashboard-layout">
        {/* Main Content */}
        <main className="main-content">
          {/* Top Header with Navigation */}
          <header className="top-header">
            {/* Left Section: Logo with Qodigi Badge */}
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
                
                {/* Balance Stats */}
                <div className="balance-stats">
                  <div className="balance-item">
                    <Wallet className="w-4 h-4 text-green-600" />
                    <span className="balance-label">Cash:</span>
                    <span className="balance-amount">Rs. {cashBalance.toLocaleString()}</span>
                  </div>
                  <div className="balance-item">
                    <Landmark className="w-4 h-4 text-blue-600" />
                    <span className="balance-label">Banks:</span>
                    <span className="balance-amount">Rs. {totalBankBalance.toLocaleString()}</span>
                  </div>
                  <div className="balance-item total">
                    <span className="balance-label">Total:</span>
                    <span className="balance-amount">Rs. {totalBalance.toLocaleString()}</span>
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

            {/* Right Section: User Info + Contact Button */}
            <div className="header-right">
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

                    {/* Admin Sections in Dropdown */}
                    {role === "admin" && (
                      <>
                        <button
                          onClick={() => {
                            setActiveSection("user-manager");
                            setUserDropdownOpen(false);
                          }}
                          className="dropdown-item touchable"
                        >
                          <div className="dropdown-item-content">
                            <UserPlus className="dropdown-icon" />
                            <div className="dropdown-text">
                              <span className="dropdown-title">User Management</span>
                              <span className="dropdown-subtitle">Manage system users</span>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setActiveSection("ledger-manager");
                            setUserDropdownOpen(false);
                          }}
                          className="dropdown-item touchable"
                        >
                          <div className="dropdown-item-content">
                            <Tag className="dropdown-icon" />
                            <div className="dropdown-text">
                              <span className="dropdown-title">Ledger Codes</span>
                              <span className="dropdown-subtitle">Manage accounting codes</span>
                            </div>
                          </div>
                        </button>
                      </>
                    )}

                    {/* Contact Us */}
                    <button
                      onClick={handleContactQodigi}
                      className="dropdown-item touchable"
                    >
                      <div className="dropdown-item-content">
                        <MessageCircle className="dropdown-icon" />
                        <div className="dropdown-text">
                          <span className="dropdown-title">Contact Us</span>
                          <span className="dropdown-subtitle">Get in touch</span>
                        </div>
                      </div>
                      <ExternalLink className="dropdown-arrow" />
                    </button>

                    {/* Logout Button */}
                    <button
                      onClick={handleLogout}
                      className="dropdown-item touchable logout-btn"
                    >
                      <div className="dropdown-item-content">
                        <LogOut className="dropdown-icon" />
                        <div className="dropdown-text">
                          <span className="dropdown-title">Logout</span>
                          <span className="dropdown-subtitle">Sign out of your account</span>
                        </div>
                      </div>
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

      {/* Qodigi System Status Bar */}
      <div className="qodigi-status-bar">
        <div className="status-content">
          <div className="status-left">
            <div className="status-indicator">
              <div className="status-dot"></div>
              <span>System Online</span>
            </div>
            <span className="status-separator">|</span>
            <span>Qodigi Platform</span>
            <span className="status-separator">|</span>
            <span>User: {name}</span>
            <span className="status-separator">|</span>
            <span>Cash: Rs. {cashBalance.toLocaleString()}</span>
          </div>
          <div className="status-right">
            <span 
              className="status-link"
              onClick={handleContactQodigi}
              title="Visit Qodigi Website"
            >
              Powered by Qodigi
            </span>
            <span className="status-separator">|</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Hidden Qodigi Metadata */}
      <div style={{ display: 'none' }} 
           data-platform="qodigi-rms" 
           data-version="1.0" 
           data-company="Qodigi"
           data-user-role={role}
           data-user-name={name}>
        Qodigi Agricultural Management System - Secure, Reliable, Professional
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

        /* Qodigi Watermark */
        .qodigi-watermark {
          position: absolute;
          bottom: 20px;
          right: 20px;
          text-align: right;
          opacity: 0.05;
          pointer-events: none;
          z-index: -1;
        }

        .qodigi-text {
          font-size: 48px;
          font-weight: 900;
          color: white;
          line-height: 1;
          letter-spacing: 2px;
        }

        .qodigi-subtext {
          font-size: 14px;
          font-weight: 600;
          color: white;
          letter-spacing: 4px;
          margin-top: -5px;
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
          gap: 20px;
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

        /* Balance Stats */
        .balance-stats {
          display: flex;
          align-items: center;
          gap: 16px;
          background: rgba(255, 255, 255, 0.9);
          padding: 8px 16px;
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .balance-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 500;
        }

        .balance-item.total {
          background: linear-gradient(135deg, #27ae60, #2ecc71);
          color: white;
          padding: 4px 8px;
          border-radius: 6px;
          margin-left: 4px;
        }

        .balance-label {
          color: #666;
        }

        .balance-item.total .balance-label {
          color: white;
        }

        .balance-amount {
          font-weight: 600;
          color: #1a1a1a;
        }

        .balance-item.total .balance-amount {
          color: white;
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
          min-width: 220px;
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

        .dropdown-item {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 12px 16px;
          background: none;
          border: none;
          cursor: pointer;
          color: #666;
          transition: background 0.2s;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }

        .dropdown-item:last-child {
          border-bottom: none;
        }

        .dropdown-item:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        .dropdown-item-content {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .dropdown-icon {
          width: 16px;
          height: 16px;
          color: #666;
        }

        .dropdown-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .dropdown-title {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .dropdown-subtitle {
          font-size: 12px;
          color: #888;
        }

        .dropdown-arrow {
          width: 14px;
          height: 14px;
          color: #999;
        }

        .logout-btn {
          color: #dc2626;
        }

        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .content-area {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
          position: relative;
        }

        /* Qodigi Status Bar */
        .qodigi-status-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(135deg, #1e293b, #0f172a);
          color: white;
          padding: 6px 16px;
          font-size: 11px;
          z-index: 50;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .status-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .status-left, .status-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .status-separator {
          color: #6b7280;
        }

        .status-link {
          cursor: pointer;
          transition: color 0.3s ease;
        }

        .status-link:hover {
          color: #60a5fa;
        }

        /* Access Denied Styling */
        .access-denied {
          text-align: center;
          padding: 60px 20px;
          color: #666;
        }

        .denied-icon {
          width: 48px;
          height: 48px;
          color: #dc2626;
          margin: 0 auto 16px;
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

        /* Responsive Design */
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

          .balance-stats {
            flex-direction: column;
            gap: 8px;
            align-items: flex-start;
          }
        }

        @media (max-width: 768px) {
          .balance-stats {
            display: none;
          }
          
          .status-content {
            flex-direction: column;
            gap: 4px;
            text-align: center;
          }
        }

        @media (max-width: 480px) {
          .user-name-sm {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}