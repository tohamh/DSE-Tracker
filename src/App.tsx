import { useState, useMemo, useEffect, useCallback } from "react";
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Briefcase, 
  TrendingUp, 
  FileUp, 
  Settings as SettingsIcon, 
  Plus, 
  Menu, 
  X, 
  Home, 
  Wallet, 
  PieChart, 
  Trash2,
  Edit2,
  Download,
  Upload,
  Search,
  AlertTriangle,
  Sun,
  Moon,
  Lock,
  RefreshCw,
  WifiOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { 
  Transaction, 
  Settings, 
  CustomStock, 
  ActiveSection, 
  PortfolioType, 
  TransactionType 
} from "./types";
import { DSE_STOCKS } from "./constants";
import { cn, formatCurrency, formatNumber } from "./lib/utils";
import { calculatePortfolioStats } from "./lib/portfolioUtils";

// Sections
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

// ============================================================
//  🔴 PASTE YOUR GOOGLE APPS SCRIPT URL BELOW (between the quotes)
// ============================================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxkYwWizWdUHIgs09TMSHhie0nqJ41AcSpgOafe9mwpBn1ZB9nyHzgIW8nBH1vCXRh7/exec";
// ============================================================

const DEFAULT_PIN = "0923202350";

// Helper to call the Google Sheets API
async function sheetsAPI(body: object): Promise<{ success: boolean; data?: any; error?: string }> {
  const response = await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return response.json();
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Transactions now live in Google Sheets (not localStorage)
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Settings, stocks, and dark mode still use localStorage (they are device preferences)
  const [settings, setSettings] = useLocalStorage<Settings>("dse_settings", { commissionRate: 0.40 });
  const [customStocks, setCustomStocks] = useLocalStorage<CustomStock[]>("dse_custom_stocks", []);
  const [activeSection, setActiveSection] = useState<ActiveSection>("Dashboard");
  const [activePortfolio, setActivePortfolio] = useState<PortfolioType>("Global");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [darkMode, setDarkMode] = useLocalStorage<boolean>("dse_dark_mode", true);

  // ── Load transactions from Google Sheets on startup ──
  const loadFromSheets = useCallback(async () => {
    setIsLoading(true);
    setSyncError(null);
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL);
      const json = await response.json();
      if (json.success) {
        // Migrate old "All Portfolios" values if any
        const migrated = (json.data as Transaction[]).map(t =>
          (t.portfolio as string) === "All Portfolios"
            ? { ...t, portfolio: "Global" as PortfolioType }
            : t
        );
        setTransactions(migrated);
      } else {
        setSyncError("Could not load data: " + (json.error || "unknown error"));
      }
    } catch (err) {
      setSyncError("Cannot connect to Google Sheets. Check your URL or internet connection.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadFromSheets();
    }
  }, [isAuthenticated, loadFromSheets]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

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

  // ── Add or Edit a transaction ──
  const handleAddTransaction = async (newTransaction: Transaction) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      if (editingTransaction) {
        const result = await sheetsAPI({ action: "update", data: newTransaction });
        if (result.success) {
          setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? newTransaction : t));
        } else {
          setSyncError("Failed to update transaction.");
        }
        setEditingTransaction(null);
      } else {
        const result = await sheetsAPI({ action: "add", data: newTransaction });
        if (result.success) {
          setTransactions(prev => [newTransaction, ...prev]);
        } else {
          setSyncError("Failed to save transaction.");
        }
      }
    } catch {
      setSyncError("Network error. Transaction not saved.");
    } finally {
      setIsSyncing(false);
      setIsAddModalOpen(false);
    }
  };

  // ── Delete one transaction ──
  const handleDeleteTransaction = async (id: string) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const result = await sheetsAPI({ action: "delete", id });
      if (result.success) {
        setTransactions(prev => prev.filter(t => t.id !== id));
      } else {
        setSyncError("Failed to delete transaction.");
      }
    } catch {
      setSyncError("Network error. Transaction not deleted.");
    } finally {
      setIsSyncing(false);
      setTransactionToDelete(null);
    }
  };

  // ── Delete multiple transactions ──
  const handleBulkDelete = async (ids: string[]) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const result = await sheetsAPI({ action: "bulkDelete", ids });
      if (result.success) {
        setTransactions(prev => prev.filter(t => !ids.includes(t.id)));
      } else {
        setSyncError("Failed to delete selected transactions.");
      }
    } catch {
      setSyncError("Network error during bulk delete.");
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Clear all data ──
  const handleClearAll = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const result = await sheetsAPI({ action: "clearAll" });
      if (result.success) {
        setTransactions([]);
        setCustomStocks([]);
        setSettings({ commissionRate: 0.40 });
      } else {
        setSyncError("Failed to clear data.");
      }
    } catch {
      setSyncError("Network error during clear.");
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Replace all transactions (used by Import/Export) ──
  const handleSetTransactions = async (
    newTransactionsOrFn: Transaction[] | ((prev: Transaction[]) => Transaction[])
  ) => {
    const resolved =
      typeof newTransactionsOrFn === "function"
        ? newTransactionsOrFn(transactions)
        : newTransactionsOrFn;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const result = await sheetsAPI({ action: "replaceAll", data: resolved });
      if (result.success) {
        setTransactions(resolved);
      } else {
        setSyncError("Failed to import data.");
      }
    } catch {
      setSyncError("Network error during import.");
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isAuthenticated) {
    return <PinLogin onSuccess={() => setIsAuthenticated(true)} defaultPin={DEFAULT_PIN} />;
  }

  // ── Loading screen ──
  if (isLoading) {
    return (
      <div className={cn("h-screen flex flex-col items-center justify-center gap-4 font-sans", darkMode ? "dark bg-slate-950 text-white" : "bg-slate-50 text-slate-900")}>
        <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center text-white font-bold text-xl animate-pulse">D</div>
        <p className="text-slate-400 text-sm">Loading your portfolio from Google Sheets...</p>
        {syncError && (
          <div className="max-w-sm text-center">
            <p className="text-red-400 text-xs mt-2 px-4">{syncError}</p>
            <button
              onClick={loadFromSheets}
              className="mt-3 px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-semibold hover:bg-teal-600"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case "Dashboard":
        return (
          <Dashboard 
            stats={stats} 
            allStats={allStats} 
            investmentStats={investmentStats} 
            tradingStats={tradingStats} 
            transactions={transactions} 
            setActiveSection={setActiveSection} 
            customStocks={customStocks}
            activePortfolio={activePortfolio}
          />
        );
      case "Transaction":
        return (
          <Transactions 
            transactions={transactions} 
            onDelete={setTransactionToDelete} 
            onEdit={(t) => { setEditingTransaction(t); setIsAddModalOpen(true); }}
            onBulkDelete={handleBulkDelete}
            activePortfolio={activePortfolio}
            setActivePortfolio={setActivePortfolio}
            customStocks={customStocks}
          />
        );
      case "Holdings":
        return (
          <Holdings 
            stats={stats} 
            activePortfolio={activePortfolio} 
            customStocks={customStocks} 
          />
        );
      case "Analytics":
        return <Analytics transactions={transactions} stats={stats} activePortfolio={activePortfolio} />;
      case "Import":
        return (
          <ImportExport 
            transactions={transactions} 
            setTransactions={handleSetTransactions}
            customStocks={customStocks}
            setCustomStocks={setCustomStocks}
            settings={settings}
            setSettings={setSettings}
          />
        );
      case "Settings":
        return (
          <SettingsSection 
            settings={settings} 
            setSettings={setSettings} 
            customStocks={customStocks} 
            setCustomStocks={setCustomStocks}
            onClearAll={handleClearAll}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
          />
        );
      default:
        return (
          <Dashboard 
            stats={stats} 
            allStats={allStats} 
            investmentStats={investmentStats} 
            tradingStats={tradingStats} 
            transactions={transactions} 
            setActiveSection={setActiveSection} 
            customStocks={customStocks}
            activePortfolio={activePortfolio}
          />
        );
    }
  };

  const navItems = [
    { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "Transaction", label: "Transaction", icon: ArrowLeftRight },
    { id: "Holdings", label: "Holdings", icon: Briefcase },
    { id: "Analytics", label: "Analytics", icon: TrendingUp },
    { id: "Import", label: "Import", icon: FileUp },
    { id: "Settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <ErrorBoundary>
      <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
        {/* Sidebar - Desktop */}
        <aside className={cn(
          "hidden md:flex flex-col bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 w-64 sticky top-0 h-screen z-20",
          !isSidebarOpen && "w-20"
        )}>
          <div className="p-6 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center text-white font-bold">D</div>
            {isSidebarOpen && <span className="font-bold text-slate-800 dark:text-white text-lg truncate">DSE Tracker</span>}
          </div>

          <div className="p-4 flex flex-col gap-1 flex-1 overflow-y-auto">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-2">Menu</p>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as ActiveSection)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all",
                  activeSection === item.id ? "bg-teal-500 text-white shadow-lg shadow-teal-500/20" : "hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-teal-600 dark:hover:text-white"
                )}
              >
                <item.icon size={20} />
                {isSidebarOpen && <span className="font-medium">{item.label}</span>}
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
            {isSidebarOpen ? "DSE Portfolio Tracker v1.0" : "v1.0"}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden pb-20 md:pb-0">
          {/* Top Navbar */}
          <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 transition-colors duration-300">
            <div className="flex items-center gap-4 lg:gap-8">
              <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden md:block text-slate-500 hover:text-slate-900 dark:hover:text-white">
                  <Menu size={24} />
                </button>
                <h1 className="text-xl font-bold text-slate-800 dark:text-white md:hidden">DSE Tracker</h1>
                
                <div className="hidden md:flex items-center gap-2 text-slate-400 text-sm">
                  <span>{activeSection}</span>
                </div>
              </div>

              {/* Desktop Portfolio Switcher (Tabs) */}
              <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                {(["Global", "Investment", "Trading"] as PortfolioType[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setActivePortfolio(p)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200",
                      activePortfolio === p 
                        ? "bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600" 
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              
              {/* Mobile Portfolio Switcher */}
              <div className="md:hidden flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                {(["Global", "Investment", "Trading"] as PortfolioType[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setActivePortfolio(p)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all",
                      activePortfolio === p 
                        ? "bg-teal-500 text-white shadow-sm" 
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                  >
                    {p === "Global" ? "All" : p.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">

              {/* Sync status indicator */}
              {isSyncing && (
                <div className="flex items-center gap-1.5 text-teal-500 text-xs font-medium">
                  <RefreshCw size={14} className="animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                </div>
              )}
              {syncError && !isSyncing && (
                <div
                  className="flex items-center gap-1.5 text-red-400 text-xs font-medium cursor-pointer"
                  title={syncError}
                  onClick={() => setSyncError(null)}
                >
                  <WifiOff size={14} />
                  <span className="hidden sm:inline">Sync error</span>
                </div>
              )}

              {/* Refresh button */}
              <button
                onClick={loadFromSheets}
                disabled={isLoading || isSyncing}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                title="Refresh from Google Sheets"
              >
                <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
              </button>

              <button
                onClick={() => setIsAuthenticated(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Lock Application"
              >
                <Lock size={20} />
              </button>
              
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              
              <button
                onClick={() => { setEditingTransaction(null); setIsAddModalOpen(true); }}
                disabled={isSyncing}
                className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold transition-all shadow-md active:scale-95 disabled:opacity-60"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Add Transaction</span>
              </button>
            </div>
          </header>

          {/* Sync Error Banner */}
          {syncError && (
            <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertTriangle size={14} />
                <span>{syncError}</span>
              </div>
              <button onClick={() => setSyncError(null)} className="text-red-400 hover:text-red-600">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderSection()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 h-16 flex items-center justify-around px-1 z-20 transition-colors duration-300">
          {[
            { id: "Dashboard", icon: Home, label: "Home" },
            { id: "Transaction", icon: ArrowLeftRight, label: "Trans" },
            { id: "Holdings", icon: Wallet, label: "Hold" },
            { id: "Analytics", icon: PieChart, label: "Stats" },
            { id: "Import", icon: FileUp, label: "Import" },
            { id: "Settings", icon: SettingsIcon, label: "Setup" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as ActiveSection)}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors flex-1",
                activeSection === item.id ? "text-teal-500" : "text-slate-400 dark:text-slate-500"
              )}
            >
              <item.icon size={18} />
              <span className="text-[9px] uppercase font-bold tracking-tighter">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Modals */}
        <AddTransactionModal 
          isOpen={isAddModalOpen} 
          onClose={() => { setIsAddModalOpen(false); setEditingTransaction(null); }}
          onAdd={handleAddTransaction}
          stocks={allStocks}
          commissionRate={settings.commissionRate}
          editingTransaction={editingTransaction}
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
