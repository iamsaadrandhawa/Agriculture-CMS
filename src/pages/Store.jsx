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
    Package,
    Plus,
    X,
    Save,
    Lock,
    Edit3,
    Trash2,
    Search,
    TrendingUp,
    TrendingDown,
    Warehouse,
    MapPin,
    Scale,
    Truck,
    Calendar,
    Download,
    BarChart3
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AgriStore() {
    const [role, setRole] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [products, setProducts] = useState([]);
    const [locations, setLocations] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [filterProduct, setFilterProduct] = useState("all");
    const [filterLocation, setFilterLocation] = useState("all");
    const [filterDate, setFilterDate] = useState("");

    // Form fields
    const [date, setDate] = useState("");
    const [transactionType, setTransactionType] = useState("stock_in");
    const [productName, setProductName] = useState("");
    const [quantity, setQuantity] = useState("");
    const [unit, setUnit] = useState("kg");
    const [rate, setRate] = useState("");
    const [location, setLocation] = useState("");
    const [landArea, setLandArea] = useState("");
    const [remarks, setRemarks] = useState("");
    const [supplier, setSupplier] = useState("");

    useEffect(() => {
        const fetchUserRole = async () => {
            const user = await getCurrentUser();
            if (user?.role) setRole(user.role);
        };
        fetchUserRole();
        fetchTransactions();
        fetchProducts();
        fetchLocations();
    }, []);

    // Fetch transactions
    const fetchTransactions = async () => {
        const querySnapshot = await getDocs(collection(db, "agristore_transactions"));
        const list = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        setTransactions(list.sort((a, b) => new Date(b.date) - new Date(a.date)));
    };

    // Fetch unique products
    const fetchProducts = async () => {
        const querySnapshot = await getDocs(collection(db, "agristore_products"));
        const productList = querySnapshot.docs.map((d) => d.data().name);
        setProducts([...new Set(productList)]);
    };

    // Fetch unique locations
    const fetchLocations = async () => {
        const querySnapshot = await getDocs(collection(db, "agristore_locations"));
        const locationList = querySnapshot.docs.map((d) => d.data().name);
        setLocations([...new Set(locationList)]);
    };

    // Reset form
    const resetForm = () => {
        setDate("");
        setTransactionType("stock_in");
        setProductName("");
        setQuantity("");
        setUnit("kg");
        setRate("");
        setLocation("");
        setLandArea("");
        setRemarks("");
        setSupplier("");
    };

    const handleSave = async () => {
        if (!date || !productName || !quantity || !rate) {
            alert("Please fill all required fields!");
            return;
        }

        const data = {
            date,
            transactionType,
            productName,
            quantity: Number(quantity),
            unit,
            rate: Number(rate),
            totalAmount: Number(quantity) * Number(rate),
            location: transactionType === "stock_out" ? location : "",
            landArea: transactionType === "stock_out" ? landArea : "",
            remarks,
            supplier: transactionType === "stock_in" ? supplier : "",
            updatedAt: Timestamp.now(),
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, "agristore_transactions", editingId), data);
                alert("✅ Transaction updated successfully!");
            } else {
                await addDoc(collection(db, "agristore_transactions"), data);
                alert("✅ Transaction saved successfully!");
            }

            resetForm();
            setShowForm(false);
            setEditingId(null);
            fetchTransactions();
            fetchProducts();
            fetchLocations();
        } catch (error) {
            console.error("Error saving transaction:", error);
            alert("❌ Failed to save transaction!");
        }
    };

    const handleEdit = (item) => {
        setEditingId(item.id);
        setDate(item.date);
        setTransactionType(item.transactionType);
        setProductName(item.productName);
        setQuantity(item.quantity);
        setUnit(item.unit);
        setRate(item.rate);
        setLocation(item.location || "");
        setLandArea(item.landArea || "");
        setRemarks(item.remarks || "");
        setSupplier(item.supplier || "");
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this transaction?")) return;
        await deleteDoc(doc(db, "agristore_transactions", id));
        fetchTransactions();
    };

    // Filter transactions
    const filteredTransactions = transactions.filter((item) => {
        const matchesSearch = 
            item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.remarks?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.supplier?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter = 
            filterType === "all" ? true : item.transactionType === filterType;

        const matchesProduct = 
            filterProduct === "all" ? true : item.productName === filterProduct;

        const matchesLocation = 
            filterLocation === "all" ? true : item.location === filterLocation;

        const matchesDate = !filterDate || item.date === filterDate;

        return matchesSearch && matchesFilter && matchesProduct && matchesLocation && matchesDate;
    });

    // Calculate stats
    const totalStockIn = transactions
        .filter(t => t.transactionType === "stock_in")
        .reduce((sum, t) => sum + Number(t.quantity || 0), 0);

    const totalStockOut = transactions
        .filter(t => t.transactionType === "stock_out")
        .reduce((sum, t) => sum + Number(t.quantity || 0), 0);

    const currentStock = totalStockIn - totalStockOut;

    const totalValue = transactions
        .filter(t => t.transactionType === "stock_in")
        .reduce((sum, t) => sum + Number(t.totalAmount || 0), 0);

    const uniqueProducts = [...new Set(transactions.map(t => t.productName))].length;

    // Generate PDF Report
    const handleDownloadStorePDF = async () => {
        try {
            if (!transactions || transactions.length === 0) {
                alert("No transactions found to generate report.");
                return;
            }

            const filtered = filteredTransactions;

            if (filtered.length === 0) {
                alert("No matching transactions found for report.");
                return;
            }

            const doc = new jsPDF("p", "pt", "a4");

            // Header
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(34, 139, 34);
            doc.text("AgriStore Inventory Report", 40, 50);

            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 40, 70);

            // Summary
            const pageWidth = doc.internal.pageSize.getWidth();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(0, 102, 51);
            
            doc.text(`Current Stock: ${currentStock} kg`, pageWidth - 200, 50);
            doc.text(`Total Products: ${uniqueProducts}`, pageWidth - 200, 65);
            doc.text(`Inventory Value: Rs. ${totalValue.toLocaleString()}`, pageWidth - 200, 80);

            let startY = 100;

            // Group by product
            const grouped = filtered.reduce((acc, t) => {
                const product = t.productName || "Unknown";
                if (!acc[product]) acc[product] = [];
                acc[product].push(t);
                return acc;
            }, {});

            // Table per product
            for (const [product, group] of Object.entries(grouped)) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(12);
                doc.setTextColor(34, 139, 34);
                doc.text(`Product: ${product}`, 40, startY + 20);

                autoTable(doc, {
                    head: [[
                        "Date",
                        "Type",
                        "Quantity",
                        "Rate (Rs.)",
                        "Amount (Rs.)",
                        "Location",
                        "Land Area",
                        "Remarks"
                    ]],
                    body: group.map((t) => [
                        t.date || "—",
                        t.transactionType === "stock_in" ? "Stock In" : "Stock Out",
                        `${t.quantity} ${t.unit}`,
                        t.rate || "—",
                        t.totalAmount || "—",
                        t.location || "—",
                        t.landArea || "—",
                        t.remarks || "—"
                    ]),
                    startY: startY + 30,
                    theme: "grid",
                    headStyles: {
                        fillColor: [34, 139, 34],
                        textColor: [255, 255, 255],
                        fontStyle: "bold",
                        fontSize: 9,
                    },
                    styles: {
                        fontSize: 9,
                        cellPadding: 4,
                        textColor: [50, 50, 50],
                    },
                    alternateRowStyles: { fillColor: [245, 247, 250] },
                });

                startY = doc.lastAutoTable.finalY + 20;
            }

            // Footer
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(
                "Generated by AgriStore Management System " + new Date().getFullYear(),
                40,
                doc.internal.pageSize.height - 20
            );

            doc.save("AgriStore_Inventory_Report.pdf");
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
                        <Package className="w-5 h-5 text-green-600" />
                        <h2 className="text-lg font-bold text-gray-900">AgriStore Management</h2>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                        {/* 📊 Download PDF Button */}
                        <button
                            onClick={handleDownloadStorePDF}
                            className="flex items-center gap-1 bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900 text-white px-4 py-1.5 rounded-lg font-semibold shadow-md text-[12px]"
                        >
                            <Download className="w-3 h-3" /> Download Report
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
                                        : "bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white"
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
                                    <Plus className="w-3 h-3" /> New Transaction
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* ✅ Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 text-[12px]">
                    <StatCard 
                        title="Current Stock" 
                        value={`${currentStock} kg`} 
                        icon={<Warehouse className="w-4 h-4 text-blue-600" />} 
                        color="blue" 
                    />
                    <StatCard 
                        title="Total Products" 
                        value={uniqueProducts} 
                        icon={<Package className="w-4 h-4 text-purple-600" />} 
                        color="purple" 
                    />
                    <StatCard 
                        title="Inventory Value" 
                        value={`Rs. ${totalValue.toLocaleString()}`} 
                        icon={<TrendingUp className="w-4 h-4 text-green-600" />} 
                        color="green" 
                    />
                    <StatCard 
                        title="Stock Movements" 
                        value={transactions.length} 
                        icon={<BarChart3 className="w-4 h-4 text-orange-600" />} 
                        color="orange" 
                    />
                </div>

                {/* Form */}
                {showForm && (
                    <div className="bg-white rounded-2xl p-6 mb-4 shadow-lg border border-green-200 text-[12px] text-gray-800">
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
                                {editingId ? "✏️ Edit Transaction" : "🛒 New Stock Transaction"}
                            </h3>
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                            {/* Transaction Type */}
                            <div>
                                <label className="block font-semibold text-gray-700 mb-1">Transaction Type *</label>
                                <select
                                    value={transactionType}
                                    onChange={(e) => setTransactionType(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                                >
                                    <option value="stock_in">📥 Stock In (Purchase)</option>
                                    <option value="stock_out">📤 Stock Out (Issue)</option>
                                </select>
                            </div>

                            {/* Date */}
                            <div className="relative">
                                <label className="block font-semibold text-gray-700 mb-1">Date *</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 text-gray-700"
                                />
                                <Calendar className="absolute left-3 top-1/2 -translate-y-[10%] text-gray-400 w-4 h-4 pointer-events-none" />
                            </div>

                            {/* Product Name */}
                            <div>
                                <label className="block font-semibold text-gray-700 mb-1">Product Name *</label>
                                <input
                                    type="text"
                                    value={productName}
                                    onChange={(e) => setProductName(e.target.value)}
                                    placeholder="e.g., Urea, DAP, Pesticide"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                                />
                            </div>

                            {/* Quantity & Unit */}
                            <div>
                                <label className="block font-semibold text-gray-700 mb-1">Quantity *</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        placeholder="0"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                                    />
                                    <select
                                        value={unit}
                                        onChange={(e) => setUnit(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                                    >
                                        <option value="kg">kg</option>
                                        <option value="g">g</option>
                                        <option value="l">l</option>
                                        <option value="ml">ml</option>
                                        <option value="bag">bag</option>
                                        <option value="unit">unit</option>
                                    </select>
                                </div>
                            </div>

                            {/* Rate */}
                            <div>
                                <label className="block font-semibold text-gray-700 mb-1">Rate (Rs.) *</label>
                                <input
                                    type="number"
                                    value={rate}
                                    onChange={(e) => setRate(e.target.value)}
                                    placeholder="Price per unit"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                                />
                            </div>

                            {/* Conditional Fields */}
                            {transactionType === "stock_in" ? (
                                <div>
                                    <label className="block font-semibold text-gray-700 mb-1">Supplier</label>
                                    <input
                                        type="text"
                                        value={supplier}
                                        onChange={(e) => setSupplier(e.target.value)}
                                        placeholder="Supplier name"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block font-semibold text-gray-700 mb-1">Location *</label>
                                        <input
                                            type="text"
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            placeholder="Field/Land location"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-gray-700 mb-1">Land Area</label>
                                        <input
                                            type="text"
                                            value={landArea}
                                            onChange={(e) => setLandArea(e.target.value)}
                                            placeholder="e.g., 2 acres"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Remarks */}
                            <div className="lg:col-span-3">
                                <label className="block font-semibold text-gray-700 mb-1">Remarks</label>
                                <input
                                    type="text"
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Additional notes..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                                />
                            </div>
                        </div>

                        {/* Total Amount Display */}
                        {quantity && rate && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                                <p className="text-green-800 font-semibold">
                                    Total Amount: Rs. {(Number(quantity) * Number(rate)).toLocaleString()}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-300"
                            >
                                <Save className="w-4 h-4" /> 
                                {editingId ? "Update Transaction" : "Save Transaction"}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                        {/* Search */}
                        <div className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search products, remarks..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] focus:ring-2 focus:ring-green-500"
                            />
                        </div>

                        {/* Filter Type */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-1">Transaction Type</label>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                            >
                                <option value="all">All Transactions</option>
                                <option value="stock_in">Stock In</option>
                                <option value="stock_out">Stock Out</option>
                            </select>
                        </div>

                        {/* Filter Product */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-1">Product</label>
                            <select
                                value={filterProduct}
                                onChange={(e) => setFilterProduct(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                            >
                                <option value="all">All Products</option>
                                {products.map((product, i) => (
                                    <option key={i} value={product}>{product}</option>
                                ))}
                            </select>
                        </div>

                        {/* Filter Location */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-1">Location</label>
                            <select
                                value={filterLocation}
                                onChange={(e) => setFilterLocation(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                            >
                                <option value="all">All Locations</option>
                                {locations.map((location, i) => (
                                    <option key={i} value={location}>{location}</option>
                                ))}
                            </select>
                        </div>

                        {/* Filter Date */}
                        <div className="relative">
                            <label className="block text-gray-700 font-semibold mb-1">Filter by Date</label>
                            <input
                                type="date"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-gray-600 focus:ring-2 focus:ring-green-500 appearance-none"
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
                            <thead className="bg-gradient-to-r from-green-600 to-green-700 text-white text-[12px]">
                                <tr>
                                    <th className="px-6 py-3 text-left">Date</th>
                                    <th className="px-6 py-3 text-left">Type</th>
                                    <th className="px-6 py-3 text-left">Product</th>
                                    <th className="px-6 py-3 text-left">Quantity</th>
                                    <th className="px-6 py-3 text-right">Rate (Rs.)</th>
                                    <th className="px-6 py-3 text-right">Amount (Rs.)</th>
                                    <th className="px-6 py-3 text-left">Location</th>
                                    <th className="px-6 py-3 text-left">Land Area</th>
                                    <th className="px-6 py-3 text-left">Remarks</th>
                                    <th className="px-6 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-[12px]">
                                {filteredTransactions.length > 0 ? (
                                    filteredTransactions.map((t) => (
                                        <tr key={t.id} className="hover:bg-green-50 transition-all duration-200">
                                            <td className="px-6 py-2">{t.date}</td>
                                            <td className="px-6 py-2">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                                                    t.transactionType === "stock_in" 
                                                        ? "bg-green-100 text-green-800" 
                                                        : "bg-blue-100 text-blue-800"
                                                }`}>
                                                    {t.transactionType === "stock_in" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                    {t.transactionType === "stock_in" ? "Stock In" : "Stock Out"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-2 font-semibold text-gray-900">{t.productName}</td>
                                            <td className="px-6 py-2">
                                                {t.quantity} {t.unit}
                                            </td>
                                            <td className="px-6 py-2 text-right">{t.rate}</td>
                                            <td className="px-6 py-2 text-right font-semibold">{t.totalAmount}</td>
                                            <td className="px-6 py-2">{t.location || "-"}</td>
                                            <td className="px-6 py-2">{t.landArea || "-"}</td>
                                            <td className="px-6 py-2">{t.remarks || "-"}</td>
                                            <td className="px-6 py-2 text-center">
                                                {role === "read" ? (
                                                    <div className="flex items-center justify-center gap-1 text-gray-400 cursor-not-allowed">
                                                        <Lock className="w-4 h-4" />
                                                        <span className="text-xs">Locked</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-center gap-2">
                                                        <button
                                                            onClick={() => handleEdit(t)}
                                                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(t.id)}
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
                                        <td colSpan="10" className="px-6 py-12 text-center text-gray-500">
                                            No transactions found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-6 text-center text-[12px] text-gray-600">
                    Showing {filteredTransactions.length} of {transactions.length} records
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