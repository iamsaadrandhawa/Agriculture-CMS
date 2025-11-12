import { Calendar, TrendingUp, FileDown } from "lucide-react";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";


export default function DailyReport() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [ledgerTotals, setLedgerTotals] = useState([]);
  const [overallTotals, setOverallTotals] = useState({
    totalRecovery: 0,
    totalExpense: 0,
    netBalance: 0
  });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const [ledgerCodes, setLedgerCodes] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        loadLedgerCodesAndTransactions(user.uid);
      } else {
        setLoading(false);
        setLedgerTotals([]);
        setOverallTotals({
          totalRecovery: 0,
          totalExpense: 0,
          netBalance: 0
        });
      }
    });
    return () => unsubscribe();
  }, [selectedMonth]);

  // Load both ledger codes and transactions in sequence
  const loadLedgerCodesAndTransactions = async (uid) => {
    try {
      setLoading(true);
      setError(null);

      console.log("Loading ledger codes and transactions...");

      // First load ledger codes
      const ledgerCodesQuery = query(
        collection(db, "ledger_codes"),
        // where("user_id", "==", uid),
        where("is_active", "==", true)
      );

      const ledgerCodesSnapshot = await getDocs(ledgerCodesQuery);
      const codes = ledgerCodesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log("Loaded ledger codes:", codes.length);
      setLedgerCodes(codes);

      // Then load and process transactions
      await fetchMonthlyTransactions(uid, codes);

    } catch (error) {
      console.error("Error loading data:", error);
      setError(error.message);
      setLoading(false);
    }
  };

  const fetchMonthlyTransactions = async (uid, ledgerCodesArray = ledgerCodes) => {
    try {
      // Calculate date range for the selected month
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(selectedMonth + "-01");
      endDate.setMonth(endDate.getMonth() + 1);
      const endDateStr = endDate.toISOString().split("T")[0];

      console.log("Fetching transactions for period:", startDate, "to", endDateStr);

      // Simple query: only filter by user_id to avoid index requirements
      const transactionsQuery = query(
        collection(db, "transactions"),
        // where("user_id", "==", uid)
      );

      const snapshot = await getDocs(transactionsQuery);

      // Filter transactions in JavaScript: by date range and exclude balance entries
      const allTransactions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log("All transactions found:", allTransactions.length);

      const transactions = allTransactions.filter(txn =>
        txn.transaction_date >= startDate &&
        txn.transaction_date < endDateStr &&
        !txn.is_balance_entry
      );

      console.log("Filtered transactions for month:", transactions.length);

      // Group transactions by ledger_code_id
      const ledgerMap = {};

      transactions.forEach(txn => {
        const ledgerId = txn.ledger_code_id;
        if (!ledgerMap[ledgerId]) {
          ledgerMap[ledgerId] = {
            ledger_code_id: ledgerId,
            totalRecovery: 0,
            totalExpense: 0,
            transactions: []
          };
        }

        ledgerMap[ledgerId].totalRecovery += (txn.cash_in || 0) + (txn.bank_in || 0);
        ledgerMap[ledgerId].totalExpense += (txn.expenditure_out || 0) + (txn.expenditure_cash || 0);
        ledgerMap[ledgerId].transactions.push(txn);
      });

      console.log("Ledger map created with keys:", Object.keys(ledgerMap));

      // Convert to array and attach ledger names and categories USING THE PROVIDED LEDGER CODES
      const totals = Object.values(ledgerMap).map(ledger => {
        const ledgerCode = ledgerCodesArray.find(lc => lc.id === ledger.ledger_code_id);

        console.log("Looking for ledger:", ledger.ledger_code_id, "Found:", ledgerCode);

        return {
          ...ledger,
          ledger_name: ledgerCode ? ledgerCode.code : `Ledger-${ledger.ledger_code_id?.substring(0, 8)}`,
          category: ledgerCode ? ledgerCode.category : "unknown",
          ledger_data: ledgerCode // Store full ledger data for debugging
        };
      });

      console.log("Final ledger totals:", totals);
      setLedgerTotals(totals);
      calculateOverallTotals(totals);
      groupLedgersByCategory(totals);

    } catch (error) {
      console.error("Error in fetchMonthlyTransactions:", error);
      setError(error.message);
      setLedgerTotals([]);
      calculateOverallTotals([]);
      setCategoryGroups({});
    } finally {
      setLoading(false);
    }
  };

  const groupLedgersByCategory = (ledgers) => {
    const groups = {};

    ledgers.forEach(ledger => {
      const category = ledger.category || 'unknown';

      if (!groups[category]) {
        groups[category] = {
          category: category,
          ledgers: [],
          totalRecovery: 0,
          totalExpense: 0,
          netBalance: 0
        };
      }

      groups[category].ledgers.push(ledger);
      groups[category].totalRecovery += ledger.totalRecovery;
      groups[category].totalExpense += ledger.totalExpense;
      groups[category].netBalance += (ledger.totalRecovery - ledger.totalExpense);
    });

    console.log("Category groups:", groups);
    setCategoryGroups(groups);
  };

  const calculateOverallTotals = (totals) => {
    if (!totals || totals.length === 0) {
      setOverallTotals({
        totalRecovery: 0,
        totalExpense: 0,
        netBalance: 0
      });
      return;
    }

    let totalRecovery = 0;
    let totalExpense = 0;

    totals.forEach(ledger => {
      totalRecovery += ledger.totalRecovery;
      totalExpense += ledger.totalExpense;
    });

    setOverallTotals({
      totalRecovery,
      totalExpense,
      netBalance: totalRecovery - totalExpense
    });
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };



  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK').format(amount);
  };

  const getCategoryDisplayName = (category) => {
    const categoryNames = {
      'income': 'Income Ledgers',
      'expense': 'Expense Ledgers',
      'asset': 'Asset Ledgers',
      'liability': 'Liability Ledgers',
      'unknown': 'Uncategorized Ledgers'
    };

    return categoryNames[category] || `${category.charAt(0).toUpperCase() + category.slice(1)} Ledgers`;
  };

  const getCategoryColor = (category) => {
    const colors = {
      'income': 'green',
      'expense': 'red',
      'asset': 'blue',
      'liability': 'orange',
      'unknown': 'gray'
    };

    return colors[category] || 'gray';
  };

  // Debug function to check ledger codes
  const debugLedgerCodes = () => {
    console.log("Current Ledger Codes:", ledgerCodes);
    console.log("Current Ledger Totals:", ledgerTotals);
    console.log("Category Groups:", categoryGroups);
  };

  const handleViewPDF = () => {
    try {
      if (ledgerTotals.length === 0) {
        alert("No transactions available to generate report.");
        return;
      }

      const doc = new jsPDF("p", "pt", "a4");
      const reportDate = new Date().toISOString().split("T")[0];

      // ===== HEADER =====
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("MASCOT RMS", 300, 40, { align: "center" });
      doc.setFontSize(14);
      doc.text("Monthly Financial Report", 300, 60, { align: "center" });
      doc.setFontSize(10);
      doc.text(`Month: ${selectedMonth} | Generated: ${reportDate}`, 300, 80, { align: "center" });

      // ===== METADATA =====
      doc.setProperties({
        title: "MASCOT Monthly Financial Report",
        subject: "Auto-generated Monthly PDF Report",
        author: "Mascot RMS System",
        creator: "Mascot RMS",
      });

      let currentY = 100;

      // ===== INCOME LEDGERS =====
      const incomeGroups = Object.values(categoryGroups).filter(
        (g) =>
          g.category.toLowerCase().includes("income") ||
          g.category.toLowerCase().includes("recovery")
      );

      if (incomeGroups.length > 0) {
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("INCOME LEDGERS", 40, currentY);
        currentY += 10;

        incomeGroups.forEach((group) => {
          const tableData = group.ledgers.map((l) => [
            l.ledger_name,
            `Rs. ${l.totalRecovery.toFixed(0)}`,
          ]);

          autoTable(doc, {
            startY: currentY,
            head: [["Ledger Name", "Recovery"]],
            body: tableData,
            theme: "grid",
            headStyles: { fillColor: [0, 150, 0], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
            alternateRowStyles: { fillColor: [245, 255, 245] },
          });
          currentY = doc.lastAutoTable.finalY + 15;
        });
      }

      // ===== EXPENSE LEDGERS =====
      const expenseGroups = Object.values(categoryGroups).filter(
        (g) =>
          g.category.toLowerCase().includes("expense") ||
          g.category.toLowerCase().includes("cost")
      );

      if (expenseGroups.length > 0) {
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("EXPENSE LEDGERS", 40, currentY);
        currentY += 10;

        expenseGroups.forEach((group) => {
          const tableData = group.ledgers.map((l) => [
            l.ledger_name,
            `Rs. ${l.totalExpense.toFixed(0)}`,
          ]);

          autoTable(doc, {
            startY: currentY,
            head: [["Ledger Name", "Expense"]],
            body: tableData,
            theme: "grid",
            headStyles: { fillColor: [204, 0, 0], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
            alternateRowStyles: { fillColor: [255, 245, 245] },
          });
          currentY = doc.lastAutoTable.finalY + 15;
        });
      }

      // ===== OVERALL SUMMARY =====
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("OVERALL SUMMARY", 40, currentY);
      currentY += 10;

      const summary = [
        ["Total Recovery", `Rs. ${overallTotals.totalRecovery.toFixed(0)}`],
        ["Total Expense", `Rs. ${overallTotals.totalExpense.toFixed(0)}`],
        ["Net Balance", `Rs. ${overallTotals.netBalance.toFixed(0)}`],
      ];

      autoTable(doc, {
        startY: currentY,
        body: summary,
        theme: "plain",
        styles: { fontSize: 11, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: "bold", textColor: [0, 0, 102] } },
      });

      // ===== FOOTER =====
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() - 80,
          doc.internal.pageSize.getHeight() - 20
        );
        doc.text("Generated by Mascot RMS System", 40, doc.internal.pageSize.getHeight() - 20);
      }

      // ===== OPEN IN NEW TAB =====
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      alert("Error generating PDF:\n" + error.message);
      console.error(error);
    }
  };


  const handleDownloadPDF = () => {
    try {
      if (ledgerTotals.length === 0) {
        alert("No transactions available to generate report.");
        return;
      }

      const doc = new jsPDF("p", "pt", "a4");
      const reportDate = new Date().toISOString().split("T")[0];

      // ===== HEADER =====
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("MASCOT RMS", 300, 40, { align: "center" });
      doc.setFontSize(14);
      doc.text("Monthly Financial Report", 300, 60, { align: "center" });
      doc.setFontSize(10);
      // Ensure month is parsed correctly (handles both "10" or "09")
      // --- FIXED MONTH NAME + NUMBER ---
      let monthNumber = parseInt(selectedMonth, 10);
      if (isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) {
        // fallback to current month if invalid
        monthNumber = new Date().getMonth() + 1;
      }
      const monthName = new Date(2025, monthNumber - 1).toLocaleString("en-US", { month: "long" });

      // Now use in header
      doc.text(`Month: ${monthName} (${monthNumber}) | Generated: ${reportDate}`, 300, 80, { align: "center" });




      doc.setProperties({
        title: "MASCOT Monthly Financial Report",
        subject: "Auto-generated Monthly PDF Report",
        author: "Mascot RMS System",
        creator: "Mascot RMS",
      });

      let currentY = 100;

      // ===== INCOME LEDGERS =====
      const incomeGroups = Object.values(categoryGroups).filter(
        (g) => g.category.toLowerCase().includes("income") || g.category.toLowerCase().includes("recovery")
      );

      if (incomeGroups.length > 0) {
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("INCOME LEDGERS", 40, currentY);
        currentY += 10;

        incomeGroups.forEach((group) => {
          const tableData = group.ledgers.map((l) => [
            l.ledger_name,
            `Rs. ${l.totalRecovery.toFixed(0)}`,
          ]);

          autoTable(doc, {
            startY: currentY,
            head: [["Ledger Name", "Recovery"]],
            body: tableData,
            theme: "grid",
            headStyles: { fillColor: [0, 150, 0], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
            alternateRowStyles: { fillColor: [245, 255, 245] },
          });
          currentY = doc.lastAutoTable.finalY + 15;
        });
      }

      // ===== EXPENSE LEDGERS =====
      const expenseGroups = Object.values(categoryGroups).filter(
        (g) => g.category.toLowerCase().includes("expense") || g.category.toLowerCase().includes("cost")
      );

      if (expenseGroups.length > 0) {
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("EXPENSE LEDGERS", 40, currentY);
        currentY += 10;

        expenseGroups.forEach((group) => {
          const tableData = group.ledgers.map((l) => [
            l.ledger_name,
            `Rs. ${l.totalExpense.toFixed(0)}`,
          ]);

          autoTable(doc, {
            startY: currentY,
            head: [["Ledger Name", "Expense"]],
            body: tableData,
            theme: "grid",
            headStyles: { fillColor: [204, 0, 0], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
            alternateRowStyles: { fillColor: [255, 245, 245] },
          });
          currentY = doc.lastAutoTable.finalY + 15;
        });
      }

      // ===== OVERALL SUMMARY =====
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("OVERALL SUMMARY", 40, currentY);
      currentY += 10;

      const summary = [
        ["Total Recovery", `Rs. ${overallTotals.totalRecovery.toFixed(0)}`],
        ["Total Expense", `Rs. ${overallTotals.totalExpense.toFixed(0)}`],
        ["Net Balance", `Rs. ${overallTotals.netBalance.toFixed(0)}`],
      ];

      autoTable(doc, {
        startY: currentY,
        body: summary,
        theme: "plain",
        styles: { fontSize: 11, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: "bold", textColor: [0, 0, 102] } },
      });

      // ===== FOOTER =====
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() - 80,
          doc.internal.pageSize.getHeight() - 20
        );
        doc.text("Generated by Mascot RMS System", 80, doc.internal.pageSize.getHeight() - 20);
      }

      // ===== SAVE PDF =====
      doc.save(`Mascot_Monthly_Report_${monthName}_${selectedMonth}.pdf`);


    } catch (error) {
      alert("Error generating PDF:\n" + error.message);
      console.error(error);
    }
  };



  return (
    <div className="w-full flex flex-col p-3 px-4 rounded-lg">
     {/* Header */}
<div className="flex items-center justify-between mb-6">
  {/* Left Title */}
  <div className="flex items-center gap-2">
    <TrendingUp className="w-5 h-5 text-orange-600" />
    <h2 className="text-lg font-bold text-gray-900">Monthly Financial Report</h2>
  </div>

  {/* Right Controls */}
  <div className="flex items-center gap-3 flex-wrap text-xs">

    {/* View PDF */}
    <button
      onClick={handleViewPDF}
      className="flex items-center gap-1 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white px-4 py-1.5 rounded-lg transition font-semibold shadow-md"
    >
      <FileDown className="w-3 h-3" />
      View PDF
    </button>

    {/* Download Profit PDF */}
    <button
      onClick={handleDownloadPDF}
      className="flex items-center gap-1 bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white px-4 py-1.5 rounded-lg transition font-semibold shadow-md"
    >
      <FileDown className="w-3 h-3" />
      Download Profit PDF
    </button>

    {/* Month Picker */}
    <div className="flex items-center gap-1">
      <Calendar className="w-4 h-4 text-gray-500" />
      <input
        type="month"
        value={selectedMonth}
        onChange={handleMonthChange}
        className="px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 text-xs text-gray-800"
      />
    </div>

    {/* Debug Button
    <button
      onClick={debugLedgerCodes}
      className="flex items-center gap-1 bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white px-4 py-1.5 rounded-lg transition font-semibold shadow-md"
    >
      Debug
    </button> */}
  </div>
</div>


      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm font-medium">Error Loading Data</p>
          <p className="text-red-600 text-xs mt-1">{error}</p>
          <button
            onClick={() => userId && loadLedgerCodesAndTransactions(userId)}
            className="mt-2 px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 transition"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Loading monthly report...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <div className="text-center">
                <p className="text-xs font-medium text-green-900 mb-1">Total Recovery</p>
                <p className="text-lg font-bold text-green-600">Rs. {formatCurrency(overallTotals.totalRecovery)}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
              <div className="text-center">
                <p className="text-xs font-medium text-red-900 mb-1">Total Expense</p>
                <p className="text-lg font-bold text-red-600">Rs. {formatCurrency(overallTotals.totalExpense)}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="text-center">
                <p className="text-xs font-medium text-blue-900 mb-1">Net Balance</p>
                <p className={`text-lg font-bold ${overallTotals.netBalance >= 0 ? 'text-blue-600' : 'text-red-600'
                  }`}>
                  Rs. {formatCurrency(overallTotals.netBalance)}
                </p>
              </div>
            </div>
          </div>

          {/* Ledger Breakdown by Category */}
          <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Ledger Breakdown by Category - {selectedMonth}</h3>
              <div className="text-xs text-gray-600 bg-white px-2 py-0.5 rounded-full border">
                {Object.keys(categoryGroups).length} categories • {ledgerTotals.length} ledgers
              </div>
            </div>

            {Object.keys(categoryGroups).length > 0 ? (
              <div className="space-y-4">
                {Object.values(categoryGroups).map((categoryGroup) => {
                  const categoryColor = getCategoryColor(categoryGroup.category);
                  const colorClasses = {
                    'green': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', badge: 'bg-green-100 text-green-800' },
                    'red': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100 text-red-800' },
                    'blue': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-800' },
                    'orange': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-800' },
                    'gray': { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', badge: 'bg-gray-100 text-gray-800' }
                  };

                  const color = colorClasses[categoryColor] || colorClasses.gray;

                  return (
                    <div key={categoryGroup.category} className={`rounded-lg border ${color.border} ${color.bg}`}>
                      {/* Category Header */}
                      <div className="flex items-center justify-between p-4 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                          <h4 className={`font-semibold ${color.text}`}>
                            {getCategoryDisplayName(categoryGroup.category)}
                          </h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${color.badge}`}>
                            {categoryGroup.ledgers.length} ledgers
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-green-600 font-medium">
                            Recovery: Rs. {formatCurrency(categoryGroup.totalRecovery)}
                          </div>
                          <div className="text-red-600 font-medium">
                            Expense: Rs. {formatCurrency(categoryGroup.totalExpense)}
                          </div>
                          <div className={`font-bold ${categoryGroup.netBalance >= 0 ? 'text-blue-600' : 'text-red-600'
                            }`}>
                            Net: Rs. {formatCurrency(Math.abs(categoryGroup.netBalance))}
                          </div>
                        </div>
                      </div>

                      {/* Ledgers in this category */}
                      <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {categoryGroup.ledgers.map((ledger) => {
                            const netAmount = ledger.totalRecovery - ledger.totalExpense;
                            const isPositive = netAmount >= 0;

                            return (
                              <div key={ledger.ledger_code_id} className="bg-white rounded-md p-3 border border-gray-200 hover:shadow-sm transition">
                                <div className="text-center">
                                  <p className="font-medium text-gray-900 text-sm mb-2">
                                    {ledger.ledger_name}
                                  </p>

                                  <div className="space-y-1 mb-2">
                                    <div className="text-xs text-green-600">
                                      Recovery: Rs. {formatCurrency(ledger.totalRecovery)}
                                    </div>
                                    <div className="text-xs text-red-600">
                                      Expense: Rs. {formatCurrency(ledger.totalExpense)}
                                    </div>
                                  </div>

                                  <div className={`text-base font-bold ${isPositive ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                    Rs. {formatCurrency(Math.abs(netAmount))}
                                  </div>

                                  <p className={`text-xs font-medium mt-1 ${isPositive ? 'text-green-700' : 'text-red-700'
                                    }`}>
                                    {isPositive ? 'Net Credit' : 'Net Debit'}
                                  </p>

                                  <p className="text-xs text-gray-500 mt-1">
                                    {ledger.transactions.length} transactions
                                  </p>

                                  {/* Debug info - remove in production */}
                                  <p className="text-xs text-gray-400 mt-1">
                                    ID: {ledger.ledger_code_id?.substring(0, 8)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-md">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">No Transaction Data Found</p>
                <p className="text-xs text-gray-500">
                  No transactions available for the selected month.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}