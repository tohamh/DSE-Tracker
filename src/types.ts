export type PortfolioType = "Global" | "Investment" | "Trading";

export type TransactionType =
  | "Buy"
  | "Sell"
  | "Deposit"
  | "Withdrawal"
  | "Charge"
  | "Dividend";

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  portfolio: PortfolioType;
  ticker: string;
  companyName: string;
  qty: number;
  price: number;
  commission: number;
  total: number;
  notes?: string;
}

export interface Settings {
  commissionRate: number;
}

export interface CustomStock {
  ticker: string;
  companyName: string;
}

export type ActiveSection =
  | "Dashboard"
  | "Transaction"
  | "Holdings"
  | "Analytics"
  | "Import"
  | "Settings";
