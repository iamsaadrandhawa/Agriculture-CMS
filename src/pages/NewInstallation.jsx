import { useState, useEffect } from "react";
import { getCurrentUser } from "../components/userUtils";
import { db } from "../lib/firebase";
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    Timestamp,
} from "firebase/firestore";
import {
    Users,
    Plus,
    X,
    Save,
    Lock,
    Edit3,
    Trash2,
    Search,
    Server,
    Wifi,
    DollarSign,
    HardDrive,
    Building2,
    User,
    Calendar
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function NewInstallation() {
    const [role, setRole] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [installations, setInstallations] = useState([]);
    const [employeeList, setEmployeeList] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [sortOrder, setSortOrder] = useState("asc");
    const [filterDate, setFilterDate] = useState("");
    // Form fields
    const [date, setDate] = useState("");
    const [userId, setUserId] = useState("");
    const [employee, setEmployee] = useState("");
    const [clientName, setClientName] = useState("");
    const [cashPaid, setCashPaid] = useState("");
    const [pendingAmount, setPendingAmount] = useState("");
    const [pendingDate, setPendingDate] = useState("");
    const [location, setLocation] = useState("");
    const [totalAmount, setTotalAmount] = useState("");
    const [modemType, setModemType] = useState(""); // Company or Self

    useEffect(() => {
        const fetchUserRole = async () => {
            const user = await getCurrentUser();
            if (user?.role) setRole(user.role);
        };
        fetchUserRole();
        fetchInstallations();
        fetchEmployees();
    }, []);

    // Fetch installations
    const fetchInstallations = async () => {
        const querySnapshot = await getDocs(collection(db, "new_installations"));
        const list = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        setInstallations(list.sort((a, b) => a.clientName.localeCompare(b.clientName)));
    };

    // Fetch employees
    const fetchEmployees = async () => {
        const querySnapshot = await getDocs(collection(db, "employees"));
        setEmployeeList(querySnapshot.docs.map((d) => d.data().name));
    };

    // Reset form
    const resetForm = () => {
        setDate("");
        setUserId("");
        setEmployee("");
        setClientName("");
        setCashPaid("");
        setPendingAmount("");
        setPendingDate("");
        setLocation("");
        setTotalAmount("");
        setModemType("");
    };

    // Auto calculate pending amount
    useEffect(() => {
        if (totalAmount && cashPaid) {
            const pending = Number(totalAmount) - Number(cashPaid);
            setPendingAmount(pending >= 0 ? pending : 0);
        }
    }, [totalAmount, cashPaid]);

    const handleSave = async () => {
        if (!date || !userId || !employee || !clientName) {
            alert("Please fill all required fields!");
            return;
        }

        const data = {
            date,
            userId,
            employee,
            clientName,
            totalAmount: Number(totalAmount),
            cashPaid: Number(cashPaid),
            pendingAmount: Number(pendingAmount),
            pendingDate: pendingAmount > 0 ? pendingDate : "",
            location,
            modemType,
            updatedAt: Timestamp.now(),
        };

        if (editingId) {
            await updateDoc(doc(db, "new_installations", editingId), data);
            alert("✅ Installation updated successfully!");
        } else {
            await addDoc(collection(db, "new_installations"), data);
            alert("✅ Installation saved successfully!");
        }

        resetForm();
        setShowForm(false);
        setEditingId(null);
        fetchInstallations();
    };

    const handleEdit = (item) => {
        setEditingId(item.id);
        setDate(item.date);
        setUserId(item.userId);
        setEmployee(item.employee);
        setClientName(item.clientName);
        setCashPaid(item.cashPaid);
        setPendingAmount(item.pendingAmount);
        setPendingDate(item.pendingDate);
        setLocation(item.location);
        setTotalAmount(item.totalAmount);
        setModemType(item.modemType || "");
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this record?")) return;
        await deleteDoc(doc(db, "new_installations", id));
        fetchInstallations();
    };

    const filteredInstallations = installations.filter((item) => {
        // ✅ Match search by client name OR user ID (e.g., H/M/O series)
        const matchesSearch =
            item.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.userId?.toLowerCase().includes(searchTerm.toLowerCase());

        // ✅ Match filter type (all, pending, company, self)
        const matchesFilter =
            filterType === "all"
                ? true
                : filterType === "pending"
                    ? Number(item.pendingAmount) > 0
                    : filterType === "company"
                        ? item.modemType === "Company"
                        : filterType === "self"
                            ? item.modemType === "Self"
                            : true;

        // ✅ Match specific date (only one date)
        const matchesDate = !filterDate || item.date === filterDate;

        // ✅ Final combined condition
        return matchesSearch && matchesFilter && matchesDate;
    });



    // ✅ Stats
    const totalConnections = installations.length;
    const totalAmt = installations.reduce(
        (sum, i) => sum + Number(i.totalAmount || 0),
        0
    );
    const pendingAmt = installations.reduce(
        (sum, i) => sum + Number(i.pendingAmount || 0),
        0
    );
    const companyModems = installations.filter((i) => i.modemType === "Company").length;
    const selfModems = installations.filter((i) => i.modemType === "Self").length;



    const handleDownloadInstallationPDF = async () => {
        try {
            if (!installations || installations.length === 0) {
                alert("No installations found to generate report.");
                return;
            }

            // ✅ Apply same filters used in UI (optional)
            const filtered = installations.filter((i) => {
                const matchesSearch =
                    i.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    i.userId?.toLowerCase().includes(searchTerm.toLowerCase());

                const matchesFilter =
                    filterType === "all"
                        ? true
                        : filterType === "pending"
                            ? Number(i.pendingAmount) > 0
                            : filterType === "company"
                                ? i.modemType === "Company"
                                : filterType === "self"
                                    ? i.modemType === "Self"
                                    : true;

                const matchesDate = !filterDate || i.date === filterDate;

                return matchesSearch && matchesFilter && matchesDate;
            });

            if (filtered.length === 0) {
                alert("No matching installations found for report.");
                return;
            }

            // ✅ Initialize jsPDF
            const doc = new jsPDF("p", "pt", "a4");

            // ✅ Header
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(30, 64, 175);
            doc.text("Mascot New Installation Report", 40, 50);

            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 40, 70);

            // ✅ Totals summary
            const totalAmount = filtered.reduce(
                (sum, i) => sum + (parseFloat(i.totalAmount) || 0),
                0
            );
            const totalPending = filtered.reduce(
                (sum, i) => sum + (parseFloat(i.pendingAmount) || 0),
                0
            );
            const totalCash = filtered.reduce(
                (sum, i) => sum + (parseFloat(i.cashPaid) || 0),
                0
            );

            const pageWidth = doc.internal.pageSize.getWidth();

            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(0, 102, 51);
            doc.text(
                `Total Amount: Rs. ${totalAmount.toLocaleString()}`,
                pageWidth - 250,
                50
            );
            doc.text(
                `Total Pending: Rs. ${totalPending.toLocaleString()}`,
                pageWidth - 250,
                65
            );
            doc.text(
                `Total Cash Paid: Rs. ${totalCash.toLocaleString()}`,
                pageWidth - 250,
                80
            );

            let startY = 100;

            // ✅ Group installations by installer (Install By)
            const grouped = filtered.reduce((acc, i) => {
                const emp = i.employee || "Unknown";
                if (!acc[emp]) acc[emp] = [];
                acc[emp].push(i);
                return acc;
            }, {});

            // ✅ Table per installer
            for (const [installer, group] of Object.entries(grouped)) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.setTextColor(0, 102, 51);
              
                startY += 10;

                autoTable(doc, {
                    head: [
                        [
                            "Date",
                            "intalled by",
                            "Client Name",
                            "User ID",
                            "Modem Type",
                            "Total (Rs.)",
                            "Cash (Rs.)",
                            "Pending (Rs.)",
                            "Location",
                        ],
                    ],
                    body: group.map((i) => [
                        i.date || "—",
                        i.employee || "—",
                        i.clientName || "—",
                        i.userId || "—",
                        i.modemType || "—",
                        i.totalAmount || "—",
                        i.cashPaid || "—",
                        i.pendingAmount || "—",
                        i.location || "—",
                    ]),
                    startY: startY + 10,
                    theme: "grid",
                    headStyles: {
                        fillColor: [66, 133, 244],
                        textColor: [255, 255, 255],
                        fontStyle: "bold",
                        fontSize: 10,
                    },
                    styles: {
                        fontSize: 10,
                        cellPadding: 5,
                        textColor: [50, 50, 50],
                    },
                    alternateRowStyles: { fillColor: [245, 247, 250] },
                });

                startY = doc.lastAutoTable.finalY + 25;
            }

            // ✅ Footer
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(
                "Generated by Mascot RMS System " + new Date().getFullYear(),
                40,
                doc.internal.pageSize.height - 20
            );

            // ✅ Save File
            doc.save("Mascot_NewInstallation_Report.pdf");
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            alert("Failed to generate report. Check console for details.");
        }
    };

    return (
        <div className="w-full mx-auto py-1 px-4 text-[12px] text-gray-800">
            <div className="max-w-9xl mx-auto">
                {/* Header */}
                <div className="mb-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">New Installations</h2>
                    </div>

                    <div className="flex items-center gap-3 mb-4"> 
                        {/* 💾 Download PDF Button */}
                        <button
                            onClick={handleDownloadInstallationPDF} // ✅ Make sure function name matches
                            className="flex items-center gap-1 bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white px-4 py-1.5 rounded-lg font-semibold shadow-md text-[12px]"
                        >
                            <Save className="w-3 h-3" /> Download PDF
                        </button>

                        {/* ➕ Add / Close Form Button */}
                        <button
                            onClick={() => {
                                if (role === "read") return;
                                if (!showForm) resetForm();
                                setEditingId(null);
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
                                    <Plus className="w-3 h-3" /> Add Installation
                                </>
                            )}
                        </button>

                       

                    </div>

                </div>

                {/* ✅ Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8 text-[12px]">
                    <StatCard title="Total Connections" value={totalConnections} icon={<Wifi className="w-4 h-4 text-blue-600" />} color="blue" />
                    <StatCard title="Total Amount" value={`Rs. ${totalAmt}`} icon={<DollarSign className="w-4 h-4 text-green-600" />} color="green" />
                    <StatCard title="Pending Amount" value={`Rs. ${pendingAmt}`} icon={<Server className="w-4 h-4 text-orange-600" />} color="orange" />
                    <StatCard title="Company Modems" value={companyModems} icon={<Building2 className="w-4 h-4 text-purple-600" />} color="purple" />
                    <StatCard title="Self Modems" value={selfModems} icon={<User className="w-4 h-4 text-pink-600" />} color="red" />
                </div>


                {/* Form */}
                {showForm && (
                    <div className="bg-white rounded-2xl p-6 mb-4 shadow-lg border border-blue-200 text-[12px] text-gray-800">
                        {/* 🔹 Calendar icon fix CSS */}
                        <style>
                            {`
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(50%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(85%);
          cursor: pointer;
        }
        input[type="date"] {
          color-scheme: light;
        }
      `}
                        </style>

                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-[12px] font-bold text-gray-900">
                                {editingId ? "✏️ Edit Installation" : "🛠️ Add New Installation"}
                            </h3>
                            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                            {/* ✅ Date input with gray calendar icon */}
                            <div className="relative">
                                <label className="block font-semibold text-gray-700 mb-1">Date *</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-700"
                                />
                                <Calendar className="absolute left-3 top-1/2 -translate-y-[10%] text-gray-400 w-4 h-4 pointer-events-none" />
                            </div>

                            <FormInput label="User ID *" value={userId} onChange={setUserId} placeholder="Enter User ID" />
                            <FormSelect label="Install By *" value={employee} onChange={setEmployee} options={employeeList} />
                            <FormInput label="Client Name *" value={clientName} onChange={setClientName} placeholder="Client Name" />

                            {/* Modem ownership */}
                            <div>
                                <label className="block font-semibold text-gray-700">Modem Type</label>
                                <select
                                    value={modemType}
                                    onChange={(e) => setModemType(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select Type</option>
                                    <option value="Company">Company</option>
                                    <option value="Self">Self</option>
                                </select>
                            </div>

                            <FormInput label="Total Amount" type="number" value={totalAmount} onChange={setTotalAmount} />
                            <FormInput label="Cash Paid" type="number" value={cashPaid} onChange={setCashPaid} />
                            <FormInput label="Pending Amount" type="number" value={pendingAmount} disabled />

                            {Number(pendingAmount) > 0 && (
                                <div className="relative">
                                    <label className="block font-semibold text-gray-700 mb-1">Pending Date</label>
                                    <input
                                        type="date"
                                        value={pendingDate}
                                        onChange={(e) => setPendingDate(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-700"
                                    />
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-[10%] text-gray-400 w-4 h-4 pointer-events-none" />
                                </div>
                            )}

                            <FormInput label="Location" value={location} onChange={setLocation} placeholder="Location" />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                            >
                                <Save className="w-4 h-4" /> {editingId ? "Update Installation" : "Save Installation"}
                            </button>
                            <button
                                onClick={() => setShowForm(false)}
                                className="px-6 py-2 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}


                {/* 🔍 Filters Section */}
                <div className="bg-white rounded-2xl p-6 mb-3 shadow-lg text-[12px] text-gray-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">

                        {/* 🔍 Search by Client or User ID */}
                        <div className="flex items-center gap-2 col-span-2">
                            <Search className="w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by client name or User ID (e.g., H, M, O series)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* 🧾 Filter Type */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-1">Filter By</label>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">All Connections</option>
                                <option value="pending">Pending</option>
                                <option value="company">Company Modem</option>
                                <option value="self">Self Modem</option>
                            </select>
                        </div>

                        {/* 📅 Filter by Date with Gray Calendar Icon */}
                        <div className="relative">
                            <label className="block text-gray-700 font-semibold mb-1">Filter by Date</label>
                            <input
                                type="date"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-gray-600 focus:ring-2 focus:ring-blue-500 appearance-none"
                                style={{
                                    backgroundImage:
                                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='gray' viewBox='0 0 24 24'%3E%3Cpath d='M7 10h5v5H7z'/%3E%3Cpath fill='none' d='M0 0h24v24H0z'/%3E%3Cpath d='M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14a2 2 0 0 0 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z'/%3E%3C/svg%3E\")",
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "right 0.75rem center",
                                    backgroundSize: "18px",
                                }}
                            />
                        </div>
                    </div>
                </div>



                {/* Table */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden text-[12px] text-gray-800">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[12px]">
                                <tr>
                                    <th className="px-6 py-3 text-left">Date</th>
                                    <th className="px-6 py-3 text-left">User ID</th>
                                    <th className="px-6 py-3 text-left">Client</th>
                                    <th className="px-6 py-3 text-left">Employee</th>
                                    <th className="px-6 py-3 text-left">Modem Type</th>
                                    <th className="px-6 py-3 text-right">Total</th>
                                    <th className="px-6 py-3 text-right">Cash</th>
                                    <th className="px-6 py-3 text-right">Pending</th>
                                    <th className="px-6 py-3 text-right">Pending Date</th>

                                    <th className="px-6 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-[12px]">
                                {filteredInstallations.length > 0 ? (
                                    filteredInstallations.map((c) => (
                                        <tr key={c.id} className="hover:bg-blue-50 transition-all duration-200">
                                            <td className="px-6 py-2">{c.date}</td>
                                            <td className="px-6 py-2 font-mono">{c.userId}</td>
                                            <td className="px-6 py-2 font-semibold text-gray-900">{c.clientName}</td>
                                            <td className="px-6 py-2">{c.employee}</td>
                                            <td className="px-6 py-2">{c.modemType || "-"}</td>
                                            <td className="px-6 py-2 text-right">{c.totalAmount}</td>
                                            <td className="px-6 py-2 text-right">{c.cashPaid}</td>
                                            <td className="px-6 py-2 text-right">{c.pendingAmount}</td>
                                            <td className="px-6 py-2 text-right">{c.pendingDate}</td>


                                            <td className="px-6 py-2 text-center">
                                                {role === "read" ? (
                                                    <div className="flex items-center justify-center gap-1 text-gray-400 cursor-not-allowed">
                                                        <Lock className="w-4 h-4" />
                                                        <span className="text-xs">Locked</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-center gap-2">
                                                        <button
                                                            onClick={() => handleEdit(c)}
                                                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(c.id)}
                                                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                                            No client installations found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-6 text-center text-[12px] text-gray-600">
                    Showing {filteredInstallations.length} of {installations.length} records
                </div>
            </div>
        </div>
    );
}

// 🔧 Reusable Components
function StatCard({ title, value, icon, color }) {
    return (
        <div className={`bg-white rounded-2xl p-6 shadow-lg border border-${color}-100`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[12px] font-medium text-gray-600">{title}</p>
                    <p className="text-[12px] font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`p-3 bg-${color}-100 rounded-xl`}>{icon}</div>
            </div>
        </div>
    );
}

function FormInput({ label, value, onChange, type = "text", placeholder, disabled }) {
    return (
        <div>
            <label className="block font-semibold text-gray-700">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className={`w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] ${disabled ? "bg-gray-100" : "focus:ring-2 focus:ring-blue-500"
                    }`}
            />
        </div>
    );
}

function FormSelect({ label, value, onChange, options = [] }) {
    return (
        <div>
            <label className="block font-semibold text-gray-700">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] focus:ring-2 focus:ring-blue-500"
            >
                <option value="">Select</option>
                {options.map((opt, i) => (
                    <option key={i} value={opt}>
                        {opt}
                    </option>
                ))}
            </select>
        </div>
    );
}
