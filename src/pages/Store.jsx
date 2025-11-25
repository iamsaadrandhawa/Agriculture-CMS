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
    query,
    where,
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
    BarChart3,
    ShoppingCart,
    ArrowUpCircle,
    ArrowDownCircle,
    Tag,
    Users,
    Landmark
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AgriStore({ banksData = [], setBanksData, cashBalance, setCashBalance }) {
    const [role, setRole] = useState("");
    const [showPurchaseForm, setShowPurchaseForm] = useState(false);
    const [showIssueForm, setShowIssueForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [products, setProducts] = useState([]);
    const [locations, setLocations] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [filterProduct, setFilterProduct] = useState("all");
    const [filterLocation, setFilterLocation] = useState("all");
    const [filterDate, setFilterDate] = useState("");
    const [filterBank, setFilterBank] = useState("all");

    // Form fields - Purchase
    const [purchaseDate, setPurchaseDate] = useState("");
    const [purchaseProduct, setPurchaseProduct] = useState("");
    const [purchaseQuantity, setPurchaseQuantity] = useState("");
    const [purchaseUnit, setPurchaseUnit] = useState("kg");
    const [purchaseRate, setPurchaseRate] = useState("");
    const [supplier, setSupplier] = useState("");
    const [purchaseRemarks, setPurchaseRemarks] = useState("");
    const [purchaseBank, setPurchaseBank] = useState(""); // New bank field
    const [issueDate, setIssueDate] = useState("");
    const [issueProduct, setIssueProduct] = useState("");
    const [issueQuantity, setIssueQuantity] = useState("");
    const [issueUnit, setIssueUnit] = useState("kg");
    const [issueLocation, setIssueLocation] = useState("");
    const [landArea, setLandArea] = useState("");
    const [issueRemarks, setIssueRemarks] = useState("");

    useEffect(() => {
        const fetchUserRole = async () => {
            const user = await getCurrentUser();
            if (user?.role) setRole(user.role);
        };
        fetchUserRole();
        fetchTransactions();
    }, []);

    // Fetch transactions and update products/locations
    const fetchTransactions = async () => {
        const querySnapshot = await getDocs(collection(db, "agristore_transactions"));
        const list = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        const sortedList = list.sort((a, b) => new Date(b.date) - new Date(a.date));
        setTransactions(sortedList);
        fetchProducts(sortedList);
        fetchLocations(sortedList);
    };

    // Fetch products from ledger_codes with category 'product' or from transactions
    const fetchProducts = async (transactionsList = transactions) => {
        try {
            // First try to get from ledger_codes
            const ledgerQuery = query(
                collection(db, "ledger_codes"), 
                where("category", "==", "product")
            );
            const ledgerSnapshot = await getDocs(ledgerQuery);
            
            if (!ledgerSnapshot.empty) {
                const productList = ledgerSnapshot.docs.map(d => d.data().code);
                setProducts([...new Set(productList)]);
            } else {
                // Fallback: get from existing transactions
                const productList = transactionsList
                    .map(t => t.productName)
                    .filter(name => name && name.trim() !== "");
                setProducts([...new Set(productList)]);
            }
        } catch (error) {
            console.error("Error fetching products:", error);
            // Fallback to transactions if ledger_codes fails
            const productList = transactionsList
                .map(t => t.productName)
                .filter(name => name && name.trim() !== "");
            setProducts([...new Set(productList)]);
        }
    };

    // Fetch locations from ledger_codes with category 'location'
    const fetchLocations = async (transactionsList = transactions) => {
        try {
            const ledgerQuery = query(
                collection(db, "ledger_codes"), 
                where("category", "==", "location")
            );
            const ledgerSnapshot = await getDocs(ledgerQuery);
            
            if (!ledgerSnapshot.empty) {
                const locationList = ledgerSnapshot.docs.map(d => d.data().code);
                setLocations([...new Set(locationList)]);
            } else {
                // Fallback: get from existing transactions
                const locationList = transactionsList
                    .map(t => t.location)
                    .filter(location => location && location.trim() !== "");
                setLocations([...new Set(locationList)]);
            }
        } catch (error) {
            console.error("Error fetching locations from ledgers:", error);
            // Fallback to transactions if ledgers not available
            const locationList = transactionsList
                .map(t => t.location)
                .filter(location => location && location.trim() !== "");
            setLocations([...new Set(locationList)]);
        }
    };

    // Reset purchase form
    const resetPurchaseForm = () => {
        setPurchaseDate("");
        setPurchaseProduct("");
        setPurchaseQuantity("");
        setPurchaseUnit("kg");
        setPurchaseRate("");
        setSupplier("");
        setPurchaseRemarks("");
        setPurchaseBank(""); // Reset bank field
        setEditingId(null);
    };

    // Reset issue form
    const resetIssueForm = () => {
        setIssueDate("");
        setIssueProduct("");
        setIssueQuantity("");
        setIssueUnit("kg");
        setIssueLocation("");
        setLandArea("");
        setIssueRemarks("");
        setEditingId(null);
    };

    // Calculate product-wise stock (FIXED)
    const getProductStock = (productName) => {
        const stockIn = transactions
            .filter(t => t.transactionType === "stock_in" && t.productName === productName)
            .reduce((sum, t) => sum + Number(t.quantity || 0), 0);

        const stockOut = transactions
            .filter(t => t.transactionType === "stock_out" && t.productName === productName)
            .reduce((sum, t) => sum + Number(t.quantity || 0), 0);

        return stockIn - stockOut;
    };

    // Calculate product-wise current value (FIXED - FIFO method)
    const getProductValue = (productName) => {
        // Get all purchase transactions for this product
        const purchases = transactions
            .filter(t => t.transactionType === "stock_in" && t.productName === productName)
            .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date (FIFO)
        
        // Calculate remaining stock
        const remainingStock = getProductStock(productName);
        
        if (remainingStock <= 0) return 0;
        
        let remainingValue = 0;
        let tempStock = remainingStock;
        
        // Work backwards through purchases to calculate value of remaining stock (FIFO)
        for (let i = purchases.length - 1; i >= 0 && tempStock > 0; i--) {
            const purchase = purchases[i];
            const purchaseQuantity = Number(purchase.quantity || 0);
            const purchaseRate = Number(purchase.rate || 0);
            
            if (tempStock >= purchaseQuantity) {
                // Use entire purchase
                remainingValue += purchaseQuantity * purchaseRate;
                tempStock -= purchaseQuantity;
            } else {
                // Use partial purchase
                remainingValue += tempStock * purchaseRate;
                tempStock = 0;
            }
        }
        
        return remainingValue;
    };

    // Get unique products with their stats
    const productStats = [...new Set(transactions.map(t => t.productName))]
        .filter(product => product && product.trim() !== "")
        .map(product => ({
            name: product,
            stock: getProductStock(product),
            value: getProductValue(product),
            unit: transactions.find(t => t.productName === product)?.unit || "kg"
        }))
        .filter(product => product.stock > 0); // Only show products with stock

    const handlePurchase = async () => {
        if (!purchaseDate || !purchaseProduct || !purchaseQuantity || !purchaseRate) {
            alert("Please fill all required fields!");
            return;
        }

        const totalAmount = Number(purchaseQuantity) * Number(purchaseRate);
        const data = {
            date: purchaseDate,
            transactionType: "stock_in",
            productName: purchaseProduct,
            quantity: Number(purchaseQuantity),
            unit: purchaseUnit,
            rate: Number(purchaseRate),
            totalAmount: totalAmount,
            supplier,
            remarks: purchaseRemarks,
            bank_name: purchaseBank, // Store bank name
            amount: totalAmount, // Store amount for bank transactions
            updatedAt: Timestamp.now(),
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, "agristore_transactions", editingId), data);
                alert("✅ Purchase updated successfully!");
            } else {
                await addDoc(collection(db, "agristore_transactions"), data);
                alert("✅ Purchase recorded successfully!");
                
                // Update bank balance if bank is selected
                if (purchaseBank && purchaseBank !== "cash") {
                    updateBankBalance(purchaseBank, -totalAmount);
                } else if (purchaseBank === "cash") {
                    // Update cash balance
                    const newCashBalance = cashBalance - totalAmount;
                    setCashBalance(newCashBalance);
                    localStorage.setItem("cashBalance", newCashBalance.toString());
                }
            }

            resetPurchaseForm();
            setShowPurchaseForm(false);
            fetchTransactions();
        } catch (error) {
            console.error("Error saving purchase:", error);
            alert("❌ Failed to save purchase!");
        }
    };

    // Function to update bank balance
    const updateBankBalance = (bankName, amount) => {
        setBanksData(prev => prev.map(bank => 
            bank.bankName === bankName 
                ? { ...bank, balance: (parseFloat(bank.balance) || 0) + amount }
                : bank
        ));
    };

    const handleIssue = async () => {
        if (!issueDate || !issueProduct || !issueQuantity || !issueLocation) {
            alert("Please fill all required fields!");
            return;
        }

        const availableStock = getProductStock(issueProduct);
        if (Number(issueQuantity) > availableStock) {
            alert(`❌ Insufficient stock! Available: ${availableStock} ${issueUnit}`);
            return;
        }

        // Calculate the value of the issued stock (FIFO method)
        const issuedQuantity = Number(issueQuantity);
        let remainingToIssue = issuedQuantity;
        let issuedValue = 0;
        
        // Get all purchase transactions sorted by date (oldest first for FIFO)
        const purchases = transactions
            .filter(t => t.transactionType === "stock_in" && t.productName === issueProduct)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Calculate value using FIFO
        for (const purchase of purchases) {
            if (remainingToIssue <= 0) break;
            
            const purchaseQuantity = Number(purchase.quantity || 0);
            const purchaseRate = Number(purchase.rate || 0);
            const availableFromPurchase = purchaseQuantity;
            
            if (availableFromPurchase > 0) {
                const quantityToUse = Math.min(remainingToIssue, availableFromPurchase);
                issuedValue += quantityToUse * purchaseRate;
                remainingToIssue -= quantityToUse;
            }
        }

        const data = {
            date: issueDate,
            transactionType: "stock_out",
            productName: issueProduct,
            quantity: issuedQuantity,
            unit: issueUnit,
            location: issueLocation,
            landArea,
            remarks: issueRemarks,
            issuedValue: issuedValue, // Store the value of issued stock
            updatedAt: Timestamp.now(),
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, "agristore_transactions", editingId), data);
                alert("✅ Issue updated successfully!");
            } else {
                await addDoc(collection(db, "agristore_transactions"), data);
                alert(`✅ Issue recorded successfully! Issued value: Rs. ${issuedValue.toLocaleString()}`);
            }

            resetIssueForm();
            setShowIssueForm(false);
            fetchTransactions();
        } catch (error) {
            console.error("Error saving issue:", error);
            alert("❌ Failed to save issue!");
        }
    };

    const handleEdit = (item) => {
        setEditingId(item.id);
        if (item.transactionType === "stock_in") {
            setPurchaseDate(item.date);
            setPurchaseProduct(item.productName);
            setPurchaseQuantity(item.quantity);
            setPurchaseUnit(item.unit);
            setPurchaseRate(item.rate);
            setSupplier(item.supplier || "");
            setPurchaseRemarks(item.remarks || "");
            setPurchaseBank(item.bank_name || ""); // Set bank field
            setShowPurchaseForm(true);
            setShowIssueForm(false);
        } else {
            setIssueDate(item.date);
            setIssueProduct(item.productName);
            setIssueQuantity(item.quantity);
            setIssueUnit(item.unit);
            setIssueLocation(item.location || "");
            setLandArea(item.landArea || "");
            setIssueRemarks(item.remarks || "");
            setShowIssueForm(true);
            setShowPurchaseForm(false);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this transaction?")) return;
        try {
            await deleteDoc(doc(db, "agristore_transactions", id));
            alert("✅ Transaction deleted successfully!");
            fetchTransactions();
        } catch (error) {
            console.error("Error deleting transaction:", error);
            alert("❌ Failed to delete transaction!");
        }
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

    // Calculate overall stats
    const totalStockIn = transactions
        .filter(t => t.transactionType === "stock_in")
        .reduce((sum, t) => sum + Number(t.quantity || 0), 0);

    const totalStockOut = transactions
        .filter(t => t.transactionType === "stock_out")
        .reduce((sum, t) => sum + Number(t.quantity || 0), 0);

    const currentStock = totalStockIn - totalStockOut;

    const totalPurchaseValue = transactions
        .filter(t => t.transactionType === "stock_in")
        .reduce((sum, t) => sum + Number(t.totalAmount || 0), 0);

    const totalIssuedValue = transactions
        .filter(t => t.transactionType === "stock_out")
        .reduce((sum, t) => sum + Number(t.issuedValue || 0), 0);

    const currentInventoryValue = totalPurchaseValue - totalIssuedValue;

    const uniqueProducts = [...new Set(transactions.map(t => t.productName))].length;

    // Get available banks for dropdown
    const availableBanks = [
        { name: "cash", displayName: "💵 Cash" },
        ...banksData.map(bank => ({ 
            name: bank.bankName, 
            displayName: `🏦 ${bank.bankName}` 
        }))
    ];

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
            doc.text("AGRICULTURE CMS Inventory Report", 40, 50);

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
            doc.text(`Inventory Value: Rs. ${currentInventoryValue.toLocaleString()}`, pageWidth - 200, 80);

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
                        "Bank",
                        "Location",
                        "Land Area",
                        "Remarks"
                    ]],
                    body: group.map((t) => [
                        t.date || "—",
                        t.transactionType === "stock_in" ? "Stock In" : "Stock Out",
                        `${t.quantity} ${t.unit}`,
                        t.rate || "—",
                        t.totalAmount || t.issuedValue || "—",
                        t.bank_name || "—",
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
                "Generated by AGRICULTURE-CMS Management System " + new Date().getFullYear(),
                40,
                doc.internal.pageSize.height - 20
            );

            doc.save("AGRICULTURE-CMS_Inventory_Report.pdf");
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

                        {/* 📥 Purchase Button */}
                        <button
                            onClick={() => {
                                if (role === "read") return;
                                resetPurchaseForm();
                                setShowPurchaseForm(true);
                                setShowIssueForm(false);
                            }}
                            disabled={role === "read"}
                            className={`flex items-center gap-1 px-4 py-1.5 rounded-lg font-semibold shadow-md text-[12px] transition
                                ${role === "read"
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white"
                                }`}
                        >
                            {role === "read" ? (
                                <>
                                    <Lock className="w-3 h-3" /> Locked
                                </>
                            ) : (
                                <>
                                    <ShoppingCart className="w-3 h-3" /> New Purchase
                                </>
                            )}
                        </button>

                        {/* 📤 Issue Button */}
                        <button
                            onClick={() => {
                                if (role === "read") return;
                                resetIssueForm();
                                setShowIssueForm(true);
                                setShowPurchaseForm(false);
                            }}
                            disabled={role === "read"}
                            className={`flex items-center gap-1 px-4 py-1.5 rounded-lg font-semibold shadow-md text-[12px] transition
                                ${role === "read"
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-gradient-to-r from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 text-white"
                                }`}
                        >
                            {role === "read" ? (
                                <>
                                    <Lock className="w-3 h-3" /> Locked
                                </>
                            ) : (
                                <>
                                    <Truck className="w-3 h-3" /> Issue Stock
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Info Banner about Ledger Integration */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-blue-600" />
                        <div>
                            <p className="text-[12px] font-semibold text-blue-800">
                                Integrated with Bank & Ledger System
                            </p>
                            <p className="text-[11px] text-blue-600">
                                • Products and Locations are managed through Ledger Manager
                                • Bank transactions automatically update bank balances
                                • Cash purchases deduct from cash balance
                            </p>
                        </div>
                    </div>
                </div>

                {/* ✅ Product-wise Stats Cards */}
                {productStats.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Package className="w-4 h-4" /> Product Stock Levels
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {productStats.map((product, index) => (
                                <ProductStatCard 
                                    key={index}
                                    product={product}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* ✅ Overall Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 text-[12px]">
                    <StatCard 
                        title="Total Stock In" 
                        value={`${totalStockIn} `} 
                        icon={<ArrowDownCircle className="w-4 h-4 text-blue-600" />} 
                        color="blue" 
                    />
                    <StatCard 
                        title="Total Stock Out" 
                        value={`${totalStockOut} `} 
                        icon={<ArrowUpCircle className="w-4 h-4 text-orange-600" />} 
                        color="orange" 
                    />
                    <StatCard 
                        title="Current Inventory Value" 
                        value={`Rs. ${currentInventoryValue.toLocaleString()}`} 
                        icon={<TrendingUp className="w-4 h-4 text-green-600" />} 
                        color="green" 
                    />
                    <StatCard 
                        title="Active Products" 
                        value={uniqueProducts} 
                        icon={<Package className="w-4 h-4 text-purple-600" />} 
                        color="purple" 
                    />
                </div>

                {/* 📥 Purchase Form */}
                {showPurchaseForm && (
                    <div className="bg-white rounded-2xl p-6 mb-4 shadow-lg border border-blue-200 text-[12px] text-gray-800">
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
                                {editingId ? "✏️ Edit Purchase" : "📥 New Purchase"}
                            </h3>
                            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                            {/* Date */}
                            <div className="relative">
                                <label className="block font-semibold text-gray-700 mb-1">Date *</label>
                                <input
                                    type="date"
                                    value={purchaseDate}
                                    onChange={(e) => setPurchaseDate(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-700"
                                />
                                <Calendar className="absolute left-3 top-1/2 -translate-y-[10%] text-gray-400 w-4 h-4 pointer-events-none" />
                            </div>

                            {/* Product Name */}
                            <div>
                                <label className="block font-semibold text-gray-700 mb-1">Product Name *</label>
                                <select
                                    value={purchaseProduct}
                                    onChange={(e) => setPurchaseProduct(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select Product</option>
                                    {products.map((product, index) => (
                                        <option key={index} value={product}>{product}</option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-gray-500 mt-1">
                                    Products are managed in Ledger Manager (category: product)
                                </p>
                            </div>

                            {/* Quantity & Unit */}
                            <div>
                                <label className="block font-semibold text-gray-700 mb-1">Quantity *</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={purchaseQuantity}
                                        onChange={(e) => setPurchaseQuantity(e.target.value)}
                                        placeholder="0"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                    />
                                    <select
                                        value={purchaseUnit}
                                        onChange={(e) => setPurchaseUnit(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
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
                                    value={purchaseRate}
                                    onChange={(e) => setPurchaseRate(e.target.value)}
                                    placeholder="Price per unit"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Bank Selection */}
                            <div>
                                <label className="block font-semibold text-gray-700 mb-1">Payment Method</label>
                                <select
                                    value={purchaseBank}
                                    onChange={(e) => setPurchaseBank(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select Payment Method</option>
                                    {availableBanks.map((bank, index) => (
                                        <option key={index} value={bank.name}>
                                            {bank.displayName}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-gray-500 mt-1">
                                    Select bank or cash for payment
                                </p>
                            </div>

                            {/* Supplier */}
                            <div>
                                <label className="block font-semibold text-gray-700 mb-1">Supplier</label>
                                <input
                                    type="text"
                                    value={supplier}
                                    onChange={(e) => setSupplier(e.target.value)}
                                    placeholder="Supplier name"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Remarks */}
                            <div className="lg:col-span-3">
                                <label className="block font-semibold text-gray-700 mb-1">Remarks</label>
                                <input
                                    type="text"
                                    value={purchaseRemarks}
                                    onChange={(e) => setPurchaseRemarks(e.target.value)}
                                    placeholder="Additional notes..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Total Amount Display */}
                        {purchaseQuantity && purchaseRate && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                <p className="text-blue-800 font-semibold">
                                    Total Amount: Rs. {(Number(purchaseQuantity) * Number(purchaseRate)).toLocaleString()}
                                </p>
                                {purchaseBank && (
                                    <p className="text-blue-700 text-[11px] mt-1">
                                        This amount will be deducted from: {purchaseBank === "cash" ? "💵 Cash" : `🏦 ${purchaseBank}`}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={handlePurchase}
                                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300"
                            >
                                <Save className="w-4 h-4" /> 
                                {editingId ? "Update Purchase" : "Save Purchase"}
                            </button>
                            <button
                                onClick={() => {
                                    setShowPurchaseForm(false);
                                    resetPurchaseForm();
                                }}
                                className="px-6 py-2 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* 📤 Issue Form - Remains the same as before */}
                {showIssueForm && (
                    <div className="bg-white rounded-2xl p-6 mb-4 shadow-lg border border-orange-200 text-[12px] text-gray-800">
                        {/* ... existing issue form code ... */}
                    </div>
                )}

                {/* 🔍 Filters Section - Updated to include bank filter */}
                <div className="bg-white rounded-2xl p-6 mb-3 shadow-lg text-[12px] text-gray-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
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

                        {/* Filter Bank */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-1">Bank</label>
                            <select
                                value={filterBank}
                                onChange={(e) => setFilterBank(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                            >
                                <option value="all">All Banks</option>
                                {availableBanks.map((bank, i) => (
                                    <option key={i} value={bank.name}>{bank.displayName}</option>
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

                {/* Table - Updated to show bank column */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden text-[12px] text-gray-800">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gradient-to-r from-green-600 to-green-700 text-white text-[12px]">
                                <tr>
                                    <th className="px-6 py-2 text-left">Date</th>
                                    <th className="px-6 py-2 text-left">Type</th>
                                    <th className="px-6 py-2 text-left">Product</th>
                                    <th className="px-6 py-2 text-left">Quantity</th>
                                    <th className="px-6 py-2 text-right">Rate (Rs.)</th>
                                    <th className="px-6 py-2 text-right">Amount (Rs.)</th>
                                    <th className="px-6 py-2 text-left">Bank</th>
                                    <th className="px-6 py-2 text-left">Location</th>
                                    <th className="px-6 py-2 text-left">Land Area</th>
                                    <th className="px-6 py-2 text-left">Remarks</th>
                                    <th className="px-6 py-2 text-center">Actions</th>
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
                                                        ? "bg-blue-100 text-blue-800" 
                                                        : "bg-orange-100 text-orange-800"
                                                }`}>
                                                    {t.transactionType === "stock_in" ? 
                                                        <ArrowDownCircle className="w-3 h-3" /> : 
                                                        <ArrowUpCircle className="w-3 h-3" />
                                                    }
                                                    {t.transactionType === "stock_in" ? "Purchase" : "Issue"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-2 font-semibold text-gray-900">{t.productName}</td>
                                            <td className="px-6 py-2">
                                                {t.quantity} {t.unit}
                                            </td>
                                            <td className="px-6 py-2 text-right">{t.rate || "-"}</td>
                                            <td className="px-6 py-2 text-right font-semibold">
                                                {t.totalAmount || t.issuedValue || "-"}
                                            </td>
                                            <td className="px-6 py-2">
                                                {t.bank_name ? (
                                                    t.bank_name === "cash" ? (
                                                        <span className="inline-flex items-center gap-1 text-green-600">
                                                            💵 Cash
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-blue-600">
                                                            <Landmark className="w-3 h-3" /> {t.bank_name}
                                                        </span>
                                                    )
                                                ) : "-"}
                                            </td>
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
                                        <td colSpan="11" className="px-6 py-12 text-center text-gray-500">
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

// 🔧 Reusable Components (StatCard and ProductStatCard remain the same)
function StatCard({ title, value, icon, color }) {
    const colorClasses = {
        blue: "border-blue-100",
        orange: "border-orange-100", 
        green: "border-green-100",
        purple: "border-purple-100"
    };

    const bgColorClasses = {
        blue: "bg-blue-100",
        orange: "bg-orange-100",
        green: "bg-green-100", 
        purple: "bg-purple-100"
    };

    return (
        <div className={`bg-white rounded-2xl p-6 shadow-lg border ${colorClasses[color]}`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[12px] font-medium text-gray-600">{title}</p>
                    <p className="text-[12px] font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`p-3 ${bgColorClasses[color]} rounded-xl`}>{icon}</div>
            </div>
        </div>
    );
}

// Product-specific Stat Card
function ProductStatCard({ product }) {
    const stockPercentage = Math.min((product.stock / (product.stock + 50)) * 100, 100);
    
    return (
        <div className="bg-white rounded-2xl p-4 shadow-lg border border-green-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-[12px] font-bold text-gray-900 truncate" title={product.name}>
                    {product.name}
                </h4>
                <Package className="w-4 h-4 text-green-600 flex-shrink-0" />
            </div>
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-[11px] text-gray-600">Current Stock:</span>
                    <span className="text-[11px] font-bold text-gray-900">
                        {product.stock} {product.unit}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[11px] text-gray-600">Current Value:</span>
                    <span className="text-[11px] font-bold text-green-600">
                        Rs. {product.value.toLocaleString()}
                    </span>
                </div>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Stock Level</span>
                    <span>{Math.round(stockPercentage)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                            stockPercentage > 70 ? 'bg-green-500' : 
                            stockPercentage > 30 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${stockPercentage}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
}