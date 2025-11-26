import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  DocumentSnapshot,
  DocumentData 
} from 'firebase/firestore';

// Define the structure of the cash document in Firestore
interface CashDocument {
  balance: number;
  updatedAt: string;
  createdAt?: string;
}

// Define the return type of the hook
interface UseGlobalCashReturn {
  cashBalance: number;
  loading: boolean;
  error: string | null;
  updateCashBalance: (amount: number) => Promise<boolean>;
  refreshCashBalance: () => Promise<void>;
}

export const useGlobalCash = (): UseGlobalCashReturn => {
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const cashDocRef = doc(db, "globalcash", "current_balance");

  // Initialize cash balance if not exists
  const initializeCashBalance = async (): Promise<void> => {
    try {
      const initialData: CashDocument = { 
        balance: 0, 
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      await setDoc(cashDocRef, initialData);
      console.log("✅ Cash balance initialized in Firestore");
    } catch (error) {
      console.error("Error initializing cash balance:", error);
      setError("Failed to initialize cash balance");
    }
  };

  // Update cash balance in Firestore - FIXED VERSION
  const updateCashBalance = async (amount: number): Promise<boolean> => {
    try {
      setLoading(true);
      
      // Calculate new balance by ADDING the amount (negative amounts will subtract)
      const newBalance = cashBalance + amount;
      
      console.log('💰 Updating cash balance:', { 
        currentBalance: cashBalance, 
        amount, 
        newBalance 
      });

      const updateData: Partial<CashDocument> = { 
        balance: newBalance,
        updatedAt: new Date().toISOString() 
      };
      
      await setDoc(cashDocRef, updateData, { merge: true });
      
      // Update local state immediately
      setCashBalance(newBalance);
      
      console.log('✅ Cash balance updated successfully');
      return true;
    } catch (error) {
      console.error("Error updating cash balance:", error);
      setError("Failed to update cash balance");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Load cash balance
  const loadCashBalance = async (): Promise<void> => {
    try {
      setLoading(true);
      const cashDoc: DocumentSnapshot = await getDoc(cashDocRef);
      
      if (cashDoc.exists()) {
        const cashData = cashDoc.data() as CashDocument;
        const balance = parseFloat(cashData.balance.toString()) || 0;
        setCashBalance(balance);
        console.log("✅ Cash balance loaded from Firestore:", balance);
      } else {
        // Initialize if document doesn't exist
        await initializeCashBalance();
        setCashBalance(0);
      }
    } catch (error) {
      console.error("Error loading cash balance:", error);
      setError("Failed to load cash balance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCashBalance();

    // Real-time listener for cash balance updates
    const unsubscribe = onSnapshot(
      cashDocRef, 
      (doc: DocumentSnapshot) => {
        if (doc.exists()) {
          const cashData = doc.data() as CashDocument;
          const newBalance = parseFloat(cashData.balance.toString()) || 0;
          console.log('🔄 Real-time cash balance update:', newBalance);
          setCashBalance(newBalance);
        }
      }, 
      (error: Error) => {
        console.error("Error in cash balance listener:", error);
        setError("Real-time sync error");
      }
    );

    return () => unsubscribe();
  }, []);

  const refreshCashBalance = async (): Promise<void> => {
    await loadCashBalance();
  };

  return { 
    cashBalance, 
    loading, 
    error, 
    updateCashBalance,
    refreshCashBalance
  };
};