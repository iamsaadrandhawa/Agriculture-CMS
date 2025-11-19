import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import "./index.css";
import CreateAdmin from "./pages/Sign";
import UserManager from "./pages/UserManager";
import LedgerManager from "./pages/LedgerCodes";


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        {/* <Route path="/signup" element={<CreateAdmin />} /> */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/user-manager" element={<UserManager />} />
        <Route path="/ledger-manager" element={<LedgerManager />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
