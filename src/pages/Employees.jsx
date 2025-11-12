import { useEffect, useState } from "react";
import { Plus, Save, Users, Edit3, Trash2, Search, Filter, X, UserPlus, Lock } from "lucide-react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getCurrentUser } from "../components/userUtils";

export default function EmployeeManager() {
  const [showForm, setShowForm] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [designation, setDesignation] = useState("");
  const [salary, setSalary] = useState("");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusActiveFilter, setStatusActiveFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("Active");
  const [role, setRole] = useState(null);



  useEffect(() => {
    const fetchUserRole = async () => {
      const user = await getCurrentUser();
      if (user && user.role) {
        setRole(user.role);
      } else {
        setRole("read");
      }
    };

    fetchUserRole();
  }, []);

  const fetchEmployees = async (uidParam) => {
    const uid = uidParam || (auth.currentUser && auth.currentUser.uid);
    if (!uid) {
      setEmployees([]);
      return;
    }

    try {
      const q = query(
        collection(db, "employees"),
        orderBy("name")
      );
      const snapshot = await getDocs(q);
      setEmployees(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      if (err.code === "failed-precondition") {
        const q = query(collection(db, "employees"), where("user_id", "==", uid));
        const snapshot = await getDocs(q);
        setEmployees(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        fetchEmployees(user.uid);
      } else {
        setEmployees([]);
      }
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!employeeName.trim() || !designation.trim() || salary === "") {
      alert("Please fill all fields before saving.");
      return;
    }
    if (!currentUser) {
      alert("User not logged in!");
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "employees", editingId), {
          name: employeeName,
          designation,
          salary: Number(salary),
          status,
          updatedAt: Timestamp.now(),
        });
        alert("✅ Employee updated successfully!");
        setEditingId(null);
      } else {
        await addDoc(collection(db, "employees"), {
          name: employeeName,
          designation,
          salary: Number(salary),
          status: "Active",
          createdAt: Timestamp.now(),
          user_id: currentUser.uid,
        });
        alert("✅ Employee saved successfully!");
      }

      fetchEmployees(currentUser.uid);
      setEmployeeName("");
      setDesignation("");
      setSalary("");
      setShowForm(false);
    } catch (error) {
      alert("Failed to save employee: " + (error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (emp) => {
    setEditingId(emp.id);
    setEmployeeName(emp.name || "");
    setDesignation(emp.designation || "");
    setSalary(emp.salary != null ? String(emp.salary) : "");
    setStatus(emp.status || "Inactive");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "employees", id));
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      alert("✅ Employee deleted");
    } catch (err) {
      alert("Failed to delete employee: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const formatSalary = (s) => {
    if (s == null || s === "") return "-";
    const n = Number(s);
    if (Number.isNaN(n)) return s;
    return n.toLocaleString();
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDesignation = statusFilter === "all" || emp.designation === statusFilter;
    const matchesStatus =
      statusActiveFilter === "all" || emp.status === statusActiveFilter;

    return matchesSearch && matchesDesignation && matchesStatus;
  });

  const stats = {
    total: employees.length,
    active: employees.filter((emp) => emp.status === "Active").length,
    inactive: employees.filter((emp) => emp.status === "Inactive").length,
    totalSalary: employees
      .filter((emp) => emp.status === "Active")
      .reduce((sum, emp) => sum + (parseFloat(emp.salary) || 0), 0),
  };

  const handleDownloadEmployeePDF = async () => {
    try {
      if (!employees || employees.length === 0) {
        alert("No employees found to generate PDF.");
        return;
      }

      const activeEmployees = employees.filter(
        (emp) => emp.status?.toLowerCase() === "active"
      );

      if (activeEmployees.length === 0) {
        alert("No active employees found to generate PDF.");
        return;
      }

      const doc = new jsPDF("p", "pt", "a4");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 64, 175);
      doc.text("Mascot Employee Report", 40, 50);

      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 40, 70);

      const totalSalary = activeEmployees.reduce(
        (sum, emp) => sum + (parseFloat(emp.salary) || 0),
        0
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(0, 102, 51);
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.text(
        `Total Active Salaries: PKR ${totalSalary.toLocaleString()}`,
        pageWidth - 250,
        50
      );

      const grouped = activeEmployees.reduce((acc, emp) => {
        const role = emp.designation || "Others";
        if (!acc[role]) acc[role] = [];
        acc[role].push(emp);
        return acc;
      }, {});

      let startY = 100;

      for (const [designation, group] of Object.entries(grouped)) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0, 102, 51);
        doc.text(designation.toUpperCase(), 40, startY);
        startY += 10;

        autoTable(doc, {
          head: [["Name", "Designation", "Salary"]],
          body: group.map((emp) => [
            emp.name || "—",
            emp.designation || "—",
            emp.salary || "—",
          ]),
          startY: startY + 10,
          theme: "grid",
          headStyles: {
            fillColor: [66, 133, 244],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 12,
          },
          styles: {
            fontSize: 12,
            cellPadding: 5,
            textColor: [50, 50, 50],
          },
          alternateRowStyles: { fillColor: [245, 247, 250] },
        });

        startY = doc.lastAutoTable.finalY + 30;
      }

      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text(
        "Generated by Mascot RMS System" + new Date().getFullYear(),
        40,
        doc.internal.pageSize.height - 20
      );

      doc.save("Mascot_Employee_Report.pdf");
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("Failed to generate PDF. Check console for details.");
    }
  };

  return (
    <div className="w-full mx-auto py-3 px-4 text-[12px] text-gray-800">
      <div className="max-w-9xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Employee Management</h2>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleDownloadEmployeePDF}
              className="flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-700 hover:from-green-600 hover:to-emerald-800 text-white px-4 py-1.5 rounded-lg font-semibold shadow-md text-[12px]"
            >
              <Save className="w-3 h-3" /> Download Employee PDF
            </button>

            <button
              onClick={() => {
                if (role === "read") return;
                if (!showForm) {
                  setEditingId(null);
                  setEmployeeName("");
                  setDesignation("");
                  setSalary("");
                  setStatus("Active");
                }
                setShowForm(!showForm);
              }}
              disabled={role === "read"}
              className={`flex items-center gap-1 px-4 py-1.5 rounded-lg font-semibold shadow-md text-[12px] transition
    ${role === "read"
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : showForm
                    ? "bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white"
                    : "bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white"
                }`}
            >
              {role === "read" ? (
                <>
                  <Lock className="w-3 h-3" /> Locked
                </>
              ) : showForm ? (
                <>
                  <X className="w-3 h-3" /> Close Form
                </>
              ) : (
                <>
                  <UserPlus className="w-3 h-3" /> Add Employee
                </>
              )}
            </button>





          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 text-[12px]">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-gray-600">Total Employees</p>
                <p className="text-[12px] font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl"><Users className="w-4 h-4 text-blue-600" /></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-gray-600">Active</p>
                <p className="text-[12px] font-bold text-gray-900 mt-1">{stats.active}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-orange-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-gray-600">Monthly Salary</p>
                <p className="text-[12px] font-bold text-gray-900 mt-1">Rs. {formatSalary(stats.totalSalary)}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl"><span className="text-lg">💰</span></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-gray-600">Inactive</p>
                <p className="text-[12px] font-bold text-gray-900 mt-1">{stats.inactive}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl"><span className="text-lg">⏸️</span></div>
            </div>
          </div>
        </div>

        {/* Add Employee Form */}
        {showForm && (
          <div className="bg-white rounded-2xl p-6 mb-4 shadow-lg border border-blue-200 text-[12px] text-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[12px] font-bold text-gray-900">{editingId ? "✏️ Edit Employee" : "👤 Add New Employee"}</h3>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-gray-700">Employee Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Shayan, Zain"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-gray-700">Designation *</label>
                <input
                  type="text"
                  placeholder="e.g., Manager, Helper"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-gray-700">Monthly Salary *</label>
                <input
                  type="number"
                  placeholder="0"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-gray-700">Status *</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Active" className="text-green-600 font-medium">Active</option>
                  <option value="Inactive" className="text-red-600 font-medium">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 text-[12px]"
              >
                <Save className="w-4 h-4" /> {loading ? "Saving..." : editingId ? "Update Employee" : "Save Employee"}
              </button>

              <button
                onClick={() => setShowForm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 text-[12px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 mb-3 shadow-lg text-[12px] text-gray-800">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search employees by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Designations</option>
                {[...new Set(employees.map((emp) => emp.designation))].map((des) => (
                  <option key={des} value={des}>{des}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusActiveFilter}
                onChange={(e) => setStatusActiveFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Employee Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden text-[12px] text-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[12px]">
                <tr>
                  <th className="px-6 py-3 text-left">Employee</th>
                  <th className="px-6 py-3 text-left">Designation</th>
                  <th className="px-6 py-3 text-right">Salary</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-[12px]">
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-blue-50 transition-all duration-200 group">
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-[12px]">
                            {emp.name?.charAt(0)?.toUpperCase() || "E"}
                          </div>
                          <div className="ml-3">
                            <div className="text-[12px] font-semibold text-gray-900 group-hover:text-blue-600">{emp.name}</div>
                            <div className="text-[10px] text-gray-500">ID: {emp.id.substring(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-2">{emp.designation}</td>
                      <td className="px-6 py-2 text-right">Rs. {formatSalary(emp.salary)}</td>
                      <td className="px-6 py-2 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold ${emp.status === "Active" ? "bg-green-100 text-green-800 border border-green-200" : "bg-red-100 text-red-800 border border-red-200"}`}>
                          {emp.status === "Active" && <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></div>}
                          {emp.status || "Active"}
                        </span>
                      </td>
                      <td className="px-6 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {role === "read" ? (
                            <div className="flex items-center gap-1 text-gray-400 cursor-not-allowed">
                              <Lock className="w-4 h-4" />
                              <span className="text-xs">Locked</span>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(emp)}
                                className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(emp.id)}
                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>


                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500 text-[12px]">
                      No employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 text-center text-[12px] text-gray-600">
          Showing {filteredEmployees.length} of {employees.length} employees
        </div>

      </div>
    </div>
  );
}
