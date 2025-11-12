// LedgerManager.jsx
import { useState, useEffect } from "react";
import { Plus, CreditCard as Edit2, Trash2, Save, X, Tag } from "lucide-react";
import { db, auth } from "../lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function LedgerManager() {
  const [ledgerCodes, setLedgerCodes] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ code: "", category: "income" });
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUserId(u.uid);
        loadLedgerCodes(u.uid);
      } else {
        setUserId(null);
        setLedgerCodes([]);
      }
    });
    return () => unsub();
  }, []);

  const loadLedgerCodes = async (uid = userId) => {
    if (!uid) return;
    try {
      const q = query(collection(db, "ledger_codes"));
      const snapshot = await getDocs(q);
      const codes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLedgerCodes(codes);
    } catch (err) {
      console.error("loadLedgerCodes:", err);
    }
  };

  const createLedgerTotalFieldName = (ledgerName) => {
    return `total_${ledgerName.toLowerCase().replace(/\s+/g, "_")}`;
  };

  const handleAdd = async () => {
    if (!formData.code.trim() || !userId) return;
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, "ledger_codes"), {
        ...formData,
        user_id: userId,
        is_active: true,
        created_at: new Date(),
      });

      const totalFieldName = createLedgerTotalFieldName(formData.code);
      const currentMonth = new Date().toISOString().slice(0, 7);

      await addDoc(collection(db, "ledger_totals"), {
        ledger_code_id: docRef.id,
        ledger_name: formData.code,
        ledger_code: formData.code,
        category: formData.category,
        [totalFieldName]: 0,
        month: currentMonth,
        transaction_count: 0,
        user_id: userId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      setFormData({ code: "", category: "income" });
      setIsAdding(false);
      loadLedgerCodes();

      alert(
        `✅ Ledger "${formData.code}" created successfully! \nTotal field created: ${totalFieldName}`
      );
    } catch (error) {
      console.error("Error adding ledger code:", error);
      alert(`Error adding ledger code: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateLedgerTotalsFromTransaction = async (transactionData) => {
    if (!userId) return;

    try {
      const { ledger_code_id, cash_in = 0, bank_in = 0, expenditure_out = 0, expenditure_cash = 0 } = transactionData;
      const currentMonth = new Date().toISOString().slice(0, 7);

      const totalsQuery = query(
        collection(db, "ledger_totals"),
        where("ledger_code_id", "==", ledger_code_id),
        where("month", "==", currentMonth)
      );

      const totalsSnapshot = await getDocs(totalsQuery);

      if (!totalsSnapshot.empty) {
        const totalsDoc = totalsSnapshot.docs[0];
        const currentData = totalsDoc.data();

        const transactionAmount = (cash_in || bank_in) - (expenditure_out || expenditure_cash);

        const ledgerFieldName = createLedgerTotalFieldName(currentData.ledger_name);

        await updateDoc(doc(db, "ledger_totals", totalsDoc.id), {
          [ledgerFieldName]: (currentData[ledgerFieldName] || 0) + transactionAmount,
          transaction_count: (currentData.transaction_count || 0) + 1,
          updated_at: new Date(),
        });

        console.log(`✅ Updated ${ledgerFieldName}: +${transactionAmount}`);
      }
    } catch (error) {
      console.error("Error updating ledger totals:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this ledger code?\nThis will also delete all associated transaction totals.")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "ledger_codes", id));
      const totalsQuery = query(collection(db, "ledger_totals"), where("ledger_code_id", "==", id));
      const totalsSnapshot = await getDocs(totalsQuery);

      if (!totalsSnapshot.empty) {
        const totalsDoc = totalsSnapshot.docs[0];
        await deleteDoc(doc(db, "ledger_totals", totalsDoc.id));
      }

      loadLedgerCodes();
    } catch (error) {
      console.error("Error deleting ledger code:", error);
      alert(`Error deleting ledger code: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, "ledger_codes", id), {
        is_active: !currentStatus,
        updated_at: new Date(),
      });
      loadLedgerCodes();
    } catch (error) {
      console.error("Error toggling ledger code:", error);
      alert(`Error toggling ledger code: ${error.message}`);
    }
  };

  const startEdit = (lc) => {
    setEditingId(lc.id);
    setFormData({ code: lc.code, category: lc.category || "income" });
    setIsAdding(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({ code: "", category: "income" });
  };

  const incomeCategories = ledgerCodes.filter((lc) => lc.category === "income");
  const expenseCategories = ledgerCodes.filter((lc) => lc.category === "expense");

  return (
  <div className="w-full mx-auto py-3 px-4 text-[12px]">
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Ledger Code Management</h2>
        </div>
        <button
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            setFormData({ code: "", category: "income" });
          }}
          className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-[12px] rounded-lg hover:from-purple-600 hover:to-purple-700 transition"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Add / Edit Form */}
      {isAdding && (
        <div className="bg-purple-50 rounded-lg p-3 mb-4 text-[12px]">
          <h3 className="font-medium text-gray-900 text-[12px] mb-2">New Ledger Code</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1">Ledger Name</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., Cash, Office Expense"
                className="w-full px-2 py-1 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-[12px]"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Will create field: total_{formData.code.toLowerCase().replace(/\s+/g, "_") || "ledger"}
              </p>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-2 py-1 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-[12px]"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={loading || !formData.code.trim()}
              className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-[12px] rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              {loading ? "Saving..." : "Save"}
            </button>
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-700 text-[12px] rounded-lg hover:bg-gray-300 transition"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Ledger Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Income Section */}
        <div>
          <h3 className="text-[12px] font-semibold text-gray-900 mb-1">Income Categories</h3>
          <div className="space-y-1">
            {incomeCategories.map((lc) =>
              editingId === lc.id ? (
                <div key={lc.id} className="bg-green-50 rounded-lg p-2">
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-[12px]"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleUpdate(lc.id)}
                        disabled={loading || !formData.code.trim()}
                        className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-[12px] rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                      >
                        <Save className="w-3 h-3" />
                        {loading ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-700 text-[12px] rounded-lg hover:bg-gray-300 transition"
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  key={lc.id}
                  className={`flex items-center justify-between p-2 bg-green-50 rounded-lg ${!lc.is_active ? "opacity-50" : ""}`}
                >
                  <div>
                    <span className="font-medium text-gray-900 text-[12px] block">{lc.code}</span>
                    <span className="text-[11px] text-gray-500">
                      Field: total_{lc.code.toLowerCase().replace(/\s+/g, "_")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(lc.id, lc.is_active)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                        lc.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                      }`}
                    >
                      {lc.is_active ? "Active" : "Inactive"}
                    </button>
                    <button onClick={() => startEdit(lc)} className="p-1 text-gray-600 hover:bg-white rounded transition">
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDelete(lc.id)} className="p-1 text-red-600 hover:bg-red-100 rounded transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Expense Section */}
        <div>
          <h3 className="text-[12px] font-semibold text-gray-900 mb-1">Expense Categories</h3>
          <div className="space-y-1">
            {expenseCategories.map((lc) =>
              editingId === lc.id ? (
                <div key={lc.id} className="bg-red-50 rounded-lg p-2">
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-[12px]"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleUpdate(lc.id)}
                        disabled={loading || !formData.code.trim()}
                        className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white text-[12px] rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                      >
                        <Save className="w-3 h-3" />
                        {loading ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-700 text-[12px] rounded-lg hover:bg-gray-300 transition"
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  key={lc.id}
                  className={`flex items-center justify-between p-2 bg-red-50 rounded-lg ${!lc.is_active ? "opacity-50" : ""}`}
                >
                  <div>
                    <span className="font-medium text-gray-900 text-[12px] block">{lc.code}</span>
                    <span className="text-[11px] text-gray-500">
                      Field: total_{lc.code.toLowerCase().replace(/\s+/g, "_")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(lc.id, lc.is_active)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                        lc.is_active ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                      }`}
                    >
                      {lc.is_active ? "Active" : "Inactive"}
                    </button>
                    <button onClick={() => startEdit(lc)} className="p-1 text-gray-600 hover:bg-white rounded transition">
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDelete(lc.id)} className="p-1 text-red-600 hover:bg-red-100 rounded transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);

}
