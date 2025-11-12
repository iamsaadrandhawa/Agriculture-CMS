import { NavLink } from "react-router-dom";

export default function Sidebar() {
  const links = [
    { path: "/dashboard", name: "Daily Transactions" },
    { path: "/dashboard/reports", name: "Reports" },
    { path: "/dashboard/employees", name: "Employees" },
    { path: "/dashboard/ledger-codes", name: "Ledger Codes" },
  ];

  return (
    <aside className="w-64 bg-blue-600 text-white flex flex-col">
      <div className="text-2xl font-bold text-center py-4 border-b border-blue-500">
        RMS Panel
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) =>
              `block p-2 rounded ${
                isActive ? "bg-blue-800" : "hover:bg-blue-500"
              }`
            }
          >
            {link.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
