import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateAdmin from "./pages/Sign";
import UserManager from "./pages/UserManager";
import LedgerManager from "./pages/LedgerCodes";



function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        {/* <Route path="/signup" element={<CreateAdmin />} /> */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/user-manager" element={<UserManager />} />
        <Route path="/ledger-manager" element={<LedgerManager />} />
   
      </Routes>
    </BrowserRouter>
  );
}

export default App;
