import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, DocumentSnapshot } from 'firebase/firestore';

// Define the structure of the cash document in Firestore
interface CashDocument {
  balance: number;
  updatedAt: Date;
  createdAt?: Date;
}

// Define the return type of the hook
interface UseGlobalCashReturn {
  cashBalance: number;
  loading: boolean;
  error: string | null;
  updateCashBalance: (newBalance: number) => Promise<boolean>;
  refreshCashBalance: () => void;
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
        updatedAt: new Date(),
        createdAt: new Date()
      };
      await setDoc(cashDocRef, initialData);
      console.log("✅ Cash balance initialized in Firestore");
    } catch (error) {
      console.error("Error initializing cash balance:", error);
      setError("Failed to initialize cash balance");
    }
  };

  // Update cash balance in Firestore
  const updateCashBalance = async (newBalance: number): Promise<boolean> => {
    try {
      setLoading(true);
      const updateData: Partial<CashDocument> = { 
        balance: parseFloat(newBalance.toString()) || 0,
        updatedAt: new Date() 
      };
      await setDoc(cashDocRef, updateData, { merge: true });
      return true;
    } catch (error) {
      console.error("Error updating cash balance:", error);
      setError("Failed to update cash balance");
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

    loadCashBalance();

    // Real-time listener for cash balance updates
    const unsubscribe = onSnapshot(
      cashDocRef, 
      (doc: DocumentSnapshot) => {
        if (doc.exists()) {
          const cashData = doc.data() as CashDocument;
          const newBalance = parseFloat(cashData.balance.toString()) || 0;
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

  const refreshCashBalance = (): void => {
    getDoc(cashDocRef).then((doc: DocumentSnapshot) => {
      if (doc.exists()) {
        const cashData = doc.data() as CashDocument;
        setCashBalance(parseFloat(cashData.balance.toString()) || 0);
      }
    });
  };

  return { 
    cashBalance, 
    loading, 
    error, 
    updateCashBalance,
    refreshCashBalance
  };
};