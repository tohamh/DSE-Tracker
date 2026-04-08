import { useState, useMemo } from "react";
import { 
  Settings as SettingsIcon, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Save, 
  CheckCircle2,
  Percent,
  Tag,
  Moon,
  Sun,
  Edit2,
  X,
  Search
} from "lucide-react";
import { Settings, CustomStock } from "../types";
import { cn } from "../lib/utils";
import { DSE_STOCKS } from "../constants";

interface SettingsProps {
  settings: Settings;
  setSettings: (s: Settings) => void;
  customStocks: CustomStock[];
  setCustomStocks: (s: CustomStock[]) => void;
  onClearAll: () => void;
  darkMode: boolean;
  setDarkMode: (d: boolean) => void;
}

export default function SettingsSection({ 
  settings, 
  setSettings, 
  customStocks, 
  setCustomStocks,
  onClearAll,
  darkMode,
  setDarkMode
}: SettingsProps) {
  const [commissionRate, setCommissionRate] = useState(settings.commissionRate.toString());
  const [newTicker, setNewTicker] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [editCompanyName, setEditCompanyName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Combine default and custom stocks for searching
  const allStocks = useMemo(() => {
    const stockMap = new Map<string, string>();
    DSE_STOCKS.forEach(s => stockMap.set(s.ticker, s.companyName));
    customStocks.forEach(s => stockMap.set(s.ticker, s.companyName));
    
    return Array.from(stockMap.entries())
      .map(([ticker, companyName]) => ({ ticker, companyName }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [customStocks]);

  const filteredStocks = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toUpperCase();
    return allStocks.filter(s => 
      s.ticker.includes(query) || 
      s.companyName.toUpperCase().includes(query)
    ).slice(0, 10); // Limit results for performance
  }, [allStocks, searchQuery]);

  const handleSaveSettings = () => {
    setSettings({ ...settings, commissionRate: parseFloat(commissionRate) || 0 });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleAddStock = () => {
    if (!newTicker || !newCompanyName) return;
    const ticker = newTicker.toUpperCase();
    // If it's already in customStocks, update it. If not, add it.
    const existing = customStocks.find(s => s.ticker === ticker);
    if (existing) {
      setCustomStocks(customStocks.map(s => s.ticker === ticker ? { ...s, companyName: newCompanyName } : s));
    } else {
      setCustomStocks([...customStocks, { ticker, companyName: newCompanyName }]);
    }
    setNewTicker("");
    setNewCompanyName("");
  };

  const handleRemoveStock = (ticker: string) => {
    setCustomStocks(customStocks.filter(s => s.ticker !== ticker));
  };

  const startEditing = (stock: CustomStock) => {
    setEditingStock(stock.ticker);
    setEditCompanyName(stock.companyName);
  };

  const startEditingFromSearch = (stock: CustomStock) => {
    setEditingStock(stock.ticker);
    setEditCompanyName(stock.companyName);
    setSearchQuery(""); // Clear search after selecting
  };

  const saveEdit = () => {
    if (!editingStock) return;
    const existing = customStocks.find(s => s.ticker === editingStock);
    if (existing) {
      setCustomStocks(customStocks.map(s => s.ticker === editingStock ? { ...s, companyName: editCompanyName } : s));
    } else {
      // If it was a default stock, add it to customStocks to override
      setCustomStocks([...customStocks, { ticker: editingStock, companyName: editCompanyName }]);
    }
    setEditingStock(null);
  };

  return (
    <div className="max-w-4xl space-y-3 md:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
        {/* Theme Settings */}
        <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 md:mb-4 flex items-center gap-2">
            {darkMode ? <Moon size={16} md:size={18} className="text-teal-500" /> : <Sun size={16} md:size={18} className="text-teal-500" />}
            Appearance
          </h3>
          <div className="flex items-center justify-between p-2.5 md:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100">Dark Mode</p>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">Switch between light and dark themes</p>
            </div>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                darkMode ? "bg-teal-500" : "bg-slate-300"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  darkMode ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>

        {/* Commission Rate */}
        <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 md:mb-4 flex items-center gap-2">
            <Percent size={16} md:size={18} className="text-teal-500" />
            Commission Settings
          </h3>
          <div className="flex flex-col md:flex-row items-end gap-2 md:gap-3">
            <div className="w-full md:flex-1 space-y-1 md:space-y-1.5">
              <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Default Rate (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-8 py-1.5 md:py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs md:text-sm text-slate-800 dark:text-slate-100"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs">%</span>
              </div>
            </div>
            <button 
              onClick={handleSaveSettings}
              className={cn(
                "w-full md:w-auto px-4 py-1.5 md:py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs md:text-sm",
                saveSuccess ? "bg-green-500 text-white" : "bg-teal-500 text-white hover:bg-teal-600"
              )}
            >
              {saveSuccess ? <CheckCircle2 size={16} md:size={18} /> : <Save size={16} md:size={18} />}
              {saveSuccess ? "Saved!" : "Save"}
            </button>
          </div>
          <p className="mt-2 md:mt-3 text-[10px] md:text-xs text-slate-500 dark:text-slate-400 italic">
            Used for auto-calculating commission for new transactions.
          </p>
        </div>
      </div>

      {/* Custom Stocks */}
      <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 md:mb-4 flex items-center gap-2">
          <Tag size={16} md:size={18} className="text-teal-500" />
          Stock Database
        </h3>
        <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mb-3 md:mb-4">
          Add new stocks or edit existing company names. Custom entries will override default DSE stock names.
        </p>
        <div className="space-y-3 md:space-y-4">
          <div className="relative">
            <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 md:mb-1.5 block">Search Ticker to Edit</label>
            <div className="relative">
              <Search className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} md:size={16} />
              <input
                type="text"
                placeholder="Search ticker or company..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 md:pl-10 pr-3 py-1.5 md:py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs md:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Search Results Dropdown */}
            {filteredStocks.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
                {filteredStocks.map((stock) => (
                  <button
                    key={stock.ticker}
                    onClick={() => startEditingFromSearch(stock)}
                    className="w-full flex items-center justify-between p-2.5 md:p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors"
                  >
                    <div className="text-left">
                      <p className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100">{stock.ticker}</p>
                      <p className="text-[9px] md:text-[10px] text-slate-500 dark:text-slate-400">{stock.companyName}</p>
                    </div>
                    <Edit2 size={12} md:size={14} className="text-teal-500" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
            <div className="space-y-1">
              <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ticker</label>
              <input
                type="text"
                placeholder="e.g. MYSTOCK"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs md:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Company Name</label>
              <input
                type="text"
                placeholder="e.g. My Custom Company"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs md:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleAddStock}
                className="w-full py-1.5 md:py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md shadow-teal-500/10 text-xs md:text-sm"
              >
                <Plus size={16} md:size={18} />
                Add/Update
              </button>
            </div>
          </div>
        </div>

        {/* Editing Overlay/Inline for Search Results */}
        {editingStock && !customStocks.find(s => s.ticker === editingStock) && (
          <div className="mt-6 p-4 bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-teal-800 dark:text-teal-400 flex items-center gap-2">
                <Edit2 size={16} />
                Editing Default Stock: {editingStock}
              </h4>
              <button onClick={() => setEditingStock(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex gap-4">
              <input
                type="text"
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                value={editCompanyName}
                onChange={(e) => setEditCompanyName(e.target.value)}
                autoFocus
              />
              <button 
                onClick={saveEdit}
                className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-bold flex items-center gap-2"
              >
                <Save size={18} />
                Save Override
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 md:mt-6 space-y-1.5">
          <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Custom/Edited Stocks</label>
          <div className="grid grid-cols-1 gap-1.5 md:gap-2">
            {customStocks.length > 0 ? (
              customStocks.map((stock) => (
                <div key={stock.ticker} className="flex items-center justify-between p-2.5 md:p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg group">
                  {editingStock === stock.ticker ? (
                    <div className="flex-1 flex gap-2 md:gap-3 items-center">
                      <span className="font-bold text-teal-600 dark:text-teal-400 text-xs md:text-sm min-w-[50px] md:min-w-[70px]">{stock.ticker}</span>
                      <input
                        type="text"
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 md:px-2.5 py-1 text-[10px] md:text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        value={editCompanyName}
                        onChange={(e) => setEditCompanyName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      />
                      <button onClick={saveEdit} className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded">
                        <Save size={14} md:size={16} />
                      </button>
                      <button onClick={() => setEditingStock(null)} className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                        <X size={14} md:size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col">
                        <span className="font-bold text-xs md:text-sm text-slate-800 dark:text-slate-200">{stock.ticker}</span>
                        <span className="text-[9px] md:text-xs text-slate-500 dark:text-slate-400">{stock.companyName}</span>
                      </div>
                      <div className="flex items-center gap-1 md:gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => startEditing(stock)}
                          className="p-1 md:p-1.5 text-slate-400 hover:text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded transition-all"
                        >
                          <Edit2 size={12} md:size={14} />
                        </button>
                        <button 
                          onClick={() => handleRemoveStock(stock.ticker)}
                          className="p-1 md:p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-all"
                        >
                          <Trash2 size={12} md:size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            ) : (
              <div className="py-4 md:py-6 text-center text-[10px] md:text-xs text-slate-400 dark:text-slate-600 italic border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                No custom stock overrides yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-500/10 p-4 md:p-6 rounded-xl border border-red-100 dark:border-red-500/20 transition-colors duration-300">
        <h3 className="text-base md:text-lg font-bold text-red-700 dark:text-red-400 mb-2 md:mb-3 flex items-center gap-2">
          <AlertTriangle size={18} md:size={20} />
          Danger Zone
        </h3>
        <p className="text-[10px] md:text-xs text-red-600 dark:text-red-300 mb-3 md:mb-4 font-medium">
          Clearing all data will permanently delete all your transactions, settings, and custom stocks. This action cannot be undone.
        </p>
        
        {!showClearConfirm ? (
          <button 
            onClick={() => setShowClearConfirm(true)}
            className="w-full md:w-auto px-4 py-2 md:py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-all shadow-md active:scale-95 text-xs md:text-sm"
          >
            Clear All Data
          </button>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3">
            <button 
              onClick={() => { onClearAll(); setShowClearConfirm(false); }}
              className="w-full md:w-auto px-4 py-2 md:py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold transition-all shadow-md active:scale-95 text-xs md:text-sm"
            >
              Yes, Delete Everything
            </button>
            <button 
              onClick={() => setShowClearConfirm(false)}
              className="w-full md:w-auto px-4 py-2 md:py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold transition-all text-xs md:text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
