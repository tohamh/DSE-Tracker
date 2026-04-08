const API_URL = "https://script.google.com/macros/s/AKfycbyiyC2JMwA_zGCNZZ6EdS9OdTBKesA6CLpcDy7JOfkLMcqPQv2xofrHvExBdIPgJMVi/exec";

import { useState, useMemo, useEffect } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Briefcase,
  TrendingUp,
  FileUp,
  Settings as SettingsIcon,
  Plus,
  Menu,
  Home,
  Wallet,
  PieChart,
  Lock,
  Sun,
  Moon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLocalStorage } from "./hooks/useLocalStorage";
import {
  Transaction,
  Settings,
  CustomStock,
  ActiveSection,
  PortfolioType
} from "./types";
import { DSE_STOCKS } from "./constants";
import { cn } from "./lib/utils";
import { calculatePortfolioStats } from "./lib/portfolioUtils";

import Dashboard from "./components/Dashboard";
import Transactions from "./components/Transactions";
import Holdings from "./components/Holdings";
import Analytics from "./components/Analytics";
import ImportExport from "./components/ImportExport";
import SettingsSection from "./components/Settings";
import AddTransactionModal from "./components/AddTransactionModal";
import DeleteConfirmationModal from "./components/DeleteConfirmationModal";
import PinLogin from "./components/PinLogin";
import ErrorBoundary from "./components/ErrorBoundary";

const DEFAULT_PIN = "0923202350";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useLocalStorage<Settings>("dse_settings", { commissionRate: 0.40 });
  const [customStocks, setCustomStocks] = useLocalStorage<CustomStock[]>("dse_custom_stocks", []);
  const [activeSection, setActiveSection] = useState<ActiveSection>("Dashboard");
  const [activePortfolio, setActivePortfolio] = useState<PortfolioType>("Global");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [darkMode, setDarkMode] = useLocalStorage<boolean>("dse_dark_mode", true);

  // 🔥 LOAD DATA FROM GOOGLE SHEETS
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch(API_URL);
        const data = await res.json();
        setTransactions(data || []);
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    loadData();
  }, []);

  // Dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Stats
  const stats = useMemo(() => calculatePortfolioStats(transactions, activePortfolio), [transactions, activePortfolio]);
  const allStats = useMemo(() => calculatePortfolioStats(transactions, "Global"), [transactions]);
  const investmentStats = useMemo(() => calculatePortfolioStats(transactions, "Investment"), [transactions]);
  const tradingStats = useMemo(() => calculatePortfolioStats(transactions, "Trading"), [transactions]);

  const allStocks = useMemo(() => {
    const stockMap = new Map<string, CustomStock>();
    DSE_STOCKS.forEach(s => stockMap.set(s.ticker, s));
    customStocks.forEach(s => stockMap.set(s.ticker, s));
    return Array.from(stockMap.values());
  }, [customStocks]);

  // 🔥 ADD TRANSACTION (SAVE TO GOOGLE SHEET)
  const handleAddTransaction = async (newTransaction: Transaction) => {
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newTransaction)
      });

      setTransactions([newTransaction, ...transactions]);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error("Error saving:", error);
    }
  };

  // ❗ Local delete only (simple version)
  const handleDeleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
    setTransactionToDelete(null);
  };

  const renderSection = () => {
    switch (activeSection) {
      case "Dashboard":
        return <Dashboard stats={stats} transactions={transactions} />;
      case "Transaction":
        return (
          <Transactions
            transactions={transactions}
            onDelete={setTransactionToDelete}
            onEdit={(t) => { setEditingTransaction(t); setIsAddModalOpen(true); }}
          />
        );
      case "Holdings":
        return <Holdings stats={stats} />;
      case "Analytics":
        return <Analytics transactions={transactions} stats={stats} />;
      case "Import":
        return <ImportExport transactions={transactions} setTransactions={setTransactions} />;
      case "Settings":
        return <SettingsSection settings={settings} setSettings={setSettings} />;
      default:
        return <Dashboard stats={stats} transactions={transactions} />;
    }
  };

  if (!isAuthenticated) {
    return <PinLogin onSuccess={() => setIsAuthenticated(true)} defaultPin={DEFAULT_PIN} />;
  }

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col">
        <header className="flex justify-between p-4 border-b">
          <h1 className="font-bold">DSE Tracker</h1>
          <div className="flex gap-2">
            <button onClick={() => setIsAuthenticated(false)}><Lock /></button>
            <button onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? <Sun /> : <Moon />}
            </button>
            <button onClick={() => setIsAddModalOpen(true)}>
              <Plus />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4">
          {renderSection()}
        </main>

        <AddTransactionModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddTransaction}
          stocks={allStocks}
          commissionRate={settings.commissionRate}
        />

        <DeleteConfirmationModal
          isOpen={!!transactionToDelete}
          onClose={() => setTransactionToDelete(null)}
          onConfirm={() => transactionToDelete && handleDeleteTransaction(transactionToDelete)}
        />
      </div>
    </ErrorBoundary>
  );
}
