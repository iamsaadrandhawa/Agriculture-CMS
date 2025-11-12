import { useEffect, useState } from "react";
import { Plus, Save, Search, Filter, X, Edit3, Trash2, Bike, Users, CreditCard, CheckCircle, XCircle, Home, Lock } from "lucide-react";
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    Timestamp,
    query,
    where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { getCurrentUser } from "../components/userUtils";


export default function BikeManager() {
    const [showForm, setShowForm] = useState(false);
    const [bikeNumber, setBikeNumber] = useState("");
    const [model, setModel] = useState("");
    const [price, setPrice] = useState("");
    const [fuelAverage, setFuelAverage] = useState("");
    const [kmDriven, setKmDriven] = useState("");
    const [ownershipType, setOwnershipType] = useState("Company");
    const [installments, setInstallments] = useState(false);
    const [totalValue, setTotalValue] = useState("");
    const [paidAmount, setPaidAmount] = useState("");
    const [remainingDue, setRemainingDue] = useState("");
    const [maintenanceAllowed, setMaintenanceAllowed] = useState(false);
    const [maxFuelLimit, setMaxFuelLimit] = useState("");
    const [condition, setCondition] = useState("Usable");
    const [allocatedEmployeeId, setAllocatedEmployeeId] = useState("");
    const [bikes, setBikes] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [ownershipFilter, setOwnershipFilter] = useState("all");
    const [allocationFilter, setAllocationFilter] = useState("all");
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


    const fetchBikes = async (uidParam) => {
        const uid = uidParam || (auth.currentUser && auth.currentUser.uid);
        if (!uid) return setBikes([]);
        try {
            const q = query(collection(db, "bikes"));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setBikes(data);
        } catch (err) {
            console.error("Error fetching bikes:", err);
        }
    };

    const fetchEmployees = async () => {
        try {
            const snapshot = await getDocs(collection(db, "employees"));
            const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setEmployees(data);
        } catch (err) {
            console.error("Error fetching employees:", err);
        }
    };

    useEffect(() => {
        const unsub = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
            if (user) {
                fetchBikes(user.uid);
                fetchEmployees();
            }
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setBikeNumber("");
        setModel("");
        setPrice("");
        setFuelAverage("");
        setKmDriven("");
        setOwnershipType("Company");
        setInstallments(false);
        setTotalValue("");
        setPaidAmount("");
        setRemainingDue("");
        setMaintenanceAllowed(false);
        setMaxFuelLimit("");
        setCondition("Usable");
        setAllocatedEmployeeId("");
    };

    const handleSave = async () => {
        if (!bikeNumber || !model || !price) {
            alert("Please fill required fields.");
            return;
        }
        if (!currentUser) {
            alert("User not logged in!");
            return;
        }

        setLoading(true);

        try {
            const selectedEmployee = employees.find(emp => emp.id === allocatedEmployeeId);

            const bikeData = {
                bikeNumber,
                model,
                price: Number(price),
                fuelAverage: fuelAverage ? Number(fuelAverage) : null,
                kmDriven: kmDriven ? Number(kmDriven) : null,
                ownershipType,
                installments:
                    ownershipType === "Employee (on Installments)"
                        ? { totalValue, paidAmount, remainingDue }
                        : null,
                maintenanceAllowed,
                maxFuelLimit: maxFuelLimit ? Number(maxFuelLimit) : null,
                condition,
                user_id: currentUser.uid,
                allocatedEmployeeId: allocatedEmployeeId || null,
                allocatedEmployeeName: selectedEmployee ? selectedEmployee.name : null,
                allocatedEmployeeDesignation: selectedEmployee ? selectedEmployee.designation : null,
                updatedAt: Timestamp.now(),
            };

            if (!editingId) {
                bikeData.createdAt = Timestamp.now();
            }

            if (editingId) {
                await updateDoc(doc(db, "bikes", editingId), bikeData);
                alert("✅ Bike updated successfully!");
                setEditingId(null);
            } else {
                await addDoc(collection(db, "bikes"), bikeData);
                alert("✅ Bike added successfully!");
            }

            fetchBikes(currentUser.uid);
            resetForm();
            setShowForm(false);
        } catch (err) {
            alert("Failed to save bike: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (bike) => {
        setEditingId(bike.id);
        setBikeNumber(bike.bikeNumber || "");
        setModel(bike.model || "");
        setPrice(bike.price != null ? String(bike.price) : "");
        setFuelAverage(bike.fuelAverage != null ? String(bike.fuelAverage) : "");
        setKmDriven(bike.kmDriven != null ? String(bike.kmDriven) : "");
        setOwnershipType(bike.ownershipType || "Company");
        setInstallments(bike.ownershipType === "Employee (on Installments)");
        setTotalValue(bike.installments?.totalValue || "");
        setPaidAmount(bike.installments?.paidAmount || "");
        setRemainingDue(bike.installments?.remainingDue || "");
        setMaintenanceAllowed(bike.maintenanceAllowed || false);
        setMaxFuelLimit(bike.maxFuelLimit || "");
        setCondition(bike.condition || "Usable");
        setAllocatedEmployeeId(bike.allocatedEmployeeId || "");
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this bike?")) return;
        setLoading(true);
        try {
            await deleteDoc(doc(db, "bikes", id));
            setBikes((prev) => prev.filter((b) => b.id !== id));
            alert("✅ Bike deleted");
        } catch (err) {
            alert("Failed to delete bike: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredBikes = bikes.filter((b) => {
        const matchesSearch =
            b.bikeNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.model?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesOwnership =
            ownershipFilter === "all" || b.ownershipType === ownershipFilter;

        const matchesAllocation =
            allocationFilter === "all" ||
            (allocationFilter === "allocated" && b.allocatedEmployeeId) ||
            (allocationFilter === "unallocated" && !b.allocatedEmployeeId);

        return matchesSearch && matchesOwnership && matchesAllocation;
    });

    const stats = {
        total: bikes.length,
        company: bikes.filter((b) => b.ownershipType === "Company").length,
        employee: bikes.filter((b) => b.ownershipType === "Employee").length,
        installments: bikes.filter((b) => b.ownershipType === "Employee (on Installments)").length,
    };

    return (
        <div className="w-full mx-auto py-3 px-4" style={{ fontSize: "12px" }}>
            <div className="max-w-9xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <Bike className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">Bike Management</h2>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => {
                                if (role === "read") return; // prevent click
                                resetForm();
                                setEditingId(null);
                                setShowForm(!showForm);
                            }}
                            disabled={role === "read"}
                            className={`flex items-center gap-1 px-4 py-1.5 rounded-lg font-semibold shadow-md text-white transition
    ${role === "read"
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : showForm
                                        ? "bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800"
                                        : "bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
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
                                    <Plus className="w-3 h-3" /> Add Bike
                                </>
                            )}
                        </button>

                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
                    {[
                        { title: "Total Bikes", value: stats.total, icon: <Bike className="w-5 h-5 text-blue-600" />, bg: "bg-blue-100" },
                        { title: "Company Bikes", value: stats.company, icon: <Home className="w-5 h-5 text-green-600" />, bg: "bg-green-100" },
                        { title: "Employee Bikes", value: stats.employee, icon: <Users className="w-5 h-5 text-yellow-600" />, bg: "bg-yellow-100" },
                        { title: "Installments", value: stats.installments, icon: <CreditCard className="w-5 h-5 text-orange-600" />, bg: "bg-orange-100" },
                        { title: "Allocated", value: bikes.filter(b => b.allocatedEmployeeId).length, icon: <CheckCircle className="w-5 h-5 text-purple-600" />, bg: "bg-purple-100" },
                        { title: "Unallocated", value: bikes.filter(b => !b.allocatedEmployeeId).length, icon: <XCircle className="w-5 h-5 text-red-600" />, bg: "bg-red-100" },
                    ].map((stat, idx) => (
                        <div key={idx} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600">{stat.title}</p>
                                    <p className="font-bold text-gray-900 mt-1">{stat.value}</p>
                                </div>
                                <div className={`p-3 rounded-xl ${stat.bg}`}>
                                    {stat.icon}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters and Search */}
                <div className="bg-white rounded-2xl p-5 mb-3 shadow-lg text-[12px] text-gray-800">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        {/* Search */}  
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search bikes by number or model..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                            />
                        </div>

                        {/* Ownership Filter */}
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-3 text-gray-400" />
                            <select
                                value={ownershipFilter}
                                onChange={(e) => setOwnershipFilter(e.target.value)}
                                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                            >
                                <option value="all">All Ownership</option>
                                <option value="Company">Company</option>
                                <option value="Employee">Employee</option>
                                <option value="Employee (on Installments)">Installments</option>
                            </select>
                        </div>

                        {/* Allocation Filter */}
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select
                                value={allocationFilter}
                                onChange={(e) => setAllocationFilter(e.target.value)}
                                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                            >
                                <option value="all">All</option>
                                <option value="allocated">Allocated</option>
                                <option value="unallocated">Unallocated</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Add/Edit Form */}
                {showForm && (
                    <div className="bg-white rounded-2xl p-6 mb-4 shadow-lg border border-blue-200 mt-4">
                        <h3 className="font-bold text-gray-900 mb-4">{editingId ? "✏️ Edit Bike" : "🚲 Add New Bike"}</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                            {/* Bike Number */}
                            <div>
                                <label className="block text-gray-800">Bike Number <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={bikeNumber}
                                    onChange={(e) => setBikeNumber(e.target.value)}
                                    placeholder="Enter bike number"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                                />
                            </div>
                            {/* Model */}
                            <div>
                                <label className="block text-gray-800">Model <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    placeholder="Enter bike model"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                                />
                            </div>
                            {/* Price */}
                            <div>
                                <label className="block text-gray-800">Price <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="Enter price"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                                />
                            </div>
                            {/* Fuel Average */}
                            <div>
                                <label className="block text-gray-800">Fuel Average</label>
                                <input
                                    type="number"
                                    value={fuelAverage}
                                    onChange={(e) => setFuelAverage(e.target.value)}
                                    placeholder="Km/L"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                            {/* KM Driven */}
                            <div>
                                <label className="block text-gray-800">KM Driven</label>
                                <input
                                    type="number"
                                    value={kmDriven}
                                    onChange={(e) => setKmDriven(e.target.value)}
                                    placeholder="Km Driven"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                                />
                            </div>
                            {/* Ownership Type */}
                            <div>
                                <label className="block text-gray-800">Ownership Type</label>
                                <select
                                    value={ownershipType}
                                    onChange={(e) => {
                                        setOwnershipType(e.target.value);
                                        setInstallments(e.target.value === "Employee (on Installments)");
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                                >
                                    <option value="Company">Company</option>
                                    <option value="Employee">Employee</option>
                                    <option value="Employee (on Installments)">Employee (on Installments)</option>
                                </select>
                            </div>
                            {/* Maintenance Allowed */}
                            <div className="flex items-center gap-2 mt-6">
                                <input
                                    type="checkbox"
                                    checked={maintenanceAllowed}
                                    onChange={(e) => setMaintenanceAllowed(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                <label className="text-gray-800">Maintenance Allowed</label>
                            </div>
                            {/* Condition */}
                            <div>
                                <label className="block text-gray-800">Condition</label>
                                <select
                                    value={condition}
                                    onChange={(e) => setCondition(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                                >
                                    <option value="Usable">Usable</option>
                                    <option value="Not Usable">Not Usable</option>
                                </select>
                            </div>
                        </div>

                        {/* Allocated Employee */}
                        <div className="mb-4">
                            <label className="block text-gray-800">Allocate Employee</label>
                            <select
                                value={allocatedEmployeeId}
                                onChange={(e) => setAllocatedEmployeeId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                            >
                                <option value="">Select Employee</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name} - {emp.designation}</option>
                                ))}
                            </select>
                        </div>

                        {/* Installment Section */}
                        {installments && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                <div>
                                    <label className="block text-gray-800">Total Value</label>
                                    <input
                                        type="number"
                                        value={totalValue}
                                        onChange={(e) => setTotalValue(e.target.value)}
                                        placeholder="Total Value"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-800">Paid Amount</label>
                                    <input
                                        type="number"
                                        value={paidAmount}
                                        onChange={(e) => setPaidAmount(e.target.value)}
                                        placeholder="Paid Amount"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-800">Remaining Due</label>
                                    <input
                                        type="number"
                                        value={remainingDue}
                                        onChange={(e) => setRemainingDue(e.target.value)}
                                        placeholder="Remaining Due"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-semibold"
                                disabled={loading}
                            >
                                <Save className="w-4 h-4" /> {editingId ? "Update Bike" : "Save Bike"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Bike Table */}
                <div className="overflow-x-auto mt-6 rounded-2xl border border-gray-200 shadow-lg">
                    <table className="w-full text-left text-gray-700 rounded-2xl overflow-hidden" style={{ fontSize: "12px" }}>
                        <thead className="bg-blue-600 text-white">
                            <tr>
                                <th className="px-4 py-2 border-b border-gray-300 first:rounded-tl-2xl last:rounded-tr-2xl">#</th>
                                <th className="px-4 py-2 border-b border-gray-300">Bike Number</th>
                                <th className="px-4 py-2 border-b border-gray-300">Model</th>
                                <th className="px-4 py-2 border-b border-gray-300">Ownership</th>
                                <th className="px-4 py-2 border-b border-gray-300">Condition</th>
                                <th className="px-4 py-2 border-b border-gray-300">Allocated To</th>
                                <th className="px-4 py-2 border-b border-gray-300">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredBikes.map((bike, idx) => (
                                <tr key={bike.id} className="hover:bg-blue-50 transition-all">
                                    <td className="px-4 py-2 border-b border-gray-200">{idx + 1}</td>
                                    <td className="px-4 py-2 border-b border-gray-200">{bike.bikeNumber}</td>
                                    <td className="px-4 py-2 border-b border-gray-200">{bike.model}</td>
                                    <td className="px-4 py-2 border-b border-gray-200">{bike.ownershipType}</td>
                                    <td className="px-4 py-2 border-b border-gray-200">{bike.condition}</td>
                                    <td className="px-4 py-2 border-b border-gray-200">{bike.allocatedEmployeeName || "—"}</td>
                                    <td className="px-4 py-2 border-b border-gray-200 flex gap-2 justify-center">
                                        {role === "read" ? (
                                            <div className="flex items-center gap-1 text-gray-400">
                                                <Lock className="w-4 h-4" />
                                                <span className="text-xs">Locked</span>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleEdit(bike)}
                                                    className="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-full"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(bike.id)}
                                                    className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-full"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </td>

                                </tr>
                            ))}
                            {filteredBikes.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-4 text-center text-gray-500">
                                        No bikes found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    
                </div>
                 <div className="mt-6 text-center text-[12px] text-gray-600">
                    Showing {filteredBikes.length} of {bikes.length} Bikes.
                </div>
            </div>
        </div>
    );
}
