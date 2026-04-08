import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  Search, 
  Filter, 
  Trash2, 
  Edit2, 
  ChevronDown, 
  ChevronUp,
  Plus,
  ArrowUpDown,
  Calendar,
  X as CloseIcon
} from "lucide-react";
import { Transaction, PortfolioType, TransactionType, CustomStock } from "../types";
import { cn, formatCurrency, formatNumber, getStockName } from "../lib/utils";
import { TypeBadge } from "./Dashboard";

interface TransactionsProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
  onBulkDelete: (ids: string[]) => void;
  activePortfolio: PortfolioType;
  setActivePortfolio: (p: PortfolioType) => void;
  customStocks: CustomStock[];
}

type SortField = "date" | "ticker" | "total";
type SortOrder = "asc" | "desc";

const ALL_TYPES: TransactionType[] = ["Buy", "Sell", "Deposit", "Withdrawal", "Charge", "Dividend"];

export default function Transactions({ 
  transactions, 
  onDelete, 
  onEdit, 
  onBulkDelete,
  activePortfolio,
  setActivePortfolio,
  customStocks
}: TransactionsProps) {
  const [selectedTypes, setSelectedTypes] = useState<TransactionType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    return formatDate(thirtyDaysAgo);
  });
  const [endDate, setEndDate] = useState(() => formatDate(new Date()));
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowTypeFilter(false);
      }
    }

    if (showTypeFilter) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showTypeFilter]);

  const filteredTransactions = useMemo(() => {
    const typesToFilter = selectedTypes;

    return transactions
      .map(t => ({
        ...t,
        companyName: getStockName(t.ticker, customStocks)
      }))
      .filter((t) => {
        // If Trading is selected, only show Buy and Sell, unless they are Global
        if (activePortfolio === "Trading" && t.portfolio !== "Trading" && t.portfolio !== "Global") {
          return false;
        }
        if (activePortfolio === "Investment" && t.portfolio !== "Investment" && t.portfolio !== "Global") {
          return false;
        }

        const matchesPortfolio = activePortfolio === "Global" || t.portfolio === activePortfolio || t.portfolio === "Global";
        const matchesType = typesToFilter.length === 0 || typesToFilter.includes(t.type);
        const matchesSearch = 
          t.ticker.toLowerCase().includes(searchTerm.toLowerCase()) || 
          t.companyName.toLowerCase().includes(searchTerm.toLowerCase());
        
        const transactionDate = new Date(t.date);
        const matchesStartDate = !startDate || transactionDate >= new Date(startDate);
        const matchesEndDate = !endDate || transactionDate <= new Date(endDate);

        return matchesPortfolio && matchesType && matchesSearch && matchesStartDate && matchesEndDate;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === "date") comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortField === "ticker") comparison = a.ticker.localeCompare(b.ticker);
        if (sortField === "total") comparison = a.total - b.total;
        return sortOrder === "asc" ? comparison : -comparison;
      });
  }, [transactions, activePortfolio, selectedTypes, searchTerm, sortField, sortOrder, startDate, endDate, customStocks]);

  const totals = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      acc.qty += t.qty || 0;
      acc.total += t.total || 0;
      return acc;
    }, { qty: 0, total: 0 });
  }, [filteredTransactions]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredTransactions.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const toggleType = (type: TransactionType) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-3 transition-colors duration-300">
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
              <input
                type="text"
                placeholder="Search stock or company..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setShowTypeFilter(!showTypeFilter)}
                className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-slate-700 dark:text-slate-300 font-medium"
              >
                <Filter size={14} className="text-slate-500 dark:text-slate-400" />
                <span>
                  {selectedTypes.length === 0 
                    ? "All Types" 
                    : `${selectedTypes.length} Type${selectedTypes.length > 1 ? "s" : ""}`}
                </span>
                <ChevronDown size={12} className={cn("transition-transform", showTypeFilter && "rotate-180")} />
              </button>

              {showTypeFilter && (
                <div className="absolute z-30 top-full left-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 animate-in fade-in slide-in-from-top-2">
                  {ALL_TYPES.map(type => (
                    <label key={type} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-slate-600 text-teal-500 focus:ring-teal-500 bg-transparent"
                        checked={selectedTypes.includes(type)}
                        onChange={() => toggleType(type)}
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{type}</span>
                    </label>
                  ))}
                  {selectedTypes.length > 0 && (
                    <button
                      onClick={() => setSelectedTypes([])}
                      className="w-full mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 text-center"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            <select
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-700 dark:text-slate-300 cursor-pointer"
              value={activePortfolio}
              onChange={(e) => setActivePortfolio(e.target.value as any)}
            >
              <option value="Global">Global</option>
              <option value="Investment">Investment</option>
              <option value="Trading">Trading</option>
            </select>
          </div>

          {selectedIds.length > 0 && (
            <button
              onClick={() => { onBulkDelete(selectedIds); setSelectedIds([]); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg font-bold text-[11px] transition-colors border border-red-200 dark:border-red-500/20"
            >
              <Trash2 size={14} />
              Delete ({selectedIds.length})
            </button>
          )}
        </div>

        {/* Date Range Filter */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Calendar size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Date Range:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-700 dark:text-slate-300"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-slate-400 dark:text-slate-600 text-[10px]">to</span>
            <input
              type="date"
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-700 dark:text-slate-300"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                title="Clear Date Range"
              >
                <CloseIcon size={12} />
              </button>
            )}
          </div>
          
          <div className="flex gap-1.5 ml-auto">
            {(() => {
              const now = new Date();
              const formatDateLocal = (date: Date) => {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
              };
              
              const todayStr = formatDateLocal(now);
              const startOfMonthStr = formatDateLocal(new Date(now.getFullYear(), now.getMonth(), 1));
              const startOfYearStr = formatDateLocal(new Date(now.getFullYear(), 0, 1));
              
              const thirtyDaysAgo = new Date(now);
              thirtyDaysAgo.setDate(now.getDate() - 30);
              const last30DaysStr = formatDateLocal(thirtyDaysAgo);
              
              const isLast30Active = startDate === last30DaysStr && endDate === todayStr;
              const isMonthActive = startDate === startOfMonthStr && endDate === todayStr;
              const isYearActive = startDate === startOfYearStr && endDate === todayStr;

              return (
                <>
                  <button
                    onClick={() => {
                      setStartDate(last30DaysStr);
                      setEndDate(todayStr);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all",
                      isLast30Active 
                        ? "bg-teal-500 text-white shadow-lg shadow-teal-500/20" 
                        : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    Last 30 Days
                  </button>
                  <button
                    onClick={() => {
                      setStartDate(startOfMonthStr);
                      setEndDate(todayStr);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all",
                      isMonthActive 
                        ? "bg-teal-500 text-white shadow-lg shadow-teal-500/20" 
                        : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    This Month
                  </button>
                  <button
                    onClick={() => {
                      setStartDate(startOfYearStr);
                      setEndDate(todayStr);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all",
                      isYearActive 
                        ? "bg-teal-500 text-white shadow-lg shadow-teal-500/20" 
                        : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    This Year
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 dark:border-slate-600 text-teal-500 focus:ring-teal-500 bg-transparent"
                    checked={selectedIds.length === filteredTransactions.length && filteredTransactions.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition-colors" onClick={() => toggleSort("date")}>
                  <div className="flex items-center gap-1">
                    Date {sortField === "date" ? (sortOrder === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition-colors" onClick={() => toggleSort("ticker")}>
                  <div className="flex items-center gap-1">
                    Stock {sortField === "ticker" ? (sortOrder === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th className="px-6 py-4 text-right">QTY & PRICE</th>
                <th className="px-6 py-4 text-right cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition-colors" onClick={() => toggleSort("total")}>
                  <div className="flex items-center justify-end gap-1">
                    Total {sortField === "total" ? (sortOrder === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className={cn(
                    "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                    selectedIds.includes(t.id) && "bg-teal-50/50 dark:bg-teal-500/5"
                  )}>
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 dark:border-slate-600 text-teal-500 focus:ring-teal-500 bg-transparent"
                        checked={selectedIds.includes(t.id)}
                        onChange={() => handleSelectOne(t.id)}
                      />
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(t.date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <TypeBadge type={t.type} />
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none uppercase",
                          t.portfolio === "Investment" ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20" : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20"
                        )}>
                          {t.portfolio}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{t.ticker || "-"}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[120px]">{t.companyName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col">
                        <span className="text-slate-700 dark:text-slate-200 font-medium text-[11px]">
                          {formatNumber(t.qty)} x {formatNumber(t.price)}
                        </span>
                        <span className="text-[10px] text-red-500 font-medium">
                          Comm {formatNumber(t.commission)}
                        </span>
                      </div>
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-right font-bold text-[11px]",
                      t.type === "Buy" ? "text-green-600 dark:text-green-400" : 
                      t.type === "Sell" ? "text-red-600 dark:text-red-400" : 
                      "text-slate-800 dark:text-slate-200"
                    )}>
                      {formatCurrency(t.total)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => onEdit(t)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-teal-500 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => onDelete(t.id)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-600">
                      <Search size={48} className="opacity-20" />
                      <p className="text-lg font-medium">No transactions found</p>
                      <p className="text-sm">Try adjusting your filters or add a new transaction.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {filteredTransactions.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 font-bold">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-slate-500 dark:text-slate-400 text-right uppercase tracking-wider text-[10px]">
                    Totals
                  </td>
                  <td className="px-6 py-4 text-right text-slate-800 dark:text-slate-200">
                    {formatNumber(totals.qty)}
                  </td>
                  <td className="px-6 py-4 text-right text-teal-600 dark:text-teal-400">
                    {formatCurrency(totals.total)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
