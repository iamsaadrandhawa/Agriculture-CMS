import { useEffect, useState } from "react";
import { Plus, Save, Search, Filter, X, Edit3, Trash2, Tractor, Users, CreditCard, CheckCircle, XCircle, Home, Lock, MapPin } from "lucide-react";
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

export default function VehicalManager() {
    const [showForm, setShowForm] = useState(false);
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [vehicleType, setVehicleType] = useState("Tractor");
    const [model, setModel] = useState("");
    const [brand, setBrand] = useState("");
    const [price, setPrice] = useState("");
    const [fuelType, setFuelType] = useState("Diesel");
    const [kmDriven, setKmDriven] = useState("");
    const [ownershipType, setOwnershipType] = useState("Company");
    const [installments, setInstallments] = useState(false);
    const [totalValue, setTotalValue] = useState("");
    const [paidAmount, setPaidAmount] = useState("");
    const [remainingDue, setRemainingDue] = useState("");
    const [condition, setCondition] = useState("Operational");
    const [allocatedEmployeeId, setAllocatedEmployeeId] = useState("");
    const [allocatedLocationId, setAllocatedLocationId] = useState("");
    const [vehicles, setVehicles] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [ownershipFilter, setOwnershipFilter] = useState("all");
    const [allocationFilter, setAllocationFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [role, setRole] = useState(null);

    // Agricultural vehicle types
    const vehicleTypes = [
        "Tractor",
        "Harvester",
        "Cultivator",
        "Seeder",
        "Sprayer",
        "Plough",
        "Trailer",
        "Irrigation System",
        "Truck",
        "Other"
    ];

    // Fuel types
    const fuelTypes = [
        "Diesel",
        "Petrol",
        "Electric",
        "Bio-fuel",
        "CNG"
    ];

    // Conditions
    const conditions = [
        "Operational",
        "Under Maintenance",
        "Needs Repair",
        "Out of Service"
    ];

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

    const fetchVehicles = async (uidParam) => {
        const uid = uidParam || (auth.currentUser && auth.currentUser.uid);
        if (!uid) return setVehicles([]);
        try {
            const q = query(collection(db, "agriculture_vehicles"));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setVehicles(data);
        } catch (err) {
            console.error("Error fetching vehicles:", err);
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

    const fetchLocations = async () => {
        try {
            // Fetch ledger codes with subtype "location"
            const q = query(
                collection(db, "ledger_codes"),
                where("category", "==", "location")
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map((doc) => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            setLocations(data);
        } catch (err) {
            console.error("Error fetching locations:", err);
        }
    };

    useEffect(() => {
        const unsub = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
            if (user) {
                fetchVehicles(user.uid);
                fetchEmployees();
                fetchLocations();
            }
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setVehicleNumber("");
        setVehicleType("Tractor");
        setModel("");
        setBrand("");
        setPrice("");
        setFuelType("Diesel");
        setKmDriven("");
        setOwnershipType("Company");
        setInstallments(false);
        setTotalValue("");
        setPaidAmount("");
        setRemainingDue("");
        setCondition("Operational");
        setAllocatedEmployeeId("");
        setAllocatedLocationId("");
    };

    const handleSave = async () => {
        if (!vehicleNumber || !vehicleType || !model || !price) {
            alert("Please fill required fields (Vehicle Number, Type, Model, and Price).");
            return;
        }
        if (!currentUser) {
            alert("User not logged in!");
            return;
        }

        setLoading(true);

        try {
            const selectedEmployee = employees.find(emp => emp.id === allocatedEmployeeId);
            const selectedLocation = locations.find(loc => loc.id === allocatedLocationId);

            const vehicleData = {
                vehicleNumber,
                vehicleType,
                model,
                brand: brand || "",
                price: Number(price),
                fuelType,
                kmDriven: kmDriven ? Number(kmDriven) : null,
                ownershipType,
                installments:
                    ownershipType === "Employee (on Installments)"
                        ? { totalValue, paidAmount, remainingDue }
                        : null,
                condition,
                user_id: currentUser.uid,
                allocatedEmployeeId: allocatedEmployeeId || null,
                allocatedEmployeeName: selectedEmployee ? selectedEmployee.name : null,
                allocatedEmployeeDesignation: selectedEmployee ? selectedEmployee.designation : null,
                allocatedLocationId: allocatedLocationId || null,
                allocatedLocationName: selectedLocation ? selectedLocation.name || selectedLocation.code : null,
                updatedAt: Timestamp.now(),
            };

            if (!editingId) {
                vehicleData.createdAt = Timestamp.now();
            }

            if (editingId) {
                await updateDoc(doc(db, "agriculture_vehicles", editingId), vehicleData);
                alert("✅ Vehicle updated successfully!");
                setEditingId(null);
            } else {
                await addDoc(collection(db, "agriculture_vehicles"), vehicleData);
                alert("✅ Vehicle added successfully!");
            }

            fetchVehicles(currentUser.uid);
            resetForm();
            setShowForm(false);
        } catch (err) {
            alert("Failed to save vehicle: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (vehicle) => {
        setEditingId(vehicle.id);
        setVehicleNumber(vehicle.vehicleNumber || "");
        setVehicleType(vehicle.vehicleType || "Tractor");
        setModel(vehicle.model || "");
        setBrand(vehicle.brand || "");
        setPrice(vehicle.price != null ? String(vehicle.price) : "");
        setFuelType(vehicle.fuelType || "Diesel");
        setKmDriven(vehicle.kmDriven != null ? String(vehicle.kmDriven) : "");
        setOwnershipType(vehicle.ownershipType || "Company");
        setInstallments(vehicle.ownershipType === "Employee (on Installments)");
        setTotalValue(vehicle.installments?.totalValue || "");
        setPaidAmount(vehicle.installments?.paidAmount || "");
        setRemainingDue(vehicle.installments?.remainingDue || "");
        setCondition(vehicle.condition || "Operational");
        setAllocatedEmployeeId(vehicle.allocatedEmployeeId || "");
        setAllocatedLocationId(vehicle.allocatedLocationId || "");
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this vehicle?")) return;
        setLoading(true);
        try {
            await deleteDoc(doc(db, "agriculture_vehicles", id));
            setVehicles((prev) => prev.filter((v) => v.id !== id));
            alert("✅ Vehicle deleted");
        } catch (err) {
            alert("Failed to delete vehicle: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredVehicles = vehicles.filter((v) => {
        const matchesSearch =
            v.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.brand?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesOwnership =
            ownershipFilter === "all" || v.ownershipType === ownershipFilter;

        const matchesAllocation =
            allocationFilter === "all" ||
            (allocationFilter === "allocated" && (v.allocatedEmployeeId || v.allocatedLocationId)) ||
            (allocationFilter === "unallocated" && !v.allocatedEmployeeId && !v.allocatedLocationId);

        const matchesType =
            typeFilter === "all" || v.vehicleType === typeFilter;

        return matchesSearch && matchesOwnership && matchesAllocation && matchesType;
    });

    const stats = {
        total: vehicles.length,
        company: vehicles.filter((v) => v.ownershipType === "Company").length,
        employee: vehicles.filter((v) => v.ownershipType === "Employee").length,
        installments: vehicles.filter((v) => v.ownershipType === "Employee (on Installments)").length,
        operational: vehicles.filter((v) => v.condition === "Operational").length,
        maintenance: vehicles.filter((v) => v.condition === "Under Maintenance").length,
        allocated: vehicles.filter((v) => v.allocatedEmployeeId || v.allocatedLocationId).length,
    };

    return (
        <div className="w-full mx-auto py-3 px-4" style={{ fontSize: "12px" }}>
            <div className="max-w-9xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <Tractor className="w-5 h-5 text-green-600" />
                        <h2 className="text-lg font-bold text-gray-900">Agriculture Vehicles Management</h2>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => {
                                if (role === "read") return;
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
                                        : "bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800"
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
                                    <Plus className="w-3 h-3" /> Add Vehicle
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
                    {[
                        { title: "Total Vehicles", value: stats.total, icon: <Tractor className="w-5 h-5 text-green-600" />, bg: "bg-green-100" },
                        { title: "Company Vehicles", value: stats.company, icon: <Home className="w-5 h-5 text-blue-600" />, bg: "bg-blue-100" },
                        { title: "Employee Vehicles", value: stats.employee, icon: <Users className="w-5 h-5 text-yellow-600" />, bg: "bg-yellow-100" },
                        { title: "Installments", value: stats.installments, icon: <CreditCard className="w-5 h-5 text-orange-600" />, bg: "bg-orange-100" },
                        { title: "Operational", value: stats.operational, icon: <CheckCircle className="w-5 h-5 text-purple-600" />, bg: "bg-purple-100" },
                        { title: "Allocated", value: stats.allocated, icon: <MapPin className="w-5 h-5 text-indigo-600" />, bg: "bg-indigo-100" },
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
                                placeholder="Search vehicles by number, model or brand..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                            />
                        </div>

                        {/* Vehicle Type Filter */}
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-3 text-gray-400" />
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                            >
                                <option value="all">All Types</option>
                                {vehicleTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        {/* Ownership Filter */}
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-3 text-gray-400" />
                            <select
                                value={ownershipFilter}
                                onChange={(e) => setOwnershipFilter(e.target.value)}
                                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
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
                    <div className="bg-white rounded-2xl p-6 mb-4 shadow-lg border border-green-200 mt-4">
                        <h3 className="font-bold text-gray-900 mb-4">{editingId ? "✏️ Edit Vehicle" : "🚜 Add New Vehicle"}</h3>
                        
                        {/* Basic Information */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                            {/* Vehicle Number */}
                            <div>
                                <label className="block text-gray-800">Vehicle Number <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={vehicleNumber}
                                    onChange={(e) => setVehicleNumber(e.target.value)}
                                    placeholder="Enter vehicle number"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                                />
                            </div>
                            {/* Vehicle Type */}
                            <div>
                                <label className="block text-gray-800">Vehicle Type <span className="text-red-500">*</span></label>
                                <select
                                    value={vehicleType}
                                    onChange={(e) => setVehicleType(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                                >
                                    {vehicleTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Model */}
                            <div>
                                <label className="block text-gray-800">Model <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    placeholder="Enter vehicle model"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                                />
                            </div>
                            {/* Brand */}
                            <div>
                                <label className="block text-gray-800">Brand</label>
                                <input
                                    type="text"
                                    value={brand}
                                    onChange={(e) => setBrand(e.target.value)}
                                    placeholder="Enter brand name"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                                />
                            </div>
                        </div>

                        {/* Technical Specifications */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                            {/* Price */}
                            <div>
                                <label className="block text-gray-800">Price <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="Enter price"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                                />
                            </div>
                            {/* Fuel Type */}
                            <div>
                                <label className="block text-gray-800">Fuel Type</label>
                                <select
                                    value={fuelType}
                                    onChange={(e) => setFuelType(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                                >
                                    {fuelTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            {/* KM Driven */}
                            <div>
                                <label className="block text-gray-800">KM Driven</label>
                                <input
                                    type="number"
                                    value={kmDriven}
                                    onChange={(e) => setKmDriven(e.target.value)}
                                    placeholder="Km Driven"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                                >
                                    <option value="Company">Company</option>
                                    <option value="Employee">Employee</option>
                                    <option value="Employee (on Installments)">Employee (on Installments)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                            {/* Condition */}
                            <div>
                                <label className="block text-gray-800">Condition</label>
                                <select
                                    value={condition}
                                    onChange={(e) => setCondition(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                                >
                                    {conditions.map(cond => (
                                        <option key={cond} value={cond}>{cond}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Allocation Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Allocated Employee */}
                            <div>
                                <label className="block text-gray-800">Allocate to Employee</label>
                                <select
                                    value={allocatedEmployeeId}
                                    onChange={(e) => setAllocatedEmployeeId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} - {emp.designation}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Allocated Location */}
                            <div>
                                <label className="block text-gray-800">Allocate to Location</label>
                                <select
                                    value={allocatedLocationId}
                                    onChange={(e) => setAllocatedLocationId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                                >
                                    <option value="">Select Location</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>
                                            {loc.name || loc.code} {loc.description ? `- ${loc.description}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
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
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-800">Paid Amount</label>
                                    <input
                                        type="number"
                                        value={paidAmount}
                                        onChange={(e) => setPaidAmount(e.target.value)}
                                        placeholder="Paid Amount"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-800">Remaining Due</label>
                                    <input
                                        type="number"
                                        value={remainingDue}
                                        onChange={(e) => setRemainingDue(e.target.value)}
                                        placeholder="Remaining Due"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 bg-gray-200 text-gray-700 text-[12px] rounded-lg hover:bg-gray-300 transition"
                                disabled={loading}
                            >
                                <Save className="w-4 h-4" /> {editingId ? "Update Vehicle" : "Save Vehicle"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Vehicles Table */}
                <div className="overflow-x-auto mt-6 rounded-2xl border border-gray-200 shadow-lg">
                    <table className="w-full text-left text-gray-700 rounded-2xl overflow-hidden" style={{ fontSize: "12px" }}>
                        <thead className="bg-green-600 text-white">
                            <tr>
                                <th className="px-4 py-2 border-b border-gray-300 first:rounded-tl-2xl last:rounded-tr-2xl">#</th>
                                <th className="px-4 py-2 border-b border-gray-300">Vehicle Number</th>
                                <th className="px-4 py-2 border-b border-gray-300">Type</th>
                                <th className="px-4 py-2 border-b border-gray-300">Model</th>
                                <th className="px-4 py-2 border-b border-gray-300">Brand</th>
                                <th className="px-4 py-2 border-b border-gray-300">Ownership</th>
                                <th className="px-4 py-2 border-b border-gray-300">Condition</th>
                                <th className="px-4 py-2 border-b border-gray-300">Allocated To</th>
                                <th className="px-4 py-2 border-b border-gray-300">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVehicles.map((vehicle, idx) => (
                                <tr key={vehicle.id} className="hover:bg-green-50 transition-all">
                                    <td className="px-4 py-2 border-b border-gray-200">{idx + 1}</td>
                                    <td className="px-4 py-2 border-b border-gray-200 font-semibold">{vehicle.vehicleNumber}</td>
                                    <td className="px-4 py-2 border-b border-gray-200">{vehicle.vehicleType}</td>
                                    <td className="px-4 py-2 border-b border-gray-200">{vehicle.model}</td>
                                    <td className="px-4 py-2 border-b border-gray-200">{vehicle.brand || "—"}</td>
                                    <td className="px-4 py-2 border-b border-gray-200">{vehicle.ownershipType}</td>
                                    <td className="px-4 py-2 border-b border-gray-200">
                                        <span className={`px-2 py-1 rounded-full text-xs ${
                                            vehicle.condition === "Operational" ? "bg-green-100 text-green-800" :
                                            vehicle.condition === "Under Maintenance" ? "bg-yellow-100 text-yellow-800" :
                                            vehicle.condition === "Needs Repair" ? "bg-orange-100 text-orange-800" :
                                            "bg-red-100 text-red-800"
                                        }`}>
                                            {vehicle.condition}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 border-b border-gray-200">
                                        <div className="flex flex-col gap-1">
                                            {vehicle.allocatedEmployeeName && (
                                                <span className="text-blue-600 text-xs">
                                                    👤 {vehicle.allocatedEmployeeName}
                                                </span>
                                            )}
                                            {vehicle.allocatedLocationName && (
                                                <span className="text-green-600 text-xs">
                                                    📍 {vehicle.allocatedLocationName}
                                                </span>
                                            )}
                                            {!vehicle.allocatedEmployeeName && !vehicle.allocatedLocationName && (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 border-b border-gray-200 flex gap-2 justify-center">
                                        {role === "read" ? (
                                            <div className="flex items-center gap-1 text-gray-400">
                                                <Lock className="w-4 h-4" />
                                                <span className="text-xs">Locked</span>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleEdit(vehicle)}
                                                    className="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-full"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(vehicle.id)}
                                                    className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-full"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredVehicles.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-4 py-4 text-center text-gray-500">
                                        No vehicles found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mt-6 text-center text-[12px] text-gray-600">
                    Showing {filteredVehicles.length} of {vehicles.length} Vehicles.
                </div>
            </div>
        </div>
    );
}