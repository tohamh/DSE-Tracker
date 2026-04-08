import { useState, useMemo, useEffect, useRef } from "react";
import { 
  LayoutDashboard, ArrowLeftRight, Briefcase, TrendingUp, FileUp,
  Settings as SettingsIcon, Plus, Menu, Home, Wallet, PieChart,
  Sun, Moon, Lock, RefreshCw, WifiOff, CloudOff, CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { Transaction, Settings, CustomStock, ActiveSection, PortfolioType, TransactionType } from "./types";
import { DSE_STOCKS } from "./constants";
import { cn, formatCurrency, formatNumber } from "./lib/utils";
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

// ============================================================
//  🔴 PASTE YOUR NEW GOOGLE APPS SCRIPT URL BELOW
// ============================================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyalZ1aNYDf_vQKIMC0LGDXV-iJsxtJVAqpP6sATPdDSEYdTXPI_dxgFID9guxgmrt7/exec";
// ============================================================

const DEFAULT_PIN = "0923202350";
const SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutes

async function sheetsAPI(body: object): Promise<{ success: boolean; data?: any; error?: string }> {
  const res = await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.json();
}

type SyncStatus = "idle" | "syncing" | "ok" | "error";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ── All data lives in localStorage (instant, no loading screen) ──
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>("dse_transactions", []);
  const [settings, setSettings] = useLocalStorage<Settings>("dse_settings", { commissionRate: 0.40 });
  const [customStocks, setCustomStocks] = useLocalStorage<CustomStock[]>("dse_custom_stocks", []);
  const [darkMode, setDarkMode] = useLocalStorage<boolean>("dse_dark_mode", true);
  const [lastSyncedAt, setLastSyncedAt] = useLocalStorage<number>("dse_last_synced", 0);

  // ── Sync status (visual only, doesn't block UI) ──
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState("");

  // ── UI state ──
  const [activeSection, setActiveSection] = useState<ActiveSection>("Dashboard");
  const [activePortfolio, setActivePortfolio] = useState<PortfolioType>("Global");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Ref so background functions always see current value without re-creating
  const lastSyncedAtRef = useRef(lastSyncedAt);
  lastSyncedAtRef.current = lastSyncedAt;

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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Migrate old "All Portfolios" label
  useEffect(() => {
    if (transactions.some(t => t.portfolio === "All Portfolios")) {
      setTransactions(transactions.map(t =>
        t.portfolio === "All Portfolios" ? { ...t, portfolio: "Global" as PortfolioType } : t
      ));
    }
  }, []);

  // ── Pull from Sheets (only if Sheets has newer data) ──
  const pullFromSheets = async () => {
    try {
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAll`);
      const json = await res.json();
      if (!json.success || !json.data) return;
      const { transactions: remoteT, settings: remoteS, lastModified } = json.data;
      if (lastModified > lastSyncedAtRef.current) {
        if (Array.isArray(remoteT)) setTransactions(remoteT);
        if (remoteS?.settings) setSettings(remoteS.settings);
        if (remoteS?.customStocks) setCustomStocks(remoteS.customStocks);
        setLastSyncedAt(lastModified);
        lastSyncedAtRef.current = lastModified;
      }
    } catch {
      // Silent fail — local data is still shown
    }
  };

  // On login: pull from Sheets only if cache is older than 10 min
  useEffect(() => {
    if (!isAuthenticated) return;
    const cacheAge = Date.now() - lastSyncedAtRef.current;
    if (cacheAge > SYNC_INTERVAL) {
      pullFromSheets();
    }
    // Background poll every 10 minutes (catches changes from other devices)
    const interval = setInterval(pullFromSheets, SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // ── Push to Sheets (fire-and-forget — never blocks UI) ──
  const pushToSheets = async (body: object) => {
    setSyncStatus("syncing");
    setSyncMessage("");
    try {
      const result = await sheetsAPI(body);
      if (result.success) {
        setLastSyncedAt(Date.now());
        setSyncStatus("ok");
        setTimeout(() => setSyncStatus("idle"), 3000);
      } else {
        setSyncStatus("error");
        setSyncMessage(result.error || "Sync failed — will retry on next refresh");
      }
    } catch {
      setSyncStatus("error");
      setSyncMessage("No internet — data saved locally, will sync when reconnected");
    }
  };

  // ── Sync settings + customStocks together ──
  const syncSettings = (newSettings: Settings, newCustomStocks: CustomStock[]) => {
    pushToSheets({ action: "saveSettings", data: { settings: newSettings, customStocks: newCustomStocks } });
  };

  // ── Transaction handlers (localStorage first, Sheets in background) ──
  const handleAddTransaction = (newTransaction: Transaction) => {
    if (editingTransaction) {
      setTransactions(transactions.map(t => t.id === editingTransaction.id ? newTransaction : t));
      setEditingTransaction(null);
      pushToSheets({ action: "update", data: newTransaction });
    } else {
      setTransactions([newTransaction, ...transactions]);
      pushToSheets({ action: "add", data: newTransaction });
    }
    setIsAddModalOpen(false);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
    setTransactionToDelete(null);
    pushToSheets({ action: "delete", id });
  };

  const handleBulkDelete = (ids: string[]) => {
    setTransactions(transactions.filter(t => !ids.includes(t.id)));
    pushToSheets({ action: "bulkDelete", ids });
  };

  const handleClearAll = () => {
    setTransactions([]);
    setCustomStocks([]);
    setSettings({ commissionRate: 0.40 });
    pushToSheets({ action: "clearAll" });
    syncSettings({ commissionRate: 0.40 }, []);
  };

  // Import: update localStorage immediately, batch-push to Sheets
  const handleSetTransactions = (newTxOrFn: Transaction[] | ((prev: Transaction[]) => Transaction[])) => {
    const resolved = typeof newTxOrFn === "function" ? newTxOrFn(transactions) : newTxOrFn;
    setTransactions(resolved);
    pushToSheets({ action: "replaceAll", data: resolved });
  };

  // Settings: update localStorage immediately + sync to Sheets
  const handleSetSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    syncSettings(newSettings, customStocks);
  };

  const handleSetCustomStocks = (newStocks: CustomStock[] | ((prev: CustomStock[]) => CustomStock[])) => {
    const resolved = typeof newStocks === "function" ? newStocks(customStocks) : newStocks;
    setCustomStocks(resolved);
    syncSettings(settings, resolved);
  };

  if (!isAuthenticated) {
    return <PinLogin onSuccess={() => setIsAuthenticated(true)} defaultPin={DEFAULT_PIN} />;
  }

  const renderSection = () => {
    switch (activeSection) {
      case "Dashboard":
        return (
          <Dashboard
            stats={stats} allStats={allStats} investmentStats={investmentStats}
            tradingStats={tradingStats} transactions={transactions}
            setActiveSection={setActiveSection} customStocks={customStocks}
            activePortfolio={activePortfolio}
          />
        );
      case "Transaction":
        return (
          <Transactions
            transactions={transactions} onDelete={setTransactionToDelete}
            onEdit={(t) => { setEditingTransaction(t); setIsAddModalOpen(true); }}
            onBulkDelete={handleBulkDelete} activePortfolio={activePortfolio}
            setActivePortfolio={setActivePortfolio} customStocks={customStocks}
          />
        );
      case "Holdings":
        return <Holdings stats={stats} activePortfolio={activePortfolio} customStocks={customStocks} />;
      case "Analytics":
        return <Analytics transactions={transactions} stats={stats} activePortfolio={activePortfolio} />;
      case "Import":
        return (
          <ImportExport
            transactions={transactions} setTransactions={handleSetTransactions}
            customStocks={customStocks} setCustomStocks={handleSetCustomStocks}
            settings={settings} setSettings={handleSetSettings}
          />
        );
      case "Settings":
        return (
          <SettingsSection
            settings={settings} setSettings={handleSetSettings}
            customStocks={customStocks} setCustomStocks={handleSetCustomStocks}
            onClearAll={handleClearAll} darkMode={darkMode} setDarkMode={setDarkMode}
          />
        );
      default:
        return (
          <Dashboard
            stats={stats} allStats={allStats} investmentStats={investmentStats}
            tradingStats={tradingStats} transactions={transactions}
            setActiveSection={setActiveSection} customStocks={customStocks}
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

  const SyncIndicator = () => {
    if (syncStatus === "syncing") return (
      <div className="flex items-center gap-1.5 text-teal-400 text-xs font-medium">
        <RefreshCw size={13} className="animate-spin" />
        <span className="hidden sm:inline">Saving...</span>
      </div>
    );
    if (syncStatus === "ok") return (
      <div className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
        <CheckCircle2 size={13} />
        <span className="hidden sm:inline">Saved</span>
      </div>
    );
    if (syncStatus === "error") return (
      <div
        className="flex items-center gap-1.5 text-red-400 text-xs font-medium cursor-pointer"
        title={syncMessage}
        onClick={() => setSyncStatus("idle")}
      >
        <WifiOff size={13} />
        <span className="hidden sm:inline">Sync error</span>
      </div>
    );
    return null;
  };

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
                  activeSection === item.id
                    ? "bg-teal-500 text-white shadow-lg shadow-teal-500/20"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-teal-600 dark:hover:text-white"
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

        {/* Main Content */}
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

              {/* Desktop Portfolio Tabs */}
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
                  >{p}</button>
                ))}
              </div>

              {/* Mobile Portfolio Tabs */}
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
                  >{p === "Global" ? "All" : p.substring(0, 3)}</button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <SyncIndicator />
              <button
                onClick={pullFromSheets}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Pull latest from Google Sheets"
              >
                <RefreshCw size={18} />
              </button>
              <button
                onClick={() => setIsAuthenticated(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Lock"
              >
                <Lock size={20} />
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={() => { setEditingTransaction(null); setIsAddModalOpen(true); }}
                className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold transition-all shadow-md active:scale-95"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Add Transaction</span>
              </button>
            </div>
          </header>

          {/* Error banner (dismissible) */}
          {syncStatus === "error" && syncMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-2 flex items-center justify-between text-red-600 dark:text-red-400 text-sm">
              <div className="flex items-center gap-2">
                <CloudOff size={14} />
                <span>{syncMessage}</span>
              </div>
              <button onClick={() => setSyncStatus("idle")} className="text-red-400 hover:text-red-600 text-xs underline">Dismiss</button>
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
