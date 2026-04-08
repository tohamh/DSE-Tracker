import React, { useState, useRef } from "react";
import { 
  FileUp, 
  FileDown, 
  Upload, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  ChevronRight,
  Database,
  FileJson,
  FileSpreadsheet
} from "lucide-react";
import { Transaction, Settings, CustomStock, TransactionType, PortfolioType } from "../types";
import { cn, formatCurrency, formatNumber } from "../lib/utils";
import { DSE_STOCKS } from "../constants";

interface ImportExportProps {
  transactions: Transaction[];
  setTransactions: (t: Transaction[]) => void;
  customStocks: CustomStock[];
  setCustomStocks: (s: CustomStock[]) => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
}

export default function ImportExport({ 
  transactions, 
  setTransactions, 
  customStocks, 
  setCustomStocks,
  settings,
  setSettings
}: ImportExportProps) {
  const [activeTab, setActiveTab] = useState<"Import" | "Export" | "Backup">("Import");
  const [importMode, setImportMode] = useState<"CSV" | "Manual">("CSV");
  const [previewData, setPreviewData] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 5000);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
        if (lines.length < 2) {
          setError("CSV file is empty or missing headers.");
          return;
        }
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        
        const parsed: Transaction[] = lines.slice(1).map((line, index) => {
          // Robust CSV splitting (handles quotes if present)
          const values = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=^)(?=,)|(?<=,)(?=$))/g)?.map(v => v.trim().replace(/"/g, "")) || [];
          const row: any = {};
          headers.forEach((header, i) => {
            // Remove spaces from header keys for easier access (e.g., "company name" -> "companyname")
            const key = header.replace(/\s+/g, "");
            row[key] = values[i] || "";
          });

          // Mapping logic
          const typeMap: Record<string, { type: TransactionType; portfolio: PortfolioType }> = {
            "trade entry": { type: "Buy", portfolio: "Trading" },
            "trade exit": { type: "Sell", portfolio: "Trading" },
            "invest entry": { type: "Buy", portfolio: "Investment" },
            "invest exit": { type: "Sell", portfolio: "Investment" },
            "buy": { type: "Buy", portfolio: "Investment" },
            "sell": { type: "Sell", portfolio: "Investment" },
            "deposit": { type: "Deposit", portfolio: "Global" },
            "cash deposit": { type: "Deposit", portfolio: "Global" },
            "withdrawal": { type: "Withdrawal", portfolio: "Global" },
            "cash withdrawal": { type: "Withdrawal", portfolio: "Global" },
            "charge": { type: "Charge", portfolio: "Global" },
            "service charge": { type: "Charge", portfolio: "Global" },
            "tax": { type: "Charge", portfolio: "Global" },
            "dividend": { type: "Dividend", portfolio: "Investment" },
          };

          const rawType = (row.type || "").toLowerCase();
          const mapped = typeMap[rawType] || { type: "Buy", portfolio: "Investment" };
          
          // If type contains "deposit" or "charge" but wasn't in map
          if (!typeMap[rawType]) {
            if (rawType.includes("deposit")) mapped.type = "Deposit";
            else if (rawType.includes("charge") || rawType.includes("fee") || rawType.includes("tax")) mapped.type = "Charge";
            else if (rawType.includes("dividend")) mapped.type = "Dividend";
            else if (rawType.includes("buy") || rawType.includes("entry")) mapped.type = "Buy";
            else if (rawType.includes("sell") || rawType.includes("exit")) mapped.type = "Sell";
            else if (rawType.includes("withdrawal")) mapped.type = "Withdrawal";
          }

          // Fix Date: DD/MM/YYYY to YYYY-MM-DD
          let formattedDate = row.date || new Date().toISOString().split("T")[0];
          if (formattedDate.includes("/")) {
            const parts = formattedDate.split("/");
            if (parts.length === 3) {
              const day = parts[0].padStart(2, '0');
              const month = parts[1].padStart(2, '0');
              const year = parts[2];
              // Handle 2-digit vs 4-digit year
              const fullYear = year.length === 2 ? `20${year}` : year;
              formattedDate = `${fullYear}-${month}-${day}`;
            }
          }

          // Fix Numbers: Remove commas and handle negative signs before parsing
          const parseNum = (val: any) => {
            if (!val) return 0;
            const clean = val.toString().replace(/,/g, "").trim();
            return parseFloat(clean) || 0;
          };

          const qty = parseNum(row.qty);
          const price = parseNum(row.price);
          const rowTotal = parseNum(row.total || row.amount || row.value);
          
          // Commission Logic: No commission for Deposit, Charge, Dividend
          const isTrade = mapped.type === "Buy" || mapped.type === "Sell";
          let commission = 0;
          if (isTrade) {
            commission = parseNum(row.commission) || (qty * price * (settings.commissionRate / 100));
          }

          // Total Calculation: Prioritize rowTotal if it exists and is not 0
          let total = rowTotal !== 0 ? Math.abs(rowTotal) : qty * price;
          if (mapped.type === "Buy" && rowTotal === 0) total += commission;
          if (mapped.type === "Sell" && rowTotal === 0) total -= commission;

          // Stock Name Logic: Resolve ticker if present
          let finalTicker = "";
          let companyName = "";

          const ticker = (row.stocks || row.ticker || "").trim().toUpperCase();
          if (ticker) {
            const allStocks = [...DSE_STOCKS, ...customStocks];
            const foundStock = allStocks.find(s => 
              s.ticker.toUpperCase() === ticker || 
              (ticker.length > 2 && s.companyName.toLowerCase().includes(ticker.toLowerCase()))
            );
            finalTicker = foundStock ? foundStock.ticker : ticker;
            companyName = foundStock ? foundStock.companyName : (row.companyname || "");
          }

          return {
            id: crypto.randomUUID(),
            date: formattedDate,
            type: mapped.type,
            portfolio: mapped.portfolio,
            ticker: finalTicker,
            companyName,
            qty,
            price,
            commission,
            total,
            notes: row.notes || ""
          };
        });

        setPreviewData(parsed);
        setError(null);
        setSuccess(null);
      } catch (err) {
        console.error(err);
        setError("Failed to parse CSV. Please check the format.");
        setSuccess(null);
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    // Collect new stocks from preview data
    const newStocks: CustomStock[] = [];
    const allExistingStocks = [...DSE_STOCKS, ...customStocks];
    
    previewData.forEach(t => {
      if (t.ticker && t.companyName) {
        const exists = allExistingStocks.some(s => s.ticker === t.ticker);
        if (!exists) {
          const alreadyInNew = newStocks.some(s => s.ticker === t.ticker);
          if (!alreadyInNew) {
            newStocks.push({ ticker: t.ticker, companyName: t.companyName });
          }
        }
      }
    });

    if (newStocks.length > 0) {
      setCustomStocks([...customStocks, ...newStocks]);
    }

    setTransactions(previewData);
    showSuccess(`Successfully imported ${previewData.length} transactions!${newStocks.length > 0 ? ` Added ${newStocks.length} new stocks to database.` : ""}`);
    setPreviewData([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const exportToCsv = () => {
    const headers = ["Date", "Type", "Portfolio", "Ticker", "Qty", "Price", "Commission", "Total", "Notes"];
    const rows = transactions.map(t => [
      t.date,
      t.type,
      t.portfolio,
      t.ticker,
      t.qty,
      t.price,
      t.commission,
      t.total,
      t.notes || ""
    ]);

    const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `dse_portfolio_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.click();
    showSuccess("Data exported to CSV successfully!");
  };

  const fullBackup = () => {
    const data = {
      transactions,
      settings,
      customStocks,
      version: "1.0",
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `dse_portfolio_backup_${new Date().toISOString().split("T")[0]}.json`);
    link.click();
    showSuccess("Backup file created successfully!");
  };

  const restoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.transactions) setTransactions(data.transactions);
        if (data.settings) setSettings(data.settings);
        if (data.customStocks) setCustomStocks(data.customStocks);
        showSuccess("Backup restored successfully!");
        setError(null);
      } catch (err) {
        setError("Invalid backup file.");
        setSuccess(null);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Messages */}
      {(error || success) && (
        <div className="fixed top-16 md:top-20 right-4 md:right-8 z-50 animate-in slide-in-from-right duration-300">
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 p-2.5 md:p-3 rounded-lg flex items-center gap-2 md:gap-2.5 text-red-700 dark:text-red-400 shadow-lg min-w-[200px] md:min-w-[250px]">
              <AlertCircle size={16} />
              <p className="text-[10px] md:text-xs font-medium">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={12} /></button>
            </div>
          )}
          {success && (
            <div className="bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 p-2.5 md:p-3 rounded-lg flex items-center gap-2 md:gap-2.5 text-green-700 dark:text-green-400 shadow-lg min-w-[200px] md:min-w-[250px]">
              <CheckCircle2 size={16} />
              <p className="text-[10px] md:text-xs font-medium">{success}</p>
              <button onClick={() => setSuccess(null)} className="ml-auto text-green-400 hover:text-green-600"><X size={12} /></button>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-200 dark:bg-slate-800 rounded-xl w-fit transition-colors duration-300">
        {["Import", "Export", "Backup"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={cn(
              "px-3 md:px-5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all",
              activeTab === tab ? "bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Import" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
          <div className="lg:col-span-2 space-y-3 md:space-y-4">
            <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 text-center transition-colors duration-300">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-teal-50 dark:bg-teal-500/10 text-teal-500 dark:text-teal-400 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
                <Upload size={20} md:size={24} />
              </div>
              <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Import Transactions</h3>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mb-3 md:mb-4 max-w-md mx-auto">
                Upload your DSE transaction history in CSV format. You can preview the data before confirming.
              </p>
              
              <label className="inline-flex items-center gap-1.5 px-4 py-2 md:px-5 md:py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs md:text-sm font-bold cursor-pointer transition-all shadow-md active:scale-95">
                <FileSpreadsheet size={16} md:size={18} />
                Choose CSV File
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleCsvUpload} 
                />
              </label>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 p-3 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertCircle size={16} />
                <p className="text-xs font-medium">{error}</p>
              </div>
            )}

            {previewData.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
                <div className="p-2.5 md:p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                  <h4 className="font-bold text-xs md:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <CheckCircle2 size={14} md:size={16} className="text-green-500" />
                    Preview ({previewData.length})
                  </h4>
                  <div className="flex gap-1.5">
                    <button onClick={() => setPreviewData([])} className="px-2 md:px-3 py-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-[10px] md:text-xs">Cancel</button>
                    <button onClick={confirmImport} className="px-2 md:px-3 py-1 bg-teal-500 text-white rounded-lg font-bold text-[10px] md:text-xs shadow-sm hover:bg-teal-600">Import All</button>
                  </div>
                </div>
                <div className="max-h-[250px] md:max-h-[350px] overflow-y-auto">
                  <table className="w-full text-left text-[9px] md:text-[11px]">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold sticky top-0">
                      <tr>
                        <th className="px-2 md:px-3 py-1.5">Date</th>
                        <th className="px-2 md:px-3 py-1.5">Type</th>
                        <th className="px-2 md:px-3 py-1.5">Stock</th>
                        <th className="px-2 md:px-3 py-1.5 text-right">Qty</th>
                        <th className="px-2 md:px-3 py-1.5 text-right">Price</th>
                        <th className="px-2 md:px-3 py-1.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {previewData.map((t, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-2 md:px-3 py-1.5 text-slate-500 dark:text-slate-400">{t.date}</td>
                          <td className="px-2 md:px-3 py-1.5 font-bold text-slate-800 dark:text-slate-200">{t.type}</td>
                          <td className="px-2 md:px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300">{t.ticker}</td>
                          <td className="px-2 md:px-3 py-1.5 text-right text-slate-600 dark:text-slate-400">{formatNumber(t.qty)}</td>
                          <td className="px-2 md:px-3 py-1.5 text-right text-slate-600 dark:text-slate-400">{formatNumber(t.price)}</td>
                          <td className="px-2 md:px-3 py-1.5 text-right font-bold text-teal-600 dark:text-teal-400">{formatCurrency(t.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 md:space-y-4">
            <div className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
              <h4 className="font-bold text-xs md:text-sm text-slate-800 dark:text-slate-100 mb-2 md:mb-3 flex items-center gap-1.5">
                <AlertCircle size={14} md:size={16} className="text-amber-500" />
                CSV Format Guide
              </h4>
              <ul className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400 space-y-1.5 md:space-y-2">
                <li className="flex gap-1.5">
                  <div className="w-1 h-1 bg-teal-500 rounded-full mt-1.5 shrink-0" />
                  <span><strong>Date:</strong> DD/MM/YYYY or YYYY-MM-DD</span>
                </li>
                <li className="flex gap-1.5">
                  <div className="w-1 h-1 bg-teal-500 rounded-full mt-1.5 shrink-0" />
                  <span><strong>Numbers:</strong> Commas accepted (e.g., 2,290.00)</span>
                </li>
                <li className="flex gap-1.5">
                  <div className="w-1 h-1 bg-teal-500 rounded-full mt-1.5 shrink-0" />
                  <span><strong>Types:</strong> Trade Entry, Trade Exit, Invest Entry, Invest Exit, Deposit, Withdrawal, Charge, Dividend</span>
                </li>
              </ul>
              <div className="mt-3 md:mt-4 p-2 bg-slate-100 dark:bg-slate-950 rounded-lg text-[8px] md:text-[9px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto border border-slate-200 dark:border-slate-800">
                <p className="text-teal-600 dark:text-teal-400 mb-1"># Example CSV</p>
                <p>Date, Type, Ticker, Qty, Price</p>
                <p>27/06/2023, Charge, , 1, 100</p>
                <p>26/05/2025, Deposit, , 1, 30,000.00</p>
                <p>29/05/2025, Invest Entry, Marico, 5, 2,290.00</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Export" && (
        <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 max-w-xl transition-colors duration-300">
          <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 md:mb-4">Export Your Data</h3>
          <div className="space-y-3 md:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
              <div className="space-y-1">
                <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Portfolio
                </label>
                <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs md:text-sm text-slate-800 dark:text-slate-100">
                  <option>Global</option>
                  <option>Investment</option>
                  <option>Trading</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Format</label>
                <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs md:text-sm text-slate-800 dark:text-slate-100">
                  <option>CSV (Spreadsheet)</option>
                  <option>JSON (Data)</option>
                </select>
              </div>
            </div>
            <button 
              onClick={exportToCsv}
              className="w-full py-2.5 md:py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 md:gap-2.5 transition-all shadow-lg shadow-teal-500/20 active:scale-95 text-xs md:text-sm"
            >
              <Download size={18} md:size={20} />
              Export Data
            </button>
          </div>
        </div>
      )}

      {activeTab === "Backup" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
          <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center transition-colors duration-300">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-full flex items-center justify-center mb-2 md:mb-3">
              <FileJson size={20} md:size={24} />
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Full Backup</h3>
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mb-3 md:mb-4">
              Download a complete snapshot of your transactions, custom stocks, and settings in JSON format.
            </p>
            <button 
              onClick={fullBackup}
              className="px-5 md:px-6 py-2 md:py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-all shadow-md active:scale-95 text-xs md:text-sm"
            >
              Download Backup
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center transition-colors duration-300">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-full flex items-center justify-center mb-2 md:mb-3">
              <Database size={20} md:size={24} />
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Restore Backup</h3>
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mb-3 md:mb-4">
              Upload a previously saved JSON backup file to restore your entire portfolio state.
            </p>
            <label className="px-5 md:px-6 py-2 md:py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold cursor-pointer transition-all shadow-md active:scale-95 text-xs md:text-sm">
              Restore from File
              <input type="file" accept=".json" className="hidden" onChange={restoreBackup} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
