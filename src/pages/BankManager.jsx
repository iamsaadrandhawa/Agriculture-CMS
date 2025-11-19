import { useEffect, useState } from "react";
import { Plus, Save, Landmark, Edit3, Trash2, Search, Filter, X, Wallet } from "lucide-react";

export default function BankManager({ role, banksData, setBanksData, cashBalance, setCashBalance }) {
  const [showForm, setShowForm] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [balance, setBalance] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [cashAmount, setCashAmount] = useState(cashBalance);

  const handleSave = () => {
    if (!bankName.trim() || !accountTitle.trim() || !accountNumber.trim() || balance === "") {
      alert("Please fill all fields before saving.");
      return;
    }

    if (editingId) {
      // Update existing bank
      setBanksData(prev => prev.map(bank => 
        bank.id === editingId 
          ? { ...bank, bankName, accountTitle, accountNumber, balance: parseFloat(balance) }
          : bank
      ));
      alert("✅ Bank updated successfully!");
      setEditingId(null);
    } else {
      // Add new bank
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

  const handleUpdateCash = () => {
    setCashBalance(parseFloat(cashAmount) || 0);
    alert("✅ Cash balance updated successfully!");
  };

  const totalBankBalance = banksData.reduce((total, bank) => total + (parseFloat(bank.balance) || 0), 0);
  const totalBalance = totalBankBalance + cashBalance;

  const filteredBanks = banksData.filter(bank =>
    bank.bankName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bank.accountTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bank.accountNumber?.includes(searchTerm)
  );

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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 text-[12px]">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-gray-600">Cash Balance</p>
                <p className="text-[12px] font-bold text-gray-900 mt-1">Rs. {cashBalance.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl"><Wallet className="w-4 h-4 text-green-600" /></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-gray-600">Total Banks</p>
                <p className="text-[12px] font-bold text-gray-900 mt-1">{banksData.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl"><Landmark className="w-4 h-4 text-blue-600" /></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-gray-600">Bank Balance</p>
                <p className="text-[12px] font-bold text-gray-900 mt-1">Rs. {totalBankBalance.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl"><span className="text-lg">💰</span></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-orange-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-gray-600">Total Balance</p>
                <p className="text-[12px] font-bold text-gray-900 mt-1">Rs. {totalBalance.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl"><span className="text-lg">📊</span></div>
            </div>
          </div>
        </div>

        {/* Cash Update Section */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-lg border border-green-200">
          <h3 className="text-[12px] font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-green-600" />
            Update Cash Balance
          </h3>
          <div className="flex items-center gap-4">
            <input
              type="number"
              placeholder="Enter cash amount"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
            <button
              onClick={handleUpdateCash}
              disabled={role === "read"}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Save className="w-3 h-3" /> Update Cash
            </button>
          </div>
        </div>

        {/* Add/Edit Bank Form */}
        {showForm && (
          <div className="bg-white rounded-2xl p-6 mb-4 shadow-lg border border-blue-200">
            <h3 className="text-[12px] font-bold text-gray-900 mb-6">
              {editingId ? "✏️ Edit Bank Account" : "🏦 Add New Bank Account"}
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-gray-700">Bank Name *</label>
                <input
                  type="text"
                  placeholder="e.g., HBL, UBL, MCB"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-gray-700">Account Title *</label>
                <input
                  type="text"
                  placeholder="e.g., John Doe"
                  value={accountTitle}
                  onChange={(e) => setAccountTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-gray-700">Account Number *</label>
                <input
                  type="text"
                  placeholder="e.g., 123456789"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-gray-700">Current Balance *</label>
                <input
                  type="number"
                  placeholder="0"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white text-[12px] rounded-lg hover:bg-blue-600 transition"
              >
                <Save className="w-4 h-4" /> {editingId ? "Update Bank" : "Save Bank"}
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

        {/* Search */}
        <div className="bg-white rounded-2xl p-6 mb-3 shadow-lg">
          <div className="flex items-center gap-4">
            <Search className="text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search banks by name, account title, or number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-[12px] text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Banks Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-blue-600 text-white text-[12px]">
                <tr>
                  <th className="px-6 py-2 text-left">Bank Details</th>
                  <th className="px-6 py-2 text-left">Account Info</th>
                  <th className="px-6 py-2 text-right">Balance</th>
                  <th className="px-6 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-[12px]">
                {filteredBanks.length > 0 ? (
                  filteredBanks.map((bank) => (
                    <tr key={bank.id} className="hover:bg-blue-50 transition-all duration-200 group">
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-[12px]">
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
                      <td className="px-6 py-2">
                        <div className="text-[12px] font-medium text-gray-900">{bank.accountTitle}</div>
                        <div className="text-[10px] text-gray-500">Acc: {bank.accountNumber}</div>
                      </td>
                      <td className="px-6 py-2 text-right">
                        <div className="text-[12px] font-bold text-green-600">
                          Rs. {(parseFloat(bank.balance) || 0).toLocaleString()}
                        </div>
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
                                onClick={() => handleEdit(bank)}
                                className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(bank.id)}
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
                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500 text-[12px]">
                      No bank accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 text-center text-[12px] text-gray-600">
          Showing {filteredBanks.length} of {banksData.length} bank accounts
        </div>

      </div>
    </div>
  );
}