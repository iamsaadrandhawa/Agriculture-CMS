import { useEffect, useState } from "react";
import { Plus, Save, Landmark, Edit3, Trash2, Search, X, Wallet, ChevronDown, BarChart3, Lock } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useGlobalCash } from "../hooks/useGlobalCash";

export default function BankManager({ 
  role, 
  banksData = [], 
  setBanksData, 
  dailyTransactionsData = [],
  storeTransactionsData = []
}) {
  const [showForm, setShowForm] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [balance, setBalance] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [ledgerCodes, setLedgerCodes] = useState([]);
  const [loadingLedgers, setLoadingLedgers] = useState(false);
  const [updatingCash, setUpdatingCash] = useState(false);

  // Use the global cash hook
  const { cashBalance, loading: cashLoading, error: cashError, updateCashBalance } = useGlobalCash();

  // Update local cash amount when global cash balance changes
  useEffect(() => {
    setCashAmount(cashBalance);
  }, [cashBalance]);

  // Fetch ledger codes
 const loadLedgerCodes = async () => {
  try {
    setLoadingLedgers(true);
    const q = query(
      collection(db, "ledger_codes"),
      where("is_active", "==", true),
      where("subCategory", "in", ["bank", "Bank"]) // Filter for both "bank" and "Bank"

    );
    const snapshot = await getDocs(q);
    const codes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setLedgerCodes(codes);
    console.log("✅ Income ledgers loaded:", codes.length);
  } catch (error) {
    console.error("Error loading income ledger codes:", error);
  } finally {
    setLoadingLedgers(false);
  }
};

  useEffect(() => {
    loadLedgerCodes();
  }, []);

  // Handle cash balance update
  const handleUpdateCash = async () => {
    if (role === "read") {
      alert("❌ Read-only users cannot update cash balance");
      return;
    }

    const newCashBalance = parseFloat(cashAmount);
    if (isNaN(newCashBalance)) {
      alert("❌ Please enter a valid cash amount");
      return;
    }

    try {
      setUpdatingCash(true);
      const success = await updateCashBalance(newCashBalance);
      
      if (success) {
        alert("✅ Cash balance updated successfully in Firestore!");
      } else {
        alert("❌ Failed to update cash balance");
      }
    } catch (error) {
      console.error("Error updating cash:", error);
      alert("❌ Error updating cash balance");
    } finally {
      setUpdatingCash(false);
    }
  };

  // Calculate bank balances from transactions
  const calculateBankBalancesFromTransactions = () => {
    const bankBalances = {};
    
    banksData.forEach(bank => {
      if (bank.bankName) {
        bankBalances[bank.bankName] = parseFloat(bank.balance) || 0;
      }
    });

    dailyTransactionsData.forEach(transaction => {
      if (transaction.bank_in && transaction.bank_name) {
        const amount = parseFloat(transaction.bank_in) || 0;
        bankBalances[transaction.bank_name] = (bankBalances[transaction.bank_name] || 0) + amount;
      }
      if (transaction.expenditure_out && transaction.bank_name) {
        const amount = parseFloat(transaction.expenditure_out) || 0;
        bankBalances[transaction.bank_name] = (bankBalances[transaction.bank_name] || 0) - amount;
      }
    });

    storeTransactionsData.forEach(transaction => {
      if (transaction.bank_name && transaction.amount) {
        const amount = parseFloat(transaction.amount) || 0;
        if (transaction.transactionType === 'purchase') {
          bankBalances[transaction.bank_name] = (bankBalances[transaction.bank_name] || 0) - amount;
        } else if (transaction.transactionType === 'issue') {
          bankBalances[transaction.bank_name] = (bankBalances[transaction.bank_name] || 0) + amount;
        }
      }
    });

    return bankBalances;
  };

  const bankBalancesFromTransactions = calculateBankBalancesFromTransactions();

  // Get individual bank stats
  const getBankStats = () => {
    return banksData.map(bank => {
      const currentBalance = parseFloat(bank.balance) || 0;
      const calculatedBalance = bankBalancesFromTransactions[bank.bankName] || currentBalance;
      
      return {
        ...bank,
        currentBalance,
        calculatedBalance,
        difference: calculatedBalance - currentBalance
      };
    });
  };

  const bankStats = getBankStats();

  // Calculate totals
  const totalBankBalance = bankStats.reduce((total, bank) => total + bank.calculatedBalance, 0);
  const totalBalance = totalBankBalance + cashBalance;

  // Bank management functions
  const handleSave = () => {
    if (!bankName.trim() || !accountTitle.trim() || !accountNumber.trim() || balance === "") {
      alert("Please fill all fields before saving.");
      return;
    }

    if (editingId) {
      setBanksData(prev => prev.map(bank => 
        bank.id === editingId 
          ? { ...bank, bankName, accountTitle, accountNumber, balance: parseFloat(balance) }
          : bank
      ));
      alert("✅ Bank updated successfully!");
      setEditingId(null);
    } else {
      const newBank = {
        id: Date.now().toString(),
        bankName,
        accountTitle,
        accountNumber,
        balance: parseFloat(balance),
        createdAt: new Date().toISOString()
      };
      setBanksData(prev => [...prev, newBank]);
      alert("✅ Bank added successfully!");
    }

    setBankName("");
    setAccountTitle("");
    setAccountNumber("");
    setBalance("");
    setShowForm(false);
    setBankDropdownOpen(false);
  };

  const handleEdit = (bank) => {
    setEditingId(bank.id);
    setBankName(bank.bankName || "");
    setAccountTitle(bank.accountTitle || "");
    setAccountNumber(bank.accountNumber || "");
    setBalance(bank.balance != null ? String(bank.balance) : "");
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (!confirm("Are you sure you want to delete this bank account?")) return;
    setBanksData(prev => prev.filter(bank => bank.id !== id));
    alert("✅ Bank account deleted");
  };

  const selectBankName = (name) => {
    setBankName(name);
    setBankDropdownOpen(false);
  };

  const filteredBanks = banksData.filter(bank =>
    bank.bankName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bank.accountTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bank.accountNumber?.includes(searchTerm)
  );

  // Get ledger category by name
  const getLedgerCategory = (ledgerName) => {
    const ledger = ledgerCodes.find(l => l.code === ledgerName);
    return ledger?.category || 'default';
  };

  // Get category color
  const getCategoryColor = (category) => {
    const colors = {
      income: "from-green-500 to-emerald-600",
      expense: "from-red-500 to-orange-600",
      location: "from-blue-500 to-cyan-600",
      product: "from-purple-500 to-pink-600",
      default: "from-gray-500 to-gray-600"
    };
    return colors[category?.toLowerCase()] || colors.default;
  };

  const allLedgerNames = ledgerCodes
    .map(ledger => ledger.code || '')
    .filter(name => name && typeof name === 'string' && name.trim() !== '')
    .filter((name, index, array) => array.indexOf(name) === index)
    .sort();

  return (
    <div className="w-full mx-auto py-3 px-4 text-[12px] text-gray-800">
      <div className="max-w-9xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Bank & Cash Management</h2>
           
          </div>

          <button
            onClick={() => {
              if (role === "read") return;
              if (!showForm) {
                setEditingId(null);
                setBankName("");
                setAccountTitle("");
                setAccountNumber("");
                setBalance("");
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
                <X className="w-3 h-3" /> Locked
              </>
            ) : showForm ? (
              <>
                <X className="w-3 h-3" /> Close Form
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" /> Add Bank Account
              </>
            )}
          </button>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 text-[12px]">
          {/* Cash Balance */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-gray-600">Cash Balance</p>
                <p className="text-[12px] font-bold text-gray-900 mt-1">
                  {cashLoading ? "Loading..." : `Rs. ${cashBalance.toLocaleString()}`}
                </p>
                <p className="text-[10px] text-green-600 mt-1">
                  🔄 Firestore Sync
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <Wallet className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </div>

          {/* Total Banks */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-gray-600">Total Banks</p>
                <p className="text-[12px] font-bold text-gray-900 mt-1">{banksData.length}</p>
                <p className="text-[10px] text-blue-600 mt-1">
                  {bankStats.filter(b => b.difference !== 0).length} updated
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl"><Landmark className="w-4 h-4 text-blue-600" /></div>
            </div>
          </div>

          {/* Bank Balance */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-gray-600">Bank Balance</p>
                <p className="text-[12px] font-bold text-gray-900 mt-1">Rs. {totalBankBalance.toLocaleString()}</p>
                <p className="text-[10px] text-purple-600 mt-1">
                  From transactions
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl"><BarChart3 className="w-4 h-4 text-purple-600" /></div>
            </div>
          </div>

          {/* Total Balance */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-orange-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-gray-600">Total Balance</p>
                <p className="text-[12px] font-bold text-gray-900 mt-1">
                  {cashLoading ? "Loading..." : `Rs. ${totalBalance.toLocaleString()}`}
                </p>
                <p className="text-[10px] text-orange-600 mt-1">
                  Cash + Banks
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl"><span className="text-lg">📊</span></div>
            </div>
          </div>
        </div>

        {/* Cash Update Section */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-lg border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[12px] font-bold text-gray-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-green-600" />
              Update Cash Balance (Firestore)
            </h3>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded">
              Collection: globalcash
            </span>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <input
              type="number"
              placeholder="Enter cash amount"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              disabled={updatingCash || cashLoading}
            />
            <button
              onClick={handleUpdateCash}
              disabled={role === "read" || updatingCash || cashLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-md"
            >
              {updatingCash ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3 h-3" /> 
                  {role === "read" ? "Locked" : "Update Cash"}
                </>
              )}
            </button>
          </div>
        
        </div>

        {/* Individual Bank Balances */}
        {bankStats.length > 0 && (
          <div className="bg-white rounded-2xl p-6 mb-6 shadow-lg border border-blue-200">
            <h3 className="text-[12px] font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Individual Bank Balances (From Transactions)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {bankStats.map((bank, index) => (
                <div key={bank.id} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[12px] font-semibold text-gray-900 truncate">
                      {bank.bankName}
                    </h4>
                    <div className={`w-2 h-2 rounded-full ${
                      bank.difference === 0 ? 'bg-green-500' : 
                      bank.difference > 0 ? 'bg-blue-500' : 'bg-orange-500'
                    }`}></div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-600">Initial:</span>
                      <span className="text-[11px] font-medium">Rs. {bank.currentBalance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-600">Current:</span>
                      <span className="text-[11px] font-bold text-green-600">
                        Rs. {bank.calculatedBalance.toLocaleString()}
                      </span>
                    </div>
                    {bank.difference !== 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-600">Change:</span>
                        <span className={`text-[10px] font-bold ${
                          bank.difference > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {bank.difference > 0 ? '+' : ''}{bank.difference.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add/Edit Bank Form */}
        {showForm && (
          <div className="bg-white rounded-2xl p-6 mb-4 shadow-lg border border-blue-200">
            <h3 className="text-[12px] font-bold text-gray-900 mb-6">
              {editingId ? "✏️ Edit Bank Account" : "🏦 Add New Bank Account"}
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Bank Name with Dropdown */}
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-gray-700">Bank Name *</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between bg-white hover:bg-gray-50 transition"
                  >
                    <span className={bankName ? "text-gray-800" : "text-gray-500"}>
                      {bankName || "Select from all ledgers"}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${bankDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {bankDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {loadingLedgers ? (
                        <div className="px-3 py-2 text-[12px] text-gray-500 text-center">
                          Loading ledgers...
                        </div>
                      ) : allLedgerNames.length > 0 ? (
                        allLedgerNames.map((name, index) => {
                          const category = getLedgerCategory(name);
                          
                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => selectBankName(name)}
                              className={`w-full px-3 py-2 text-left text-[12px] hover:bg-blue-50 hover:text-blue-600 first:rounded-t-xl last:rounded-b-xl transition flex items-center justify-between`}
                            >
                              <span>{name}</span>
                              {category && category !== 'default' && (
                                <span className={`text-[10px] px-2 py-1 rounded-full bg-gradient-to-r ${getCategoryColor(category)} text-white`}>
                                  {category}
                                </span>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-3 py-2 text-[12px] text-gray-500 text-center">
                          <button
                            onClick={loadLedgerCodes}
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            Click to load ledgers
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-gray-500">
                  {loadingLedgers 
                    ? "Loading ledgers..." 
                    : allLedgerNames.length > 0 
                    ? `${allLedgerNames.length} ledgers available from all categories` 
                    : 'No ledgers found. Create ledgers first.'
                  }
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-gray-700">Account Title *</label>
                <input
                  type="text"
                  placeholder="e.g., John Doe"
                  value={accountTitle}
                  onChange={(e) => setAccountTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300 transition"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-gray-700">Account Number *</label>
                <input
                  type="text"
                  placeholder="e.g., 123456789"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300 transition"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-gray-700">Current Balance *</label>
                <input
                  type="number"
                  placeholder="0"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300 transition"
                />
              </div>
            </div>

            {/* Manual Bank Input */}
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <label className="block text-[12px] font-semibold text-gray-700 mb-2">
                Or enter bank name manually:
              </label>
              <input
                type="text"
                placeholder="Enter bank name manually..."
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3 py-2 border border-yellow-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 hover:border-yellow-400 transition"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[12px] rounded-lg hover:from-blue-600 hover:to-blue-700 transition shadow-md"
              >
                <Save className="w-4 h-4" /> {editingId ? "Update Bank" : "Save Bank"}
              </button>

              <button
                onClick={() => {
                  setShowForm(false);
                  setBankDropdownOpen(false);
                }}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white text-[12px] rounded-lg hover:from-gray-500 hover:to-gray-600 transition shadow-md"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-2xl p-6 mb-3 shadow-lg border border-blue-100">
          <div className="flex items-center gap-4">
            <Search className="text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search banks by name, account title, or number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300 transition"
            />
          </div>
        </div>

        {/* Banks Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-blue-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-green-600 to-green-700 text-white text-[12px]">
                <tr>
                  <th className="px-6 py-2 text-left font-semibold">Bank Details</th>
                  <th className="px-6 py-2 text-left font-semibold">Account Info</th>
                  <th className="px-6 py-2 text-right font-semibold">Initial Balance</th>
                  <th className="px-6 py-2 text-right font-semibold">Current Balance</th>
                  <th className="px-6 py-2 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-[12px]">
                {filteredBanks.length > 0 ? (
                  filteredBanks.map((bank) => {
                    const bankStat = bankStats.find(bs => bs.id === bank.id);
                    const currentBalance = bankStat?.calculatedBalance || parseFloat(bank.balance) || 0;
                    const initialBalance = parseFloat(bank.balance) || 0;
                    const difference = currentBalance - initialBalance;
                    
                    return (
                      <tr key={bank.id} className="hover:bg-blue-50 transition-all duration-200 group">
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-[12px] shadow-md">
                              {bank.bankName?.charAt(0)?.toUpperCase() || "B"}
                            </div>
                            <div className="ml-3">
                              <div className="text-[12px] font-semibold text-gray-900 group-hover:text-blue-600">
                                {bank.bankName}
                              </div>
                              <div className="text-[10px] text-gray-500">
                                Created: {new Date(bank.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="text-[12px] font-medium text-gray-900">{bank.accountTitle}</div>
                          <div className="text-[10px] text-gray-500">Acc: {bank.accountNumber}</div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="text-[12px] font-medium text-gray-600">
                            Rs. {initialBalance.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="text-[12px] font-bold text-green-600">
                            Rs. {currentBalance.toLocaleString()}
                          </div>
                          {difference !== 0 && (
                            <div className={`text-[10px] ${difference > 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {difference > 0 ? '+' : ''}{difference.toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {role === "read" ? (
                              <div className="flex items-center gap-1 text-gray-400 cursor-not-allowed px-3 py-1 bg-gray-100 rounded-lg">
                                <Lock className="w-4 h-4" />
                                <span className="text-xs">Locked</span>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEdit(bank)}
                                  className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition shadow-md"
                                  title="Edit Bank"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(bank.id)}
                                  className="p-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition shadow-md"
                                  title="Delete Bank"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500 text-[12px]">
                      <div className="flex flex-col items-center gap-2">
                        <Landmark className="w-8 h-8 text-gray-400" />
                        <p>No bank accounts found.</p>
                        {searchTerm && (
                          <p className="text-[10px]">Try changing your search term</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 text-center text-[12px] text-gray-600">
          Showing {filteredBanks.length} of {banksData.length} bank accounts
          {allLedgerNames.length === 0 && !loadingLedgers && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-700">
                💡 <strong>Tip:</strong> Create ledger codes to see them here as bank options.
              </p>
              <button
                onClick={loadLedgerCodes}
                className="mt-2 text-blue-600 hover:text-blue-800 underline text-[10px]"
              >
                Click here to reload ledgers
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}