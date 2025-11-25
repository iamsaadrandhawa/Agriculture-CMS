export interface Bank {
  id: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  balance: number;
  createdAt: string;
  updatedAt?: string;
}

export interface LedgerCode {
  id: string;
  code: string;
  category: string;
  subCategory: string;
  is_active: boolean;
}

export interface BankManagerProps {
  role: string;
  banksData: Bank[];
  setBanksData: (banks: Bank[]) => void;
  dailyTransactionsData: any[];
  storeTransactionsData: any[];
}