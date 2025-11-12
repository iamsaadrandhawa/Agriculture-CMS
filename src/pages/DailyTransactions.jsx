import { useState, useEffect } from "react";
import { Plus, Download, SaveAll, Trash2, Calendar, Tag, Edit, EyeIcon, Lock, Clock } from "lucide-react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, query, where, addDoc, orderBy, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import CountdownTimer from './CountdownTimer';
import { getCurrentUser } from "../components/userUtils";


export default function DailyTransactions() {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [rows, setRows] = useState([]);
  const [ledgerCodes, setLedgerCodes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previousBalance, setPreviousBalance] = useState(0);
  const [isEditingPreviousBalance, setIsEditingPreviousBalance] = useState(false);
  const [customPreviousBalance, setCustomPreviousBalance] = useState("");
  const [isDayLocked, setIsDayLocked] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);

        const currentUserData = await getCurrentUser(user.uid); // 👈 you already imported this
        setUserRole(currentUserData?.role || "read"); // default to 'read' if undefined

        loadLedgerCodes(user.uid);
        loadEmployees(user.uid);
        loadTransactions(selectedDate, user.uid);
        loadPreviousBalance(selectedDate, user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        loadLedgerCodes(user.uid);
        loadEmployees(user.uid);
        loadTransactions(selectedDate, user.uid);
        loadPreviousBalance(selectedDate, user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (userId && selectedDate) {
      loadTransactions(selectedDate, userId);
      loadPreviousBalance(selectedDate, userId);
      checkIfDayLocked(selectedDate);
    }
  }, [selectedDate, userId, userRole]);


  const loadLedgerCodes = async (uid) => {
    try {
      const q = query(
        collection(db, "ledger_codes"),
        // where("user_id", "==", uid),
        where("is_active", "==", true)
      );
      const snapshot = await getDocs(q);
      const codes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLedgerCodes(codes);
    } catch (error) {
      console.error("Error loading ledger codes:", error);
    }
  };

  const loadEmployees = async (uid) => {
    try {
      const q = query(
        collection(db, "employees"),
        // where("user_id", "==", uid)
      );
      const snapshot = await getDocs(q);
      const empData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEmployees(empData);
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const loadTransactions = async (date, uid) => {
    try {
      const q = query(
        collection(db, "transactions"),
        // where("user_id", "==", uid),
        where("transaction_date", "==", date)
      );
      const snapshot = await getDocs(q);

      // Filter out balance entries and regular transactions
      const balanceEntries = [];
      const regularTransactions = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.is_balance_entry) {
          balanceEntries.push({ id: doc.id, ...data });
        } else {
          regularTransactions.push({ id: doc.id, ...data });
        }
      });

      setRows(regularTransactions);

      // Set previous balance from balance entry if exists
      if (balanceEntries.length > 0) {
        setPreviousBalance(balanceEntries[0].previous_balance || 0);
      }

    } catch (error) {
      console.error("Error loading transactions:", error);
    }
  };

const loadPreviousBalance = async (date, uid) => {
  try {
    console.log("🔄 Loading previous balance for:", date);

    // 1️⃣ Check for a manual balance entry first
    const manualBalanceQuery = query(
      collection(db, "transactions"),
      where("transaction_date", "==", date),
      where("is_balance_entry", "==", true)
    );
    const manualBalanceSnapshot = await getDocs(manualBalanceQuery);

    if (!manualBalanceSnapshot.empty) {
      const balanceData = manualBalanceSnapshot.docs[0].data();
      console.log("✅ Found manual balance entry:", balanceData.previous_balance);
      setPreviousBalance(balanceData.previous_balance || 0);
      return;
    }

    // 2️⃣ Get previous day's date
    const currentDate = new Date(date);
    const previousDate = new Date(currentDate);
    previousDate.setDate(currentDate.getDate() - 1);
    const previousDateStr = previousDate.toISOString().split("T")[0];
    console.log("📅 Previous date:", previousDateStr);

    // 3️⃣ Get all transactions for the previous day
    const prevDayQuery = query(
      collection(db, "transactions"),
      where("transaction_date", "==", previousDateStr)
    );
    const prevDaySnapshot = await getDocs(prevDayQuery);

    let previousDayTotalBalance = 0;

    if (!prevDaySnapshot.empty) {
      let prevDayBalanceEntry = null;
      let prevDayRegularTxns = [];

      // Separate balance entry from normal transactions
      prevDaySnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.is_balance_entry) {
          prevDayBalanceEntry = data;
        } else {
          prevDayRegularTxns.push(data);
        }
      });

      // If previous day had a total balance stored, use that directly
      if (prevDayBalanceEntry && prevDayBalanceEntry.total_balance !== undefined) {
        previousDayTotalBalance = prevDayBalanceEntry.total_balance;
        console.log("✅ Using previous day's total balance:", previousDayTotalBalance);
      } else {
        // Otherwise, calculate it manually from all transactions before or on that date
        const allUpToPrevDayQuery = query(
          collection(db, "transactions"),
          where("transaction_date", "<=", previousDateStr),
          where("is_balance_entry", "==", false)
        );
        const allUpToPrevDaySnapshot = await getDocs(allUpToPrevDayQuery);

        allUpToPrevDaySnapshot.forEach(doc => {
          const data = doc.data();
          previousDayTotalBalance += (data.cash_in + data.bank_in - data.expenditure_out - data.expenditure_cash);
        });

        console.log("🧮 Calculated total up to previous day:", previousDayTotalBalance);
      }
    } else {
      // No previous day transactions — use all transactions before current date
      const allBeforeTodayQuery = query(
        collection(db, "transactions"),
        where("transaction_date", "<", date),
        where("is_balance_entry", "==", false)
      );
      const allBeforeTodaySnapshot = await getDocs(allBeforeTodayQuery);

      allBeforeTodaySnapshot.forEach(doc => {
        const data = doc.data();
        previousDayTotalBalance += (data.cash_in + data.bank_in - data.expenditure_out - data.expenditure_cash);
      });

      console.log("ℹ️ No prev day data — total up to today:", previousDayTotalBalance);
    }

    // 4️⃣ Set the total cumulative balance as today's previous balance
    setPreviousBalance(previousDayTotalBalance);
    console.log("✅ Final previous balance (cumulative):", previousDayTotalBalance);

  } catch (error) {
    console.error("❌ Error loading previous balance:", error);
    setPreviousBalance(0);
  }
};


  const addRow = () => {
    setRows([
      ...rows,
      {
        id: `temp-${Date.now()}-${Math.random()}`,
        ledger_code_id: "",
        employee_id: "",
        cash_in: "",
        bank_in: "",
        expenditure_out: "",
        expenditure_cash: "",
        description: "",
      },
    ]);
  };

  const deleteRow = async (index) => {
    const rowToDelete = rows[index];

    // If it's a saved transaction (has a real Firestore ID), delete from database
    if (rowToDelete.id && !rowToDelete.id.startsWith('temp-')) {
      try {
        await deleteDoc(doc(db, "transactions", rowToDelete.id));
      } catch (error) {
        console.error("Error deleting transaction:", error);
        alert(`Error deleting transaction: ${error.message}`);
        return;
      } 
    }

    // Remove from local state
    const newRows = [...rows];
    newRows.splice(index, 1);
    setRows(newRows);
  };

  const handleInputChange = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  const handleSaveAll = async () => {
    if (loading) return;
    setLoading(true);

    if (!userId) {
      alert("Please log in to save transactions");
      setLoading(false);
      return;
    }
    // Filter valid rows for saving (exclude balance entries)
    const validRows = rows.filter(
      (row) =>
        !row.is_balance_entry &&
        row.ledger_code_id &&
        row.description &&
        (
          (row.cash_in && parseFloat(row.cash_in) > 0) ||
          (row.bank_in && parseFloat(row.bank_in) > 0) ||
          (row.expenditure_out && parseFloat(row.expenditure_out) > 0) ||
          (row.expenditure_cash && parseFloat(row.expenditure_cash) > 0)
        )
    );

    if (validRows.length === 0) {
      alert("No valid transactions to save. Please fill in required fields (Ledger Code, Description, and at least one amount field).");
      setLoading(false);
      return;
    }

    try {
      // 🔹 Save all current rows
      const savePromises = validRows.map(async (row) => {
        const txnData = {
          transaction_date: selectedDate,
          ledger_code_id: row.ledger_code_id,
          employee_id: row.employee_id || null,
          cash_in: parseFloat(row.cash_in || 0),
          bank_in: parseFloat(row.bank_in || 0),
          expenditure_out: parseFloat(row.expenditure_out || 0),
          expenditure_cash: parseFloat(row.expenditure_cash || 0),
          description: row.description.trim(),
          user_id: userId,
          is_balance_entry: false,
          updated_at: new Date(),
        };

        if (row.id && !row.id.startsWith('temp-')) {
          const docRef = doc(db, "transactions", row.id);
          await updateDoc(docRef, txnData);
        } else {
          await addDoc(collection(db, "transactions"), {
            ...txnData,
            created_at: new Date(),
          });
        }
      });

      await Promise.all(savePromises);

      // 🔥 CRITICAL: Calculate TODAY'S closing balance and carry forward to next day
      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split("T")[0];

      // Calculate today's closing balance (Previous Balance + Today's Net)
      const totalExpense = rows
        .filter(row => !row.is_balance_entry)
        .reduce(
          (acc, row) =>
            acc +
            (parseFloat(row.expenditure_out || 0) +
              parseFloat(row.expenditure_cash || 0)),
          0
        );

      const totalRecovery = rows
        .filter(row => !row.is_balance_entry)
        .reduce(
          (acc, row) =>
            acc + (parseFloat(row.cash_in || 0) + parseFloat(row.bank_in || 0)),
          0
        );

      const todayNetBalance = totalRecovery - totalExpense;
      const closingBalance = previousBalance + todayNetBalance;

      console.log(`Carry Forward Calculation:`);
      console.log(`Previous Balance: ${previousBalance}`);
      console.log(`Today Recovery: ${totalRecovery}`);
      console.log(`Today Expense: ${totalExpense}`);
      console.log(`Today Net: ${todayNetBalance}`);
      console.log(`Closing Balance: ${closingBalance}`);
      console.log(`Carrying forward to: ${nextDateStr}`);

      // 🔹 Check if next day's balance entry already exists
      const nextBalanceQuery = query(
        collection(db, "transactions"),
        // where("user_id", "==", userId),
        where("transaction_date", "==", nextDateStr),
        where("is_balance_entry", "==", true)
      );

      const nextBalanceSnapshot = await getDocs(nextBalanceQuery);

      const nextBalanceData = {
        transaction_date: nextDateStr,
        previous_balance: closingBalance, // This is the key - today's closing becomes tomorrow's opening
        description: `Auto carry forward from ${selectedDate}`,
        is_balance_entry: true,
        user_id: userId,
        updated_at: new Date(),
      };

      if (!nextBalanceSnapshot.empty) {
        // Update existing balance entry for next day
        const docRef = doc(db, "transactions", nextBalanceSnapshot.docs[0].id);
        await updateDoc(docRef, nextBalanceData);
        console.log(`Updated existing balance entry for ${nextDateStr}: ${closingBalance}`);
      } else {
        // Create new balance entry for next day
        await addDoc(collection(db, "transactions"), {
          ...nextBalanceData,
          created_at: new Date(),
        });
        console.log(`Created new balance entry for ${nextDateStr}: ${closingBalance}`);
      }

      // Also update today's balance entry if it exists (for consistency)
      const todayBalanceQuery = query(
        collection(db, "transactions"),
        // where("user_id", "==", userId),
        where("transaction_date", "==", selectedDate),
        where("is_balance_entry", "==", true)
      );

      const todayBalanceSnapshot = await getDocs(todayBalanceQuery);

      if (!todayBalanceSnapshot.empty) {
        const todayBalanceRef = doc(db, "transactions", todayBalanceSnapshot.docs[0].id);
        await updateDoc(todayBalanceRef, {
          previous_balance: previousBalance,
          updated_at: new Date(),
        });
      }

      alert(`✅ Transactions saved successfully!\n\nToday's closing balance (${closingBalance.toFixed(0)}) has been carried forward to ${nextDateStr} as previous balance.`);

      // Reload to reflect changes
      loadTransactions(selectedDate, userId);

    } catch (error) {
      console.error("Error saving transactions:", error);
      alert(`Error saving transactions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals from current rows (only regular transactions, exclude balance entries)
  const totalExpense = rows
    .filter(row => !row.is_balance_entry)
    .reduce(
      (acc, row) =>
        acc +
        (parseFloat(row.expenditure_out || 0) +
          parseFloat(row.expenditure_cash || 0)),
      0
    );

  const totalRecovery = rows
    .filter(row => !row.is_balance_entry)
    .reduce(
      (acc, row) =>
        acc + (parseFloat(row.cash_in || 0) + parseFloat(row.bank_in || 0)),
      0
    );

  const todayBalance = totalRecovery - totalExpense;
  const totalBalance = previousBalance + todayBalance;

  const incomeLedgers = ledgerCodes.filter((lc) => lc.category === "income");
  const expenseLedgers = ledgerCodes.filter((lc) => lc.category === "expense");



  const handleViewReport = () => {
    try {
      if (rows.length === 0) {
        alert("No transactions available to generate report.");
        return;
      }

      const doc = new jsPDF("p", "pt", "a4");
      const reportDate = new Date().toISOString().split("T")[0];

      // ===== HEADER =====
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("MASCOT RMS", 40, 40);
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Daily Transactions Report", 40, 60);

      doc.setFontSize(10);
      doc.text(`Date: ${reportDate}`, doc.internal.pageSize.getWidth() - 120, 60, { align: "right" });

      // ===== METADATA =====
      doc.setProperties({
        title: "MASCOT Daily Transactions Report",
        subject: "Auto-generated PDF Report",
        author: "Mascot RMS System",
        creator: "Mascot RMS",
      });

      // ===== TRANSACTIONS TABLE =====
      const tableHead = [
        ["Ledger Code", "Employee", "Cash In", "Bank In", "Exp Out", "Exp Cash", "Description", "Type"],
      ];

      const tableBody = [
        ...rows
          .filter((row) => !row.is_balance_entry)
          .map((row) => {
            const ledger = ledgerCodes.find((l) => l.id === row.ledger_code_id);
            const employee = employees.find((e) => e.id === row.employee_id);
            const transactionType =
              ledger?.category === "income" ? "Income" : "Expense";
            return [
              ledger ? ledger.code : "N/A",
              employee ? employee.name : "N/A",
              row.cash_in || 0,
              row.bank_in || 0,
              row.expenditure_out || 0,
              row.expenditure_cash || 0,
              row.description || "",
              transactionType,
            ];
          }),
      ];

      autoTable(doc, {
        startY: 80,
        head: tableHead,
        body: tableBody,
        theme: "grid",
        headStyles: { fillColor: [0, 102, 204], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 10, cellPadding: 6 },
        alternateRowStyles: { fillColor: [240, 240, 240] },
      });

      let finalY = doc.lastAutoTable.finalY + 25;

      // ===== BALANCE SUMMARY =====
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`Balance Summary - ${reportDate}`, 40, finalY);
      finalY += 8;

      const prevDate = new Date();
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split("T")[0];

      const summary = [
        ["Previous Balance", previousBalance.toFixed(0)],
        [`Total Balance from ${prevDateStr}`, totalBalance.toFixed(0)],
        ["Today Total Recovery", `${totalRecovery.toFixed(0)} (Cash + Bank Inflows)`],
        ["Today Total Expense", `${totalExpense.toFixed(0)} (Cash + Bank Outflows)`],
        ["Today Balance", `${todayBalance.toFixed(0)} (Net Profit)`],
        ["Total Balance", totalBalance.toFixed(0)],
        [
          "Previous Balance + Today Balance",
          `(${previousBalance.toFixed(0)}) + (${todayBalance.toFixed(0)}) = ${(
            previousBalance + todayBalance
          ).toFixed(0)}`,
        ],
      ];

      autoTable(doc, {
        startY: finalY,
        body: summary,
        theme: "plain",
        styles: { fontSize: 11, cellPadding: 8 },
        columnStyles: {
          0: { fontStyle: "bold", textColor: [0, 0, 102] },
          1: { textColor: [34, 34, 34] },
        },
      });

      finalY = doc.lastAutoTable.finalY + 10;

      // ===== FOOTER =====
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() - 70,
          doc.internal.pageSize.getHeight() - 20
        );
        doc.text("Generated by Mascot RMS System", 40, doc.internal.pageSize.getHeight() - 20, { align: "left" });
      }

      // ===== OPEN VIEW MODE (same design, no save) =====
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      alert("Something went wrong while generating the PDF.\n\nError: " + error.message);
      console.error(error);
    }
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF();

      // ===== HEADER =====
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("MASCOT RMS", 14, 15);
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Daily Transactions Report", 14, 23);

      const reportDate = new Date().toISOString().split("T")[0];
      doc.setFontSize(10);
      doc.text(`Date: ${reportDate}`, 170, 23, { align: "right" });

      // ===== METADATA =====
      doc.setProperties({
        title: "MASCOT Daily Transactions Report",
        subject: "Auto-generated PDF Report",
        author: "Mascot RMS System",
        creator: "Mascot RMS",
      });

      // ===== TRANSACTIONS TABLE =====
      const tableHead = [
        ["Ledger Code", "Employee", "Cash In", "Bank In", "Exp Out", "Exp Cash", "Description", "Type"],
      ];

      const tableBody = [
        ...rows
          .filter((row) => !row.is_balance_entry)
          .map((row) => {
            const ledger = ledgerCodes.find((l) => l.id === row.ledger_code_id);
            const employee = employees.find((e) => e.id === row.employee_id);
            const transactionType =
              ledger?.category === "income" ? "Income" : "Expense";
            return [
              ledger ? ledger.code : "N/A",
              employee ? employee.name : "N/A",
              row.cash_in || 0,
              row.bank_in || 0,
              row.expenditure_out || 0,
              row.expenditure_cash || 0,
              row.description || "",
              transactionType,
            ];
          }),
      ];

      autoTable(doc, {
        startY: 30,
        head: tableHead,
        body: tableBody,
        theme: "grid",
        headStyles: { fillColor: [0, 102, 204], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 10, cellPadding: 2 },
        alternateRowStyles: { fillColor: [240, 240, 240] },
      });

      let finalY = doc.lastAutoTable.finalY + 10;

      // ===== BALANCE SUMMARY =====
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`Balance Summary - ${reportDate}`, 14, finalY);
      finalY += 8;

      // Get yesterday date (for summary display)
      const prevDate = new Date();
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split("T")[0];

      const summary = [
        ["Previous Balance", previousBalance.toFixed(0)],
        [`Total Balance from ${prevDateStr}`, totalBalance.toFixed(0)],
        ["Today Total Recovery", `${totalRecovery.toFixed(0)} (Cash + Bank Inflows)`],
        ["Today Total Expense", `${totalExpense.toFixed(0)} (Cash + Bank Outflows)`],
        ["Today Balance", `${todayBalance.toFixed(0)} (Net Profit)`],
        ["Total Balance", totalBalance.toFixed(0)],
        [
          "Previous Balance + Today Balance",
          `(${previousBalance.toFixed(0)}) + (${todayBalance.toFixed(0)}) = ${(
            previousBalance + todayBalance
          ).toFixed(0)}`,
        ],
      ];

      autoTable(doc, {
        startY: finalY,
        body: summary,
        theme: "plain",
        styles: {
          fontSize: 11,
          cellPadding: 3,
        },
        columnStyles: {
          0: { fontStyle: "bold", textColor: [0, 0, 102] },
          1: { textColor: [34, 34, 34] },
        },
      });

      finalY = doc.lastAutoTable.finalY + 10;

      // ===== FOOTER =====
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() - 30,
          doc.internal.pageSize.getHeight() - 10
        );
        doc.text("Generated by Mascot RMS System", 14, doc.internal.pageSize.getHeight() - 10);
      }

      // ===== SAVE FILE =====
      doc.save(`Mascot_Daily_Report_${reportDate}.pdf`);
    } catch (error) {
      alert("Something went wrong while generating the PDF.\n\nError: " + error.message);
      console.error(error);
    }
  };

  const checkIfDayLocked = (date) => {
    const selected = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selected.setHours(0, 0, 0, 0);

    if (userRole === "admin") {
      setIsDayLocked(false); // admin can always edit
      return;
    }

    if (userRole === "read") {
      setIsDayLocked(true); // read-only always locked
      return;
    }

    // For 'write' users
    if (userRole === "write") {
      if (selected.getTime() === today.getTime()) {
        setIsDayLocked(false); // allow editing today only
      } else {
        setIsDayLocked(true);
      }
    }
  };



  useEffect(() => {
    if (userId && selectedDate) {
      loadTransactions(selectedDate, userId);
      loadPreviousBalance(selectedDate, userId);
      checkIfDayLocked(selectedDate); // Add this line
    }
  }, [selectedDate, userId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Ctrl+S (Windows/Linux) or Cmd+S (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault(); // prevent browser save dialog
        if (!isDayLocked && rows.length > 0 && !loading) {
          handleSaveAll();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDayLocked, rows.length, loading]);


  return (
    <div className="w-full flex flex-col p-4 rounded-lg text-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-green-600" />
          <h2 className=" text-lg font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            Daily Transactions
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 text-xs">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-8 py-1 text-xs text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="text-xs text-gray-600 bg-white px-3 py-1 rounded border">
            {ledgerCodes.length} ledgers loaded
          </div>
        </div>
      </div>

      {/* Controls */}

      <div className="mb-6 flex flex-col gap-3">
        {/* Locked Message */}

        {
          isDayLocked && (
            <div className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg font-semibold text-xs">
              <Lock className="w-4 h-4" />
              Locked! - This day cannot be modified after 11:59 PM
            </div>
          )}

        {/* Countdown Timer */}
        {!isDayLocked && <CountdownTimer />}

        {/* Buttons */}
        <div className="flex flex-wrap gap-4 text-xs">
          {/* ===== Add Row / Locked Status ===== */}
          {userRole === "read" || isDayLocked ? (
            <div className="flex items-center gap-1 bg-gray-400 text-gray-200 cursor-not-allowed px-4 py-1.5 rounded-lg font-semibold shadow-md text-xs">
              <Lock className="w-3 h-3" /> Locked
            </div>
          ) : (
            <button
              onClick={addRow}
              disabled={userRole === "read" || isDayLocked}
              className={`flex items-center gap-1 px-4 py-1.5 rounded-lg transition font-semibold shadow-md text-xs ${userRole === "read" || isDayLocked
                ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white"
                }`}
            >
              <Plus className="w-3 h-3" /> Add Row
            </button>
          )}

          {/* ===== View Report ===== */}
          <button
            onClick={handleViewReport}
            className="flex items-center gap-1 bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white px-4 py-1.5 rounded-lg transition font-semibold shadow-md text-xs"
          >
            <EyeIcon className="w-3 h-3" /> View Report
          </button>

          {/* ===== Download PDF ===== */}
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1 bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white px-4 py-1.5 rounded-lg transition font-semibold shadow-md text-xs"
          >
            <Download className="w-3 h-3" /> Download PDF
          </button>
        </div>

      </div>

      {/* Table Section */}
      <div className="w-full border border-gray-300 rounded-lg bg-white shadow-sm text-xs mb-6">
        <div className="min-w-[1000px]">
          <div className="grid grid-cols-9 gap-2 mb-2 px-3 font-semibold text-gray-700 border-b pb-1 text-xs">
            <div className="text-black">Ledger Code</div>
            <div>Employee</div>
            <div>Cash In</div>
            <div>Bank In</div>
            <div>Exp Out</div>
            <div>Exp Cash</div>
            <div>Description</div>
            <div>Type</div>
            <div>Action</div>
          </div>

          <div className="space-y-1 mb-6">
            {rows.length > 0 ? (
              rows.map((row, index) => {
                // Skip balance entries in the table display
                if (row.is_balance_entry) return null;

                const selectedLedger = ledgerCodes.find(
                  (lc) => lc.id === row.ledger_code_id
                );
                const transactionType =
                  selectedLedger?.category === "income"
                    ? "Income"
                    : selectedLedger?.category === "expense"
                      ? "Expense"
                      : "Select Ledger";

                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-9 gap-2 mb-1 px-3 items-center bg-white rounded-lg shadow-sm hover:shadow-md transition py-1 text-xs"
                  >
                    {/* Ledger Code */}
                    <select
                      value={row.ledger_code_id}
                      onChange={(e) =>
                        handleInputChange(index, "ledger_code_id", e.target.value)
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-xs text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select Ledger</option>
                      {incomeLedgers.length > 0 && (
                        <optgroup label="Income">
                          {incomeLedgers.map((ledger) => (
                            <option key={ledger.id} value={ledger.id}>
                              {ledger.code}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {expenseLedgers.length > 0 && (
                        <optgroup label="Expense">
                          {expenseLedgers.map((ledger) => (
                            <option key={ledger.id} value={ledger.id}>
                              {ledger.code}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>

                    {/* Employee */}
                    <select
                      value={row.employee_id}
                      onChange={(e) =>
                        handleInputChange(index, "employee_id", e.target.value)
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-xs text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select Employee</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>

                    {/* Cash In */}
                    <input
                      type="number"
                      value={row.cash_in}
                      placeholder="0"
                      onChange={(e) =>
                        handleInputChange(index, "cash_in", e.target.value)
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-xs text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                    />

                    {/* Bank In */}
                    <input
                      type="number"
                      value={row.bank_in}
                      placeholder="0"
                      onChange={(e) =>
                        handleInputChange(index, "bank_in", e.target.value)
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-xs text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                    />

                    {/* Exp Out */}
                    <input
                      type="number"
                      value={row.expenditure_out}
                      placeholder="0"
                      onChange={(e) =>
                        handleInputChange(index, "expenditure_out", e.target.value)
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-xs text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                    />

                    {/* Exp Cash */}
                    <input
                      type="number"
                      value={row.expenditure_cash}
                      placeholder="0"
                      onChange={(e) =>
                        handleInputChange(index, "expenditure_cash", e.target.value)
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-xs text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                    />

                    {/* Description */}
                    <input
                      type="text"
                      value={row.description}
                      placeholder="Description"
                      onChange={(e) =>
                        handleInputChange(index, "description", e.target.value)
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-xs text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                    />

                    {/* Transaction Type */}
                    <div
                      className={`text-xs font-semibold px-2 py-0.5 rounded text-center ${transactionType === "Income"
                        ? "bg-green-100 text-green-800"
                        : transactionType === "Expense"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-600"
                        }`}
                    >
                      {transactionType}
                    </div>

                    {/* Delete */}
                    {userRole === "read" || isDayLocked ? (
                      <div className="text-gray-400 flex items-center gap-1 cursor-not-allowed">
                        <Lock className="w-3 h-3" />
                        <span className="text-xs">Locked</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => deleteRow(index)}
                        className="text-red-500 hover:text-red-700 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}


                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg text-xs">
                No transactions for {selectedDate}. Click{" "}
                <span className="font-semibold text-green-600">"Add Row"</span> to
                start.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Balance Summary Section */}
      <div className="w-full border border-gray-300 rounded-lg bg-white shadow-sm p-6 mb-6">
        <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2">
          Balance Summary - {selectedDate}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Previous Balance */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 relative">
  <div className="text-blue-700 font-semibold mb-1">Previous Balance</div>
  <div className="text-2xl font-bold text-blue-800">
    {previousBalance.toFixed(0)}
  </div>
  <div className="text-blue-600 text-xs mt-1">
    Total Balance from {getPreviousDate(selectedDate)}
  </div>
</div>


          {/* Today's Recovery */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="text-green-700 font-semibold mb-1">Today Total Recovery</div>
            <div className="text-2xl font-bold text-green-800">
              {totalRecovery.toFixed(0)}
            </div>
            <div className="text-green-600 text-xs mt-1">Cash + Bank Inflows</div>
          </div>

          {/* Today's Expense */}
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="text-red-700 font-semibold mb-1">Today Total Expense</div>
            <div className="text-2xl font-bold text-red-800">
              {totalExpense.toFixed(0)}
            </div>
            <div className="text-red-600 text-xs mt-1">Cash + Bank Outflows</div>
          </div>

          {/* Today's Balance */}
          <div className={`p-4 rounded-lg border ${todayBalance >= 0
            ? 'bg-green-50 border-green-200'
            : 'bg-orange-50 border-orange-200'
            }`}>
            <div className={`font-semibold mb-1 ${todayBalance >= 0 ? 'text-green-700' : 'text-orange-700'
              }`}>
              Today Balance
            </div>
            <div className={`text-2xl font-bold ${todayBalance >= 0 ? 'text-green-800' : 'text-orange-800'
              }`}>
              {todayBalance.toFixed(0)}
            </div>
            <div className={`text-xs mt-1 ${todayBalance >= 0 ? 'text-green-600' : 'text-orange-600'
              }`}>
              {todayBalance >= 0 ? 'Net Profit' : 'Net Loss'}
            </div>
          </div>
        </div>

        {/* Total Balance */}
        <div className="mt-4 text-xs">
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
            <div className="text-indigo-700 font-semibold mb-1">Total Balance</div>
            <div className="text-2xl font-bold text-indigo-800">
              {totalBalance.toFixed(0)}
            </div>
            <div className="text-indigo-600 text-xs mt-1">
              Previous Balance ({previousBalance.toFixed(0)}) + Today Balance ({todayBalance.toFixed(0)})
            </div>
            <div className="text-indigo-500 text-xs mt-2 font-semibold">
              ⚡ This amount will become tomorrow's Previous Balance when you click "Save All Transactions"
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      {rows.length > 0 && (
        <div className="flex justify-center mt-6">
          {userRole === "read" || isDayLocked ? (
            <div className="flex items-center gap-1 bg-gray-400 text-gray-200 cursor-not-allowed px-6 py-2 rounded-lg font-semibold shadow-md text-sm">
              <Lock className="w-4 h-4" /> Locked
            </div>
          ) : (
            <button
              onClick={handleSaveAll}
              disabled={loading || userRole === "read" || isDayLocked}
              className="flex items-center gap-1 bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white px-4 py-1.5 rounded-lg transition font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-xs"
            >
              <SaveAll className="w-3 h-3" />
              <span>{loading ? "Saving..." : "Save All Transactions"}</span>
            </button>
          )}
        </div>
      )}

    </div>
  );
}

// Helper function to get previous date for display
function getPreviousDate(currentDate) {
  const date = new Date(currentDate);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split("T")[0];
}