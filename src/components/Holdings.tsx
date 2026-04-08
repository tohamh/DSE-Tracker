import { useState, useMemo } from "react";
import { Briefcase, TrendingUp, TrendingDown, Info, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import { CustomStock, PortfolioType } from "../types";
import { formatCurrency, formatNumber, cn, getStockName } from "../lib/utils";
import { PortfolioAllocationChart } from "./Charts";

type SortField = 
  | "ticker" 
  | "avgBuyPrice" 
  | "totalCost" 
  | "totalBoughtCost" 
  | "totalSoldValue" 
  | "realizedPnL" 
  | "pnlPercent" 
  | "netReturn" 
  | "returnPercent";
type SortDirection = "asc" | "desc";

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface HoldingsProps {
  stats: any;
  activePortfolio: PortfolioType;
  customStocks: CustomStock[];
}

export default function Holdings({ 
  stats, 
  activePortfolio, 
  customStocks
}: HoldingsProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: "ticker", direction: "asc" });
  const [searchTerm, setSearchTerm] = useState("");
  
  // Resolve current company names from customStocks
  const holdings = useMemo(() => {
    let filtered = stats.currentHoldings;
    if (activePortfolio === "Investment") {
      filtered = filtered.filter((h: any) => h.qty > 0);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((h: any) => 
        h.ticker.toLowerCase().includes(term) || 
        getStockName(h.ticker, customStocks).toLowerCase().includes(term)
      );
    }

    return filtered.map((h: any) => ({
      ...h,
      companyName: getStockName(h.ticker, customStocks)
    }));
  }, [stats.currentHoldings, customStocks, activePortfolio, searchTerm]);

  const sortedHoldings = useMemo(() => {
    const sortableItems = [...holdings];

    if (sortConfig.field) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.field as keyof typeof a];
        let bValue = b[sortConfig.field as keyof typeof b];

        if (sortConfig.field === "ticker") {
          aValue = a.ticker;
          bValue = b.ticker;
        }

        if (typeof aValue === "string") {
          return sortConfig.direction === "asc" 
            ? aValue.localeCompare(bValue as string) 
            : (bValue as string).localeCompare(aValue);
        }

        return sortConfig.direction === "asc" 
          ? (aValue as number) - (bValue as number) 
          : (bValue as number) - (aValue as number);
      });
    }
    return sortableItems;
  }, [holdings, sortConfig]);

  const totals = useMemo(() => {
    return sortedHoldings.reduce((acc: any, h: any) => ({
      totalCost: acc.totalCost + h.totalCost,
      totalBoughtCost: acc.totalBoughtCost + h.totalBoughtCost,
      totalSoldValue: acc.totalSoldValue + h.totalSoldValue,
      realizedPnL: acc.realizedPnL + h.realizedPnL,
      dividends: acc.dividends + (h.dividends || 0),
      netReturn: acc.netReturn + (h.netReturn || 0)
    }), { 
      totalCost: 0, 
      totalBoughtCost: 0, 
      totalSoldValue: 0, 
      realizedPnL: 0, 
      dividends: 0, 
      netReturn: 0 
    });
  }, [sortedHoldings]);

  const getDisplayTotal = () => {
    const field = sortConfig.field;
    const summableFields = ["totalCost", "totalBoughtCost", "totalSoldValue", "realizedPnL", "netReturn"];
    
    if (summableFields.includes(field)) {
      const labels: Record<string, string> = {
        totalCost: "Total Cost",
        totalBoughtCost: "Total Buy",
        totalSoldValue: "Total Sell",
        realizedPnL: "Total Realized P&L",
        netReturn: "Net Return"
      };
      return {
        label: labels[field],
        value: formatCurrency(totals[field])
      };
    }
    
    return {
      label: "Total Cost",
      value: formatCurrency(totals.totalCost)
    };
  };

  const displayTotal = getDisplayTotal();

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field: field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortConfig.field !== field) return <ArrowUpDown size={12} className="ml-1 opacity-30" />;
    return sortConfig.direction === "asc" 
      ? <ArrowUp size={12} className="ml-1 text-teal-500" /> 
      : <ArrowDown size={12} className="ml-1 text-teal-500" />;
  };

  return (
    <div className="space-y-6">
      <PortfolioAllocationChart stats={stats} />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Briefcase className="text-teal-500" />
          Current Holdings
        </h2>
        
        <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Ticker Search */}
          <div className="relative col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search ticker..."
              className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all w-full md:w-48"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 col-span-1">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:inline">Sort by:</span>
            <select 
              className="bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer flex-1"
              value={sortConfig.field}
              onChange={(e) => handleSort(e.target.value as any)}
            >
              <option value="ticker" className="bg-white dark:bg-slate-900">Ticker</option>
              <option value="avgBuyPrice" className="bg-white dark:bg-slate-900">Avg Cost</option>
              <option value="totalCost" className="bg-white dark:bg-slate-900">Current Holding</option>
              <option value="totalBoughtCost" className="bg-white dark:bg-slate-900">Total Buy</option>
              <option value="totalSoldValue" className="bg-white dark:bg-slate-900">Total Sell</option>
              <option value="realizedPnL" className="bg-white dark:bg-slate-900">Realized P&L</option>
              <option value="pnlPercent" className="bg-white dark:bg-slate-900">P&L %</option>
              <option value="netReturn" className="bg-white dark:bg-slate-900">Net Return</option>
              <option value="returnPercent" className="bg-white dark:bg-slate-900">Return %</option>
            </select>
            <button 
              onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === "asc" ? "desc" : "asc" }))}
              className="text-teal-500 hover:text-teal-600 transition-colors"
            >
              {sortConfig.direction === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>
          </div>

          <div className="bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 px-4 py-2 rounded-lg border border-teal-100 dark:border-teal-500/20 text-xs font-bold col-span-2 md:col-span-1 text-center md:text-left whitespace-nowrap">
            {displayTotal.label}: {displayTotal.value}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {sortedHoldings.length > 0 ? (
          sortedHoldings.map((h: any) => {
            const returnPercent = h.returnPercentWithUnrealized;
            
            return (
              <div key={h.ticker} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-300 hover:shadow-md">
                {/* Card Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex flex-col">
                    <h3 className="text-lg font-black text-teal-600 dark:text-teal-400 tracking-tight leading-none">{h.ticker}</h3>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">{h.companyName}</span>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider",
                    activePortfolio === "Investment" ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20" : 
                    activePortfolio === "Trading" ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20" :
                    "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  )}>
                    {activePortfolio === "Global" ? "Global" : activePortfolio}
                  </span>
                </div>

                {/* Card Content - Stats Grid */}
                <div className="p-4 md:p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 group relative">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Avg Cost</p>
                        <div className="relative">
                          <Info size={10} className="text-slate-300 dark:text-slate-600 cursor-help" />
                          <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 dark:bg-slate-700 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-normal">
                            Average price paid per share currently held
                          </div>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatCurrency(h.avgBuyPrice)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 group relative">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Current Holding</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">{formatNumber(h.qty)}</span>
                          <div className="relative">
                            <Info size={10} className="text-slate-300 dark:text-slate-600 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 dark:bg-slate-700 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-normal">
                              Total cost basis and quantity of shares currently held
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatCurrency(h.totalCost)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 group relative">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Total Buy</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">{formatNumber(h.totalBoughtQty)}</span>
                          <div className="relative">
                            <Info size={10} className="text-slate-300 dark:text-slate-600 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 dark:bg-slate-700 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-normal">
                              Total amount spent and total quantity of shares ever bought
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatCurrency(h.totalBoughtCost)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 group relative">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Total Sell</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">{formatNumber(h.totalSoldQty)}</span>
                          <div className="relative">
                            <Info size={10} className="text-slate-300 dark:text-slate-600 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 dark:bg-slate-700 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-normal">
                              Total amount received and total quantity of shares ever sold
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatCurrency(h.totalSoldValue)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 group relative">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Realized P&L</p>
                        <div className="relative">
                          <Info size={10} className="text-slate-300 dark:text-slate-600 cursor-help" />
                          <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 dark:bg-slate-700 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-normal">
                            Profit or loss from completed trades (sold shares)
                          </div>
                        </div>
                      </div>
                      <p className={cn(
                        "text-sm font-bold",
                        h.realizedPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      )}>
                        {formatCurrency(h.realizedPnL)}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 group relative">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">P&L %</p>
                        <div className="relative">
                          <Info size={10} className="text-slate-300 dark:text-slate-600 cursor-help" />
                          <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 dark:bg-slate-700 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-normal">
                            (Realized P&L / Total Cost of Sold Shares) × 100
                          </div>
                        </div>
                      </div>
                      <p className={cn(
                        "text-sm font-bold",
                        h.pnlPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      )}>
                        {h.pnlPercent >= 0 ? "+" : ""}{formatNumber(h.pnlPercent)}%
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 group relative">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Net Return</p>
                        <div className="relative">
                          <Info size={10} className="text-slate-300 dark:text-slate-600 cursor-help" />
                          <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 dark:bg-slate-700 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-normal">
                            Realized P&L + Dividends - Charges for this stock
                          </div>
                        </div>
                      </div>
                      <p className={cn(
                        "text-sm font-bold",
                        h.netReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      )}>
                        {formatCurrency(h.netReturn)}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 group relative">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Return %</p>
                        <div className="relative">
                          <Info size={10} className="text-slate-300 dark:text-slate-600 cursor-help" />
                          <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 dark:bg-slate-700 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-normal">
                            {activePortfolio === "Trading" ? "(Net Return / Total Amount Ever Bought) × 100" : "(Net Return / Current Holding Cost) × 100"}
                          </div>
                        </div>
                      </div>
                      <p className={cn(
                        "text-sm font-bold",
                        h.returnPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      )}>
                        {h.returnPercent >= 0 ? "+" : ""}{formatNumber(h.returnPercent)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-20 text-center border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-600">
              <Briefcase size={48} className="opacity-20" />
              <p className="text-lg font-medium">No holdings in this portfolio</p>
            </div>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 p-4 rounded-lg flex gap-3 items-start">
        <Info className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" size={20} />
        <div className="text-xs text-blue-700 dark:text-blue-300">
          <p className="font-bold mb-1">About Holdings Calculation</p>
          <p>
            Holdings are calculated based on your buy and sell transactions. 
            "Current Holding" represents your cost basis. 
            "Realized P&L" is the profit or loss from stocks you have already sold.
          </p>
        </div>
      </div>
    </div>
  );
}
