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
  Lock
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

const DEFAULT_PIN = "0923202350";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>("dse_transactions", []);
  const [settings, setSettings] = useLocalStorage<Settings>("dse_settings", { commissionRate: 0.40 });
  const [customStocks, setCustomStocks] = useLocalStorage<CustomStock[]>("dse_custom_stocks", []);
  const [activeSection, setActiveSection] = useState<ActiveSection>("Dashboard");
  const [activePortfolio, setActivePortfolio] = useState<PortfolioType>("Global");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [darkMode, setDarkMode] = useLocalStorage<boolean>("dse_dark_mode", true);

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
    console.log("Dark mode state changed:", darkMode);
    if (darkMode) {
      document.documentElement.classList.add("dark");
      console.log("Added 'dark' class to html. Current classes:", document.documentElement.className);
    } else {
      document.documentElement.classList.remove("dark");
      console.log("Removed 'dark' class from html. Current classes:", document.documentElement.className);
    }
  }, [darkMode]);

  useEffect(() => {
    const needsMigration = transactions.some(t => t.portfolio === "All Portfolios");
    if (needsMigration) {
      const migrated = transactions.map(t => 
        t.portfolio === "All Portfolios" ? { ...t, portfolio: "Global" as PortfolioType } : t
      );
      setTransactions(migrated);
    }
  }, [transactions, setTransactions]);

  const handleAddTransaction = (newTransaction: Transaction) => {
    if (editingTransaction) {
      const updated = transactions.map(t => t.id === editingTransaction.id ? newTransaction : t);
      setTransactions(updated);
      setEditingTransaction(null);
    } else {
      setTransactions([newTransaction, ...transactions]);
    }
    setIsAddModalOpen(false);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
    setTransactionToDelete(null);
  };

  const handleBulkDelete = (ids: string[]) => {
    setTransactions(transactions.filter(t => !ids.includes(t.id)));
  };

  const handleClearAll = () => {
    setTransactions([]);
    setCustomStocks([]);
    setSettings({ commissionRate: 0.40 });
  };

  if (!isAuthenticated) {
    return <PinLogin onSuccess={() => setIsAuthenticated(true)} defaultPin={DEFAULT_PIN} />;
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
            setTransactions={setTransactions} 
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
                className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold transition-all shadow-md active:scale-95"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Add Transaction</span>
              </button>
            </div>
          </header>

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
