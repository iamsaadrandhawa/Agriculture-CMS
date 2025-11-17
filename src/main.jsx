import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import "./index.css";
import CreateAdmin from "./pages/Sign";
import ComingSoon from "./pages/ComingSoon";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        {/* <Route path="/signup" element={<CreateAdmin />} /> */}
        <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/coming-soon" element={<ComingSoon />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
