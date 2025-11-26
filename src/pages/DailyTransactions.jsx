import { useState, useEffect } from "react";
import { Plus, Download, SaveAll, Trash2, Calendar, Tag, Edit, EyeIcon, Lock, Clock, Search, X, ClipboardPlus } from "lucide-react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, query, where, addDoc, orderBy, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import CountdownTimer from './CountdownTimer';
import { getCurrentUser } from "../components/userUtils";
import { parse } from "postcss";

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

  // Search states
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState("");
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [openDropdowns, setOpenDropdowns] = useState({
    ledger: null,
    employee: null
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);

        const currentUserData = await getCurrentUser(user.uid);
        setUserRole(currentUserData?.role || "read");

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setOpenDropdowns({ ledger: null, employee: null });
        setLedgerSearchTerm("");
        setEmployeeSearchTerm("");
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadLedgerCodes = async (uid) => {
    try {
      const q = query(
        collection(db, "ledger_codes"),
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
      const q = query(collection(db, "employees"));
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
        where("transaction_date", "==", date)
      );
      const snapshot = await getDocs(q);

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

      const sortedTransactions = regularTransactions.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : (a.created_at?.toDate().getTime() || 0);
        const orderB = b.order !== undefined ? b.order : (b.created_at?.toDate().getTime() || 0);
        return orderA - orderB;
      });

      setRows(sortedTransactions);

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

      // First, check if there's a manual balance entry for the selected date
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

      // If no manual balance entry, calculate from previous day's closing balance
      const currentDate = new Date(date);
      const previousDate = new Date(currentDate);
      previousDate.setDate(currentDate.getDate() - 1);
      const previousDateStr = previousDate.toISOString().split("T")[0];
      console.log("📅 Looking for previous day:", previousDateStr);

      // Get previous day's balance entry
      const prevDayBalanceQuery = query(
        collection(db, "transactions"),
        where("transaction_date", "==", previousDateStr),
        where("is_balance_entry", "==", true)
      );
      const prevDayBalanceSnapshot = await getDocs(prevDayBalanceQuery);

      if (!prevDayBalanceSnapshot.empty) {
        // Use the previous day's closing balance as today's opening balance
        const prevBalanceData = prevDayBalanceSnapshot.docs[0].data();
        const previousBalance = prevBalanceData.previous_balance || 0;

        // Get previous day's transactions to calculate the actual closing balance
        const prevDayTxnsQuery = query(
          collection(db, "transactions"),
          where("transaction_date", "==", previousDateStr),
          where("is_balance_entry", "==", false)
        );
        const prevDayTxnsSnapshot = await getDocs(prevDayTxnsQuery);

        let prevDayRecovery = 0;
        let prevDayExpense = 0;

        prevDayTxnsSnapshot.forEach(doc => {
          const data = doc.data();
          prevDayRecovery += (parseFloat(data.cash_in || 0) + parseFloat(data.bank_in || 0));
          prevDayExpense += (parseFloat(data.expenditure_out || 0) + parseFloat(data.expenditure_cash || 0));
        });

        const prevDayNetBalance = prevDayRecovery - prevDayExpense;
        const prevDayClosingBalance = previousBalance + prevDayNetBalance;

        console.log("📊 Previous day calculation:");
        console.log("  - Opening balance:", previousBalance);
        console.log("  - Recovery:", prevDayRecovery);
        console.log("  - Expense:", prevDayExpense);
        console.log("  - Net balance:", prevDayNetBalance);
        console.log("  - Closing balance:", prevDayClosingBalance);

        setPreviousBalance(prevDayClosingBalance);
        return;
      }

      // If no previous day balance entry found, calculate cumulative balance up to yesterday
      console.log("🔍 No previous day balance entry, calculating cumulative balance...");

      const allBeforeTodayQuery = query(
        collection(db, "transactions"),
        where("transaction_date", "<", date),
        where("is_balance_entry", "==", false)
      );
      const allBeforeTodaySnapshot = await getDocs(allBeforeTodayQuery);

      let cumulativeBalance = 0;
      let transactionCount = 0;

      allBeforeTodaySnapshot.forEach(doc => {
        const data = doc.data();
        const recovery = parseFloat(data.cash_in || 0) + parseFloat(data.bank_in || 0);
        const expense = parseFloat(data.expenditure_out || 0) + parseFloat(data.expenditure_cash || 0);
        const net = recovery - expense;
        cumulativeBalance += net;
        transactionCount++;
      });

      console.log(`📈 Cumulative balance calculation:`);
      console.log(`  - Transactions processed: ${transactionCount}`);
      console.log(`  - Cumulative balance: ${cumulativeBalance}`);

      setPreviousBalance(cumulativeBalance);

    } catch (error) {
      console.error("❌ Error loading previous balance:", error);
      setPreviousBalance(0);
    }
  };

  const addRow = () => {
    const newRow = {
      id: `temp-${Date.now()}-${Math.random()}`,
      ledger_code_id: "",
      employee_id: "",
      cash_in: "",
      bank_in: "",
      expenditure_out: "",
      expenditure_cash: "",
      description: "",
      order: rows.length,
      is_balance_entry: false,
      user_id: userId,
      date: selectedDate,
    };

    setRows([...rows, newRow]);
  };

  const deleteRow = async (index) => {
    const rowToDelete = rows[index];

    if (rowToDelete.id && !rowToDelete.id.startsWith('temp-')) {
      try {
        await deleteDoc(doc(db, "transactions", rowToDelete.id));
      } catch (error) {
        console.error("Error deleting transaction:", error);
        alert(`Error deleting transaction: ${error.message}`);
        return;
      }
    }

    const newRows = rows.filter((_, i) => i !== index);
    const updatedRows = newRows.map((row, newIndex) => ({
      ...row,
      order: newIndex
    }));

    setRows(updatedRows);
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

    // Filter valid rows and remove duplicates
    const validRows = rows.filter(
      (row, index, self) =>
        !row.is_balance_entry &&
        row.ledger_code_id &&
        row.description &&
        (
          (row.cash_in && parseFloat(row.cash_in) > 0) ||
          (row.bank_in && parseFloat(row.bank_in) > 0) ||
          (row.expenditure_out && parseFloat(row.expenditure_out) > 0) ||
          (row.expenditure_cash && parseFloat(row.expenditure_cash) > 0)
        ) &&
        // Remove duplicates by checking if this is the first occurrence of this row
        self.findIndex(r =>
          r.ledger_code_id === row.ledger_code_id &&
          r.description === row.description &&
          r.cash_in === row.cash_in &&
          r.bank_in === row.bank_in &&
          r.expenditure_out === row.expenditure_out &&
          r.expenditure_cash === row.expenditure_cash
        ) === index
    );

    if (validRows.length === 0) {
      alert("No valid transactions to save. Please fill in required fields (Ledger Code, Description, and at least one amount field).");
      setLoading(false);
      return;
    }

    try {
      console.log("💾 Saving transactions:", validRows.length);

      // Use Promise.allSettled to avoid partial failures causing duplicates
      const saveResults = await Promise.allSettled(
        validRows.map(async (row, index) => {
          const txnData = {
            transaction_date: selectedDate,
            ledger_code_id: row.ledger_code_id,
            employee_id: row.employee_id || null,
            cash_in: parseFloat(row.cash_in || 0),
            bank_in: parseFloat(row.bank_in || 0),
            expenditure_out: parseFloat(row.expenditure_out || 0),
            expenditure_cash: parseFloat(row.expenditure_cash || 0),
            description: row.description.trim(),
            order: row.order !== undefined ? row.order : index,
            user_id: userId,
            is_balance_entry: false,
            updated_at: new Date(),
          };

          if (row.id && !row.id.startsWith('temp-')) {
            // Update existing transaction
            const docRef = doc(db, "transactions", row.id);
            await updateDoc(docRef, txnData);
            console.log("✅ Updated transaction:", row.id);
            return { type: 'updated', id: row.id };
          } else {
            // Create new transaction
            const docRef = await addDoc(collection(db, "transactions"), {
              ...txnData,
              created_at: new Date(),
            });
            console.log("✅ Created transaction:", docRef.id);
            return { type: 'created', id: docRef.id };
          }
        })
      );

      // Check for failures
      const failures = saveResults.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.error("❌ Some transactions failed to save:", failures);
        alert(`Warning: ${failures.length} transactions failed to save. Check console for details.`);
      }

      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split("T")[0];

      // Calculate today's totals
      const totalExpense = validRows.reduce(
        (acc, row) =>
          acc +
          (parseFloat(row.expenditure_out || 0) +
            parseFloat(row.expenditure_cash || 0)),
        0
      );

      const totalRecovery = validRows.reduce(
        (acc, row) =>
          acc + (parseFloat(row.cash_in || 0) + parseFloat(row.bank_in || 0) + (parseFloat(row.expenditure_out || 0))),
        0
      );

      const todayNetBalance = totalRecovery - totalExpense;
      const closingBalance = previousBalance + todayNetBalance;

      console.log("💾 Saving balance data:");
      console.log("  - Previous Balance:", previousBalance);
      console.log("  - Total Recovery:", totalRecovery);
      console.log("  - Total Expense:", totalExpense);
      console.log("  - Today Net Balance:", todayNetBalance);
      console.log("  - Closing Balance:", closingBalance);

      // Update or create TODAY'S balance entry
      const todayBalanceQuery = query(
        collection(db, "transactions"),
        where("transaction_date", "==", selectedDate),
        where("is_balance_entry", "==", true)
      );

      const todayBalanceSnapshot = await getDocs(todayBalanceQuery);

      const todayBalanceData = {
        transaction_date: selectedDate,
        previous_balance: previousBalance,
        total_balance: closingBalance,
        description: `Daily balance for ${selectedDate}`,
        is_balance_entry: true,
        user_id: userId,
        updated_at: new Date(),
      };

      if (!todayBalanceSnapshot.empty) {
        const todayBalanceRef = doc(db, "transactions", todayBalanceSnapshot.docs[0].id);
        await updateDoc(todayBalanceRef, todayBalanceData);
        console.log("✅ Updated today's balance entry");
      } else {
        await addDoc(collection(db, "transactions"), {
          ...todayBalanceData,
          created_at: new Date(),
        });
        console.log("✅ Created today's balance entry");
      }

      // Update or create TOMORROW'S balance entry
      const nextBalanceQuery = query(
        collection(db, "transactions"),
        where("transaction_date", "==", nextDateStr),
        where("is_balance_entry", "==", true)
      );

      const nextBalanceSnapshot = await getDocs(nextBalanceQuery);

      const nextBalanceData = {
        transaction_date: nextDateStr,
        previous_balance: closingBalance,
        description: `Auto carry forward from ${selectedDate}`,
        is_balance_entry: true,
        user_id: userId,
        updated_at: new Date(),
      };

      if (!nextBalanceSnapshot.empty) {
        const docRef = doc(db, "transactions", nextBalanceSnapshot.docs[0].id);
        await updateDoc(docRef, nextBalanceData);
        console.log("✅ Updated tomorrow's balance entry");
      } else {
        await addDoc(collection(db, "transactions"), {
          ...nextBalanceData,
          created_at: new Date(),
        });
        console.log("✅ Created tomorrow's balance entry");
      }

      // Clear the rows after successful save to prevent double-saving
      setRows([]);

      alert(`✅ ${validRows.length} transactions saved successfully!\n\nToday's closing balance (${closingBalance.toFixed(0)}) has been carried forward to ${nextDateStr} as previous balance.`);

      // Reload data to reflect changes
      await loadTransactions(selectedDate, userId);
      await loadPreviousBalance(selectedDate, userId);

    } catch (error) {
      console.error("❌ Error saving transactions:", error);
      alert(`Error saving transactions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

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
        acc + (parseFloat(row.cash_in || 0) + parseFloat(row.bank_in || 0) + (parseFloat(row.expenditure_out || 0))),
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

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Agricultre CMS", 40, 40);
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Daily Transactions Report", 40, 60);

      doc.setFontSize(10);
      doc.text(`Date: ${reportDate}`, doc.internal.pageSize.getWidth() - 120, 60, { align: "right" });

      doc.setProperties({
        title: "Agricultre-cms Daily Transactions Report",
        subject: "Auto-generated PDF Report",
        author: "Agricultre CMS System",
        creator: "Agricultre CMS",
      });

      const tableHead = [
        ["Ledger Code", "Employee", "Cash In", "Bank In", "Exp Out", "Exp Cash", "Description", "Type"],
      ];

      const sortedRows = [...rows].sort((a, b) => (a.order || 0) - (b.order || 0));

      const tableBody = [
        ...sortedRows
          .filter((row) => !row.is_balance_entry)
          .map((row) => {
            const ledger = ledgerCodes.find((l) => l.id === row.ledger_code_id);
            const employee = employees.find((e) => e.id === row.employee_id);

            // Determine transaction type based on actual amounts entered
            let transactionType = "Mixed";
            const hasIncome = (row.cash_in && parseFloat(row.cash_in) > 0) || (row.bank_in && parseFloat(row.bank_in) > 0);
            const hasExpense = (row.expenditure_out && parseFloat(row.expenditure_out) > 0) || (row.expenditure_cash && parseFloat(row.expenditure_cash) > 0);

            if (hasIncome && !hasExpense) transactionType = "Income";
            else if (!hasIncome && hasExpense) transactionType = "Expense";
            else if (hasIncome && hasExpense) transactionType = "Mixed";

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
        headStyles: { fillColor: [0, 159, 60], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 10, cellPadding: 6 },
        alternateRowStyles: { fillColor: [240, 240, 240] },
      });

      let finalY = doc.lastAutoTable.finalY + 25;

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
        doc.text("Generated by Agricultre CMS System", 40, doc.internal.pageSize.getHeight() - 20, { align: "left" });
      }

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

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Agricultre CMS", 14, 15);
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Daily Transactions Report", 14, 23);

      const reportDate = new Date().toISOString().split("T")[0];
      doc.setFontSize(10);
      doc.text(`Date: ${reportDate}`, 170, 23, { align: "right" });

      doc.setProperties({
        title: "Agricultre CMS Transactions Report",
        subject: "Auto-generated PDF Report",
        author: "Agricultre CMS System",
        creator: "Agricultre CMS",
      });

      const tableHead = [
        ["Ledger Code", "Employee", "Cash In", "Bank In", "Exp Out", "Exp Cash", "Description", "Type"],
      ];

      const sortedRows = [...rows].sort((a, b) => (a.order || 0) - (b.order || 0));

      const tableBody = [
        ...sortedRows
          .filter((row) => !row.is_balance_entry)
          .map((row) => {
            const ledger = ledgerCodes.find((l) => l.id === row.ledger_code_id);
            const employee = employees.find((e) => e.id === row.employee_id);

            // Determine transaction type based on actual amounts entered
            let transactionType = "Mixed";
            const hasIncome = (row.cash_in && parseFloat(row.cash_in) > 0) || (row.bank_in && parseFloat(row.bank_in) > 0);
            const hasExpense = (row.expenditure_out && parseFloat(row.expenditure_out) > 0) || (row.expenditure_cash && parseFloat(row.expenditure_cash) > 0);

            if (hasIncome && !hasExpense) transactionType = "Income";
            else if (!hasIncome && hasExpense) transactionType = "Expense";
            else if (hasIncome && hasExpense) transactionType = "Mixed";

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
        headStyles: { fillColor: [0, 159, 60], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 10, cellPadding: 2 },
        alternateRowStyles: { fillColor: [240, 240, 240] },
      });

      let finalY = doc.lastAutoTable.finalY + 10;

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`Balance Summary - ${reportDate}`, 14, finalY);
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
        doc.text("Generated by Agricultre CMS System", 14, doc.internal.pageSize.getHeight() - 10);
      }

      doc.save(`Agricultre CMS_Daily_Report_${reportDate}.pdf`);
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
      setIsDayLocked(false);
      return;
    }

    if (userRole === "read") {
      setIsDayLocked(true);
      return;
    }

    if (userRole === "write") {
      if (selected.getTime() === today.getTime()) {
        setIsDayLocked(false);
      } else {
        setIsDayLocked(true);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!isDayLocked && rows.length > 0 && !loading) {
          handleSaveAll();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDayLocked, rows.length, loading]);

  const getPreviousDate = (currentDate) => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split("T")[0];
  };

  // Filter functions for search
  const filteredLedgers = ledgerCodes.filter(ledger =>
    ledger.code.toLowerCase().includes(ledgerSearchTerm.toLowerCase()) ||
    (ledger.name || '').toLowerCase().includes(ledgerSearchTerm.toLowerCase()) ||
    (ledger.subCategory || '').toLowerCase().includes(ledgerSearchTerm.toLowerCase()) ||
    (ledger.description || '').toLowerCase().includes(ledgerSearchTerm.toLowerCase())
  );
  

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    (employee.designation || '').toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    (employee.email || '').toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  // Function to determine transaction type based on actual amounts
  const getTransactionType = (row) => {
    const hasIncome = (row.cash_in && parseFloat(row.cash_in) > 0) || (row.bank_in && parseFloat(row.bank_in) > 0);
    const hasExpense = (row.expenditure_out && parseFloat(row.expenditure_out) > 0) || (row.expenditure_cash && parseFloat(row.expenditure_cash) > 0);
    if (hasIncome && !hasExpense) return "Income";
    if (!hasIncome && hasExpense) return "Expense";
    if (hasIncome && hasExpense) return "Mixed";

    return "Select Amount";
  };

  return (
    <div className="w-full flex flex-col p-4 rounded-lg text-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
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
        {isDayLocked && (
          <div className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg font-semibold text-xs">
            <Lock className="w-4 h-4" />
            Locked! - This day cannot be modified after 11:59 PM
          </div>
        )}

        {!isDayLocked && <CountdownTimer />}

        <div className="flex flex-wrap gap-4 text-xs">
          {userRole === "read" || isDayLocked ? (
            <div className="flex items-center gap-1 bg-gray-400 text-gray-200 cursor-not-allowed px-4 py-1.5 rounded-lg font-semibold shadow-md text-xs">
              <Lock className="w-3 h-3" /> Locked
            </div>
          ) : (
            <button
              onClick={addRow}
              disabled={userRole === "read" || isDayLocked}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg transition font-semibold shadow-md text-xs bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white"
            >
              <Plus className="w-3 h-3" /> Add Row
            </button>
          )}

          <button
            onClick={handleViewReport}
            className="flex items-center gap-1 bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white px-4 py-1.5 rounded-lg transition font-semibold shadow-md text-xs"
          >
            <EyeIcon className="w-3 h-3" /> View Report
          </button>

          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1 bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white px-4 py-1.5 rounded-lg transition font-semibold shadow-md text-xs"
          >
            <Download className="w-3 h-3" /> Download PDF
          </button>
        </div>
      </div>



      <div className="w-full border border-gray-300 rounded-lg bg-white shadow-sm text-xs mb-6">
        <div className="min-w-[1000px]">
          {/* Green Theme Header */}
          <div className="grid grid-cols-9 gap-15 mb-2 px-3 py-2 font-semibold text-white text-xs bg-gradient-to-r from-green-600 to-green-700 rounded-t-lg">
            <div className="flex items-center">Ledger Code</div>
            <div className="flex items-center">Employee</div>
            <div className="flex items-center justify-end">Cash In</div>
            <div className="flex items-center justify-end">Bank In</div>
            <div className="flex items-center justify-end">Exp Out</div>
            <div className="flex items-center justify-end">Exp Cash</div>
            <div className="flex items-center">Description</div>
            <div className="flex items-center">Type</div>
            <div className="flex items-center justify-center">Action</div>
          </div>

          <div className="space-y-1 mb-1">
            {rows
              .filter(row => !row.is_balance_entry)
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((row, index) => {
                const selectedLedger = ledgerCodes.find((lc) => lc.id === row.ledger_code_id);
                const selectedEmployee = employees.find((emp) => emp.id === row.employee_id);
                const transactionType = getTransactionType(row);

                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-9 gap-2 mb-1 px-3 items-center bg-white rounded-lg shadow-sm hover:shadow-md transition py-1 text-xs"
                  >
                   {/* Ledger Code with Search */}
<div className="relative dropdown-container">
  <div className="relative">
    <button
      type="button"
      onClick={() => setOpenDropdowns(prev => ({
        ...prev,
        ledger: openDropdowns.ledger === index ? null : index
      }))}
      className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-left focus:outline-none focus:ring-2 focus:ring-green-500 bg-white flex justify-between items-center"
    >
      <span className="truncate">
        {row.ledger_code_id ? (
          selectedLedger?.code || "Select Ledger"
        ) : (
          "Select Ledger"
        )}
      </span>
      <Search className="w-3 h-3 text-gray-400" />
    </button>

    {openDropdowns.ledger === index && (
      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
        {/* Search Input */}
        <div className="sticky top-0 bg-white p-2 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search ledger..."
              value={ledgerSearchTerm}
              onChange={(e) => setLedgerSearchTerm(e.target.value)}
              className="w-full pl-8 pr-6 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
              autoFocus
            />
            {ledgerSearchTerm && (
              <button
                onClick={() => setLedgerSearchTerm("")}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Filtered Options */}
        <div className="py-1 max-h-48 overflow-y-auto">
          {filteredLedgers.map((ledger) => (
            <button
              key={ledger.id}
              type="button"
              onClick={() => {
                handleInputChange(index, "ledger_code_id", ledger.id);
                setOpenDropdowns(prev => ({ ...prev, ledger: null }));
                setLedgerSearchTerm("");
              }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex flex-col ${row.ledger_code_id === ledger.id ? 'bg-blue-100 text-blue-800' : 'text-gray-700'
                }`}
            >
              {/* Main Code and Name */}
              <div className="font-medium">{ledger.code}</div>
              <div className="text-gray-500 text-[10px] truncate">
                {ledger.name || ledger.description || 'No description'}
              </div>
              
              {/* Category and SubCategory in one line */}
              <div className="flex gap-1 mt-1">
                {/* Main Category */}
                <div className={`text-[9px] px-1 rounded ${ledger.category === 'income'
                    ? 'bg-green-100 text-green-800'
                    : ledger.category === 'expense'
                    ? 'bg-red-100 text-red-800'
                    : ledger.category === 'asset'
                    ? 'bg-blue-100 text-blue-800'
                    : ledger.category === 'liability'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-gray-100 text-gray-600'
                  }`}>
                  {ledger.category || 'uncategorized'}
                </div>

                {/* SubCategory */}
                {ledger.subCategory && (
                  <div className={`text-[9px] px-1 rounded ${ledger.subCategory === 'cash'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : ledger.subCategory === 'bank'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : ledger.subCategory === 'receivable'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : ledger.subCategory === 'payable'
                      ? 'bg-orange-50 text-orange-700 border border-orange-200'
                      : ledger.subCategory === 'inventory'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'bg-gray-50 text-gray-600 border border-gray-200'
                    }`}>
                    {ledger.subCategory}
                  </div>
                )}
              </div>

              {/* Additional details if available */}
              {(ledger.accountType || ledger.nature) && (
                <div className="text-[8px] text-gray-400 mt-0.5">
                  {[ledger.accountType, ledger.nature].filter(Boolean).join(' • ')}
                </div>
              )}
            </button>
          ))}

          {filteredLedgers.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500 text-center">
              No ledgers found
            </div>
          )}
        </div>
      </div>
    )}
  </div>
</div>

                    {/* Employee with Search */}
                    <div className="relative dropdown-container">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenDropdowns(prev => ({
                            ...prev,
                            employee: openDropdowns.employee === index ? null : index
                          }))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-left focus:outline-none focus:ring-2 focus:ring-green-500 bg-white flex justify-between items-center"
                        >
                          <span className="truncate">
                            {row.employee_id ? (
                              selectedEmployee?.name || "Select Employee"
                            ) : (
                              "Select Employee"
                            )}
                          </span>
                          <Search className="w-3 h-3 text-gray-400" />
                        </button>

                        {openDropdowns.employee === index && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {/* Search Input */}
                            <div className="sticky top-0 bg-white p-2 border-b border-gray-200">
                              <div className="relative">
                                <Search className="absolute left-1 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Search employee..."
                                  value={employeeSearchTerm}
                                  onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                                  className="w-full pl-8 pr-6 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                  autoFocus
                                />
                                {employeeSearchTerm && (
                                  <button
                                    onClick={() => setEmployeeSearchTerm("")}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Filtered Options */}
                            <div className="py-1 max-h-48 overflow-y-auto">
                              {filteredEmployees.map((employee) => (
                                <button
                                  key={employee.id}
                                  type="button"
                                  onClick={() => {
                                    handleInputChange(index, "employee_id", employee.id);
                                    setOpenDropdowns(prev => ({ ...prev, employee: null }));
                                    setEmployeeSearchTerm("");
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex flex-col ${row.employee_id === employee.id ? 'bg-blue-100 text-blue-800' : 'text-gray-700'
                                    }`}
                                >
                                  <div className="font-medium">{employee.name}</div>
                                  {employee.designation && (
                                    <div className="text-gray-500 text-[10px] truncate">{employee.designation}</div>
                                  )}
                                </button>
                              ))}

                              {filteredEmployees.length === 0 && (
                                <div className="px-3 py-2 text-xs text-gray-500 text-center">
                                  No employees found
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cash In */}
                    <input
                      type="number"
                      value={row.cash_in}
                      placeholder="0"
                      onChange={(e) =>
                        handleInputChange(index, "cash_in", e.target.value)
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-xs text-black focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-50"
                    />

                    {/* Bank In */}
                    <input
                      type="number"
                      value={row.bank_in}
                      placeholder="0"
                      onChange={(e) =>
                        handleInputChange(index, "bank_in", e.target.value)
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-xs text-black focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-50"
                    />

                    {/* Exp Out */}
                    <input
                      type="number"
                      value={row.expenditure_out}
                      placeholder="0"
                      onChange={(e) =>
                        handleInputChange(index, "expenditure_out", e.target.value)
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-xs text-black focus:outline-none focus:ring-2 focus:ring-green-500 bg-red-50"
                    />

                    {/* Exp Cash */}
                    <input
                      type="number"
                      value={row.expenditure_cash}
                      placeholder="0"
                      onChange={(e) =>
                        handleInputChange(index, "expenditure_cash", e.target.value)
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-xs text-black focus:outline-none focus:ring-2 focus:ring-green-500 bg-red-50"
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
                            : transactionType === "Mixed"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-gray-100 text-gray-600"
                        }`}
                    >
                      {transactionType}
                    </div>

                    {/* Delete */}
                    {userRole === "read" || isDayLocked ? (
                      <div className="flex items-center gap-2">
                        {/* Locked Delete Button */}
                        <div className="text-gray-400 flex items-center gap-1 cursor-not-allowed">
                          <Lock className="w-3 h-3" />
                          <span className="text-xs">Locked</span>
                        </div>

                        {/* Locked Add Button */}
                        <div className="text-gray-400 flex items-center gap-1 cursor-not-allowed">
                          <Lock className="w-3 h-3" />
                          <ClipboardPlus className="w-3 h-3" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {/* Delete Button */}
                        <button
                          onClick={() => deleteRow(index)}
                          className="text-red-500 hover:text-red-700 transition p-1 rounded hover:bg-red-50"
                          title="Delete row"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>

                        {/* Add New Row Button */}
                        <button
                          onClick={addRow}
                          className="text-green-600 hover:text-green-800 transition p-1 rounded hover:bg-green-50"
                          title="Add new row"
                        >
                          <ClipboardPlus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Table Footer with Totals */}
          {rows.filter(row => !row.is_balance_entry).length > 0 && (
            <div className="border-t border-gray-300 bg-gray-50 rounded-b-lg px-3 py-2">
              <div className="grid grid-cols-9 gap-2 px-3 py-2 font-semibold text-gray-800 text-xs">
                <div className="flex items-center">
                  <span className="font-bold">TOTALS:</span>
                </div>
                <div></div> {/* Empty column for Employee */}

                {/* Total Cash In */}
                <div className="bg-green-100 border border-green-300 rounded px-2 py-1 text-green-800 font-bold text-right">
                  {rows
                    .filter(row => !row.is_balance_entry)
                    .reduce((sum, row) => sum + parseFloat(row.cash_in || 0), 0)
                    .toFixed(0)}
                </div>

                {/* Total Bank In */}
                <div className="bg-green-100 border border-green-300 rounded px-2 py-1 text-green-800 font-bold text-right">
                  {rows
                    .filter(row => !row.is_balance_entry)
                    .reduce((sum, row) => sum + parseFloat(row.bank_in || 0), 0)
                    .toFixed(0)}
                </div>

                {/* Total Exp Out */}
                <div className="bg-red-100 border border-red-300 rounded px-2 py-1 text-red-800 font-bold text-right">
                  {rows
                    .filter(row => !row.is_balance_entry)
                    .reduce((sum, row) => sum + parseFloat(row.expenditure_out || 0), 0)
                    .toFixed(0)}
                </div>

                {/* Total Exp Cash */}
                <div className="bg-red-100 border border-red-300 rounded px-2 py-1 text-red-800 font-bold text-right">
                  {rows
                    .filter(row => !row.is_balance_entry)
                    .reduce((sum, row) => sum + parseFloat(row.expenditure_cash || 0), 0)
                    .toFixed(0)}
                </div>

                <div></div> {/* Empty column for Description */}
                <div></div> {/* Empty column for Type */}
                <div></div> {/* Empty column for Action */}
              </div>
            </div>
          )}
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
            }`}
          >
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