import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, Search, CalendarIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Transaction, TransactionType, CustomStock, PortfolioType } from "../types";
import { cn, formatCurrency } from "../lib/utils";

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (t: Transaction) => void;
  stocks: CustomStock[];
  commissionRate: number;
  editingTransaction: Transaction | null;
}

// ── Date helpers ──────────────────────────────────────────
// Internal storage is always YYYY-MM-DD (safe for sorting/saving)
// Display is always DD / MM / YYYY

function todayParts() {
  const now = new Date();
  return {
    d: String(now.getDate()).padStart(2, "0"),
    m: String(now.getMonth() + 1).padStart(2, "0"),
    y: String(now.getFullYear()),
  };
}

function isoToparts(iso: string) {
  const [y, m, d] = iso.split("-");
  return { d, m, y };
}

function partsToIso(d: string, m: string, y: string) {
  return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
}

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

function daysInMonth(m: string, y: string) {
  return new Date(parseInt(y), parseInt(m), 0).getDate();
}

// ── Component ─────────────────────────────────────────────
export default function AddTransactionModal({
  isOpen,
  onClose,
  onAdd,
  stocks,
  commissionRate,
  editingTransaction,
}: AddTransactionModalProps) {
  // Internal date stored as YYYY-MM-DD
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Display parts
  const initParts = todayParts();
  const [day,   setDay]   = useState(initParts.d);
  const [month, setMonth] = useState(initParts.m);
  const [year,  setYear]  = useState(initParts.y);

  const [type, setType] = useState<TransactionType>("Buy");
  const [portfolio, setPortfolio] = useState<PortfolioType>("Investment");
  const [ticker, setTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [commission, setCommission] = useState("");
  const [isManualCommission, setIsManualCommission] = useState(false);
  const [notes, setNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showStockList, setShowStockList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const stockListRef = useRef<HTMLDivElement>(null);

  // Keep ISO date in sync whenever any part changes
  useEffect(() => {
    if (day && month && year && year.length === 4) {
      setDate(partsToIso(day, month, year));
    }
  }, [day, month, year]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (stockListRef.current && !stockListRef.current.contains(event.target as Node)) {
        setShowStockList(false);
      }
    }
    if (showStockList) document.addEventListener("mousedown", handleClickOutside);
    else document.removeEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showStockList]);

  useEffect(() => {
    if (editingTransaction) {
      const p = isoToparts(editingTransaction.date);
      setDay(p.d); setMonth(p.m); setYear(p.y);
      setDate(editingTransaction.date);
      setType(editingTransaction.type);
      setPortfolio(editingTransaction.portfolio);
      setTicker(editingTransaction.ticker);
      setCompanyName(editingTransaction.companyName);
      setQty(editingTransaction.qty.toString());
      setPrice(editingTransaction.price.toString());
      setCommission(editingTransaction.commission.toString());
      setNotes(editingTransaction.notes || "");
    } else {
      resetForm();
    }
  }, [editingTransaction, isOpen]);

  const resetForm = () => {
    const p = todayParts();
    setDay(p.d); setMonth(p.m); setYear(p.y);
    setDate(new Date().toISOString().split("T")[0]);
    setType("Buy");
    setPortfolio("Investment");
    setTicker(""); setCompanyName("");
    setQty(""); setPrice(""); setCommission("");
    setIsManualCommission(false);
    setNotes(""); setSearchTerm(""); setActiveIndex(-1);
  };

  const filteredStocks = useMemo(() => {
    if (!searchTerm) return [];
    return stocks.filter(s =>
      s.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.companyName.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10);
  }, [stocks, searchTerm]);

  useEffect(() => { setActiveIndex(-1); }, [searchTerm]);

  const calculatedCommission = useMemo(() => {
    if (type !== "Buy" && type !== "Sell") return 0;
    if (isManualCommission) return parseFloat(commission) || 0;
    const q = parseFloat(qty) || 0;
    const p = parseFloat(price) || 0;
    return q * p * (commissionRate / 100);
  }, [qty, price, commissionRate, isManualCommission, commission, type]);

  const total = useMemo(() => {
    const q = parseFloat(qty) || 0;
    const p = parseFloat(price) || 0;
    const comm = calculatedCommission;
    if (type === "Buy" || type === "Charge") return q * p + comm;
    return q * p - comm;
  }, [qty, price, calculatedCommission, type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTransaction: Transaction = {
      id: editingTransaction?.id || crypto.randomUUID(),
      date,
      type,
      portfolio,
      ticker: ticker.toUpperCase(),
      companyName,
      qty: parseFloat(qty) || 0,
      price: parseFloat(price) || 0,
      commission: calculatedCommission,
      total,
      notes,
    };
    onAdd(newTransaction);
    resetForm();
  };

  const selectStock = (stock: CustomStock) => {
    setTicker(stock.ticker);
    setCompanyName(stock.companyName);
    setSearchTerm(stock.ticker);
    setShowStockList(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showStockList || filteredStocks.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(prev => Math.min(prev + 1, filteredStocks.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(prev => Math.max(prev - 1, 0)); }
    else if ((e.key === "Enter" || e.key === "Tab") && activeIndex >= 0) { e.preventDefault(); selectStock(filteredStocks[activeIndex]); }
    else if (e.key === "Escape") setShowStockList(false);
  };

  // Build day options dynamically based on selected month/year
  const maxDay = daysInMonth(month, year || "2024");
  const dayOptions = Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, "0"));
  const yearOptions = Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i));

  const selectClass = "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 md:px-3 md:py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-[12px] md:text-sm text-slate-800 dark:text-slate-100 w-full";

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-white">
              {editingTransaction ? "Edit Transaction" : "Add Transaction"}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 md:p-5 space-y-3 md:space-y-4">
            <div className="grid grid-cols-2 gap-2 md:gap-4">

              {/* ── Date: DD / MM / YYYY dropdowns ── */}
              <div className="space-y-1 col-span-2">
                <label className="h-4 md:h-5 text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarIcon size={12} /> Date
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Day */}
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Day</span>
                    <select
                      value={day}
                      onChange={(e) => setDay(e.target.value)}
                      className={selectClass}
                    >
                      {dayOptions.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  {/* Month */}
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Month</span>
                    <select
                      value={month}
                      onChange={(e) => {
                        setMonth(e.target.value);
                        // Clamp day if needed
                        const max = daysInMonth(e.target.value, year || "2024");
                        if (parseInt(day) > max) setDay(String(max).padStart(2, "0"));
                      }}
                      className={selectClass}
                    >
                      {MONTHS.map((name, i) => (
                        <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Year */}
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Year</span>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className={selectClass}
                    >
                      {yearOptions.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Type */}
              <div className="space-y-1">
                <label className="h-4 md:h-5 text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center">Type</label>
                <select
                  value={type}
                  className={selectClass}
                  onChange={(e) => {
                    setType(e.target.value as TransactionType);
                    setIsManualCommission(false);
                  }}
                >
                  <option value="Buy">Buy</option>
                  <option value="Sell">Sell</option>
                  <option value="Deposit">Deposit</option>
                  <option value="Withdrawal">Withdrawal</option>
                  <option value="Charge">Charge</option>
                  <option value="Dividend">Dividend</option>
                </select>
              </div>

              {/* Portfolio */}
              <div className="space-y-1 col-span-2">
                <label className="h-4 md:h-5 text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center">Portfolio</label>
                <div className="flex gap-2 md:gap-4">
                  {["Investment", "Trading"].map((p) => (
                    <label key={p} className="flex-1 cursor-pointer">
                      <input type="radio" name="portfolio" className="hidden peer" checked={portfolio === p} onChange={() => setPortfolio(p as any)} />
                      <div className={cn(
                        "w-full text-center py-1.5 md:py-2 rounded-lg md:rounded-xl border font-bold text-[11px] md:text-sm transition-all",
                        portfolio === p
                          ? "bg-teal-500 text-white border-teal-500 shadow-md shadow-teal-500/20"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                      )}>
                        {p}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Ticker / Stock Search */}
              <div className="space-y-1 relative col-span-2" ref={stockListRef}>
                <label className="h-4 md:h-5 text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Search size={12} /> Ticker / Stock
                </label>
                <input
                  type="text"
                  placeholder="Search ticker or company..."
                  className={selectClass}
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setShowStockList(true); }}
                  onFocus={() => setShowStockList(true)}
                  onKeyDown={handleKeyDown}
                />
                {showStockList && filteredStocks.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg md:rounded-xl shadow-xl max-h-40 overflow-y-auto">
                    {filteredStocks.map((s, index) => (
                      <button
                        key={s.ticker}
                        type="button"
                        onClick={() => selectStock(s)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 flex flex-col transition-colors border-b border-slate-50 dark:border-slate-700 last:border-0",
                          index === activeIndex ? "bg-teal-50 dark:bg-teal-500/10" : "hover:bg-teal-50/50 dark:hover:bg-teal-500/5"
                        )}
                      >
                        <span className="font-bold text-[12px] md:text-sm text-slate-800 dark:text-slate-200">{s.ticker}</span>
                        <span className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 truncate">{s.companyName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="space-y-1">
                <label className="h-4 md:h-5 text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center">Quantity</label>
                <input
                  type="number" step="any" required placeholder="0.00"
                  className={selectClass}
                  value={qty} onChange={(e) => setQty(e.target.value)}
                />
              </div>

              {/* Price */}
              <div className="space-y-1">
                <label className="h-4 md:h-5 text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center">Price (৳)</label>
                <input
                  type="number" step="any" required placeholder="0.00"
                  className={selectClass}
                  value={price} onChange={(e) => setPrice(e.target.value)}
                />
              </div>

              {/* Commission */}
              {(type === "Buy" || type === "Sell") && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between h-4 md:h-5">
                    <label className="text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Comm (৳)</label>
                    <button
                      type="button"
                      onClick={() => setIsManualCommission(!isManualCommission)}
                      className={cn(
                        "text-[8px] md:text-[10px] font-bold px-1.5 py-0.5 rounded uppercase transition-all",
                        isManualCommission ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      )}
                    >
                      {isManualCommission ? "Man" : "Auto"}
                    </button>
                  </div>
                  <input
                    type="number" step="any"
                    readOnly={!isManualCommission}
                    className={cn(
                      "w-full border rounded-lg md:rounded-xl px-2 py-1.5 md:px-3 md:py-2 focus:outline-none transition-all text-[12px] md:text-sm",
                      isManualCommission
                        ? "bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-500/50 text-slate-800 dark:text-slate-100"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                    )}
                    value={isManualCommission ? commission : calculatedCommission.toFixed(2)}
                    onChange={(e) => setCommission(e.target.value)}
                  />
                </div>
              )}

              {/* Total */}
              <div className="space-y-1">
                <label className="h-4 md:h-5 text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center">Total (৳)</label>
                <div className="w-full bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 rounded-lg md:rounded-xl px-2 py-1.5 md:px-3 md:py-2 font-bold text-teal-700 dark:text-teal-400 text-sm md:text-lg">
                  {formatCurrency(total)}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="h-4 md:h-5 text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center">Notes (Optional)</label>
              <textarea
                placeholder="Add details..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg md:rounded-xl px-2 py-1.5 md:px-3 md:py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all h-12 md:h-16 resize-none text-[12px] md:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </form>

          {/* Footer */}
          <div className="p-2 md:p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-2 md:gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 md:px-4 md:py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-xs md:text-sm transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-1.5 md:px-6 md:py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-lg shadow-teal-500/20 transition-all active:scale-95"
            >
              {editingTransaction ? "Update" : "Add Transaction"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
