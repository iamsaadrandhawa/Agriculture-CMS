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
} from "lucide-react";

// Import modular sections
import DailyTransactions from "./DailyTransactions";
import Reports from "./Reports";
import NewInstallation from "./NewInstallation";
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
  const [name , setName] = useState("");
  const [activeSection, setActiveSection] = useState("daily-transactions");

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
      case "new-installation":
        return <NewInstallation {...sharedProps} />;
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
          <div className="text-center text-red-600 font-semibold p-6">
            🔒 Access Denied — Only Admins can manage users.
          </div>
        );
      default:
        return <DailyTransactions {...sharedProps} />;
    }
  };

  return (
  <div className="h-screen w-screen flex flex-col bg-gray-100 overflow-y-auto">
    {/* Top Navbar */}
    <nav className="bg-white/90 backdrop-blur-md shadow-md py-2 px-3 flex justify-between items-center sticky top-0 z-10">
      {/* Left: Logo + Title */}
      <div className="flex items-center gap-2 ml-25">
        <img
          src="/logo.png"
          alt="Agriculture Logo"
          className="w-10 h-15 object-contain"
        />
        <h2 className="text-black text-base font-bold">Agriculture - CMS</h2>
      </div>

      {/* Right: User info + Logout */}
      <div className="flex items-center gap-3 mr-6">
        <p className="text-gray-700 text-xs">
          {user ? `${name?.toUpperCase()} ` : "Loading..."}
        </p>
        <span className="text-gray-400">|</span>
        <div
          onClick={handleLogout}
          className="cursor-pointer bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-600 active:scale-95 transition-all duration-200 shadow-md"
        >
          Logout
        </div>
      </div>
    </nav>

    {/* Secondary Menu Bar */}
    <div className="bg-white/90 backdrop-blur-md shadow-md py-1 px-4 mx-30 my-8 flex gap-4 rounded-2xl sticky top-[20px] z-10">
      {/* Daily Transactions */}
      <div
        onClick={() => setActiveSection("daily-transactions")}
        className={`flex items-center gap-2 mx-3 px-4 py-3 rounded-lg cursor-pointer transition whitespace-nowrap
          ${
            activeSection === "daily-transactions"
              ? "bg-green-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200"
          }`}
      >
        <FileText className="w-4 h-4" />
        <span className="text-sm font-medium">Daily Transactions</span>
      </div>

      {/* Reports */}
      <div
        onClick={() => setActiveSection("reports")}
        className={`flex items-center gap-1 px-1 py-1 rounded-lg cursor-pointer transition whitespace-nowrap
          ${
            activeSection === "reports"
              ? "bg-red-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200"
          }`}
      >
        <ChartColumn className="w-4 h-4" />
        <span className="text-sm font-medium">Reports</span>
      </div>
      {/* New Installation */}
      <div
        onClick={() => setActiveSection("new-installation")}
        className={`flex items-center gap-1 px-3 py-1 rounded-lg cursor-pointer transition whitespace-nowrap
          ${
            activeSection === "new-installation"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200"
          }`}
      >
        <Network className="w-4 h-4" />
        <span className="text-sm font-medium">New Installation</span>
      </div>


      {/* Employees */}
      <div
        onClick={() => setActiveSection("employees")}
        className={`flex items-center gap-1 px-3 py-1 rounded-lg cursor-pointer transition whitespace-nowrap
          ${
            activeSection === "employees"
              ? "bg-purple-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200"
          }`}
      >
        <Users className="w-4 h-4" />
        <span className="text-sm font-medium">Employees</span>
      </div>

      {/* Bikes */}
      <div
        onClick={() => setActiveSection("bikes")}
        className={`flex items-center gap-1 px-3 py-1 rounded-lg cursor-pointer transition whitespace-nowrap
          ${
            activeSection === "bikes"
              ? "bg-orange-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200"
          }`}
      >
        <Tractor className="w-4 h-4" />
        <span className="text-sm font-medium">Vehicals</span>
      </div>

      {/* User Manager — Only visible to Admins */}
      {role === "admin" && (
        <div
          onClick={() => setActiveSection("user-manager")}
          className={`flex items-center gap-1 px-3 py-1 rounded-lg cursor-pointer transition whitespace-nowrap
            ${
              activeSection === "user-manager"
                ? "bg-gray-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-200"
            }`}
        >
          <UserPlus className="w-4 h-4" />
          <span className="text-sm font-medium">Users</span>
        </div>
      
      )}

       {role === "admin" && (
      <div
        onClick={() => setActiveSection("ledger-codes")}
        className={`flex items-center gap-1 px-3 py-1 rounded-lg cursor-pointer transition whitespace-nowrap
          ${
            activeSection === "ledger-codes"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200"
          }`}
      >
        <Tag className="w-4 h-4" />
        <span className="text-sm font-medium">Ledger Codes</span>
      </div>
      )}
    </div>
      

    {/* Main Content */}
    <main className="bg-white/90 backdrop-blur-md shadow-md py-3 px-4 mx-30 my-1 flex gap-4 rounded-2xl">
      {renderContent()}
    </main>
  </div>
);
}