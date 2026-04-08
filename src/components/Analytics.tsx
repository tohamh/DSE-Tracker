import React, { useMemo, useState, useEffect } from "react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  LabelList,
  ReferenceLine,
  ComposedChart,
  Line,
} from "recharts";
import { Transaction } from "../types";
import { formatCurrency, formatNumber, formatChartValue, cn } from "../lib/utils";
import { 
  THEME, 
  TICKER_COLORS, 
  DEFAULT_COLORS, 
  ChartContainer, 
  LegendItem 
} from "./Charts";

interface AnalyticsProps {
  transactions: Transaction[];
  stats: any;
  activePortfolio: string;
}

type FilterType = "This Year" | "Last 12 Months" | "Custom";
type ReturnViewType = "Monthly" | "Cumulative";
type ReturnFilterType = "This Year" | "Last 12 Months" | "Custom";
type HistoryViewType = "Monthly" | "Cumulative";

export default function Analytics({ transactions, stats, activePortfolio }: AnalyticsProps) {
  const [filterType, setFilterType] = useState<FilterType>("Last 12 Months");
  const [historyView, setHistoryView] = useState<HistoryViewType>("Monthly");
  const [returnView, setReturnView] = useState<ReturnViewType>("Monthly");
  const [returnFilterType, setReturnFilterType] = useState<ReturnFilterType>("Last 12 Months");
  const [returnByStockType, setReturnByStockType] = useState<"Dividend" | "Realized P&L">(
    (activePortfolio === "Global" || activePortfolio === "Investment") ? "Dividend" : "Realized P&L"
  );
  
  // Sync returnByStockType when activePortfolio changes
  useEffect(() => {
    setReturnByStockType((activePortfolio === "Global" || activePortfolio === "Investment") ? "Dividend" : "Realized P&L");
  }, [activePortfolio]);
  
  // Hidden series states
  const [hiddenHistory, setHiddenHistory] = useState<Set<string>>(new Set());
  const [hiddenReturn, setHiddenReturn] = useState<Set<string>>(new Set());
  const [hiddenPnlByStock, setHiddenPnlByStock] = useState<Set<string>>(new Set());

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleHidden = (set: Set<string>, setter: React.Dispatch<React.SetStateAction<Set<string>>>, label: string) => {
    const newSet = new Set(set);
    if (newSet.has(label)) newSet.delete(label);
    else newSet.add(label);
    setter(newSet);
  };

  const [returnCustomRange, setReturnCustomRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().slice(0, 7),
    end: new Date().toISOString().slice(0, 7),
  });
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().slice(0, 7),
    end: new Date().toISOString().slice(0, 7),
  });

  // 3. Return by Stock
  const returnByStockData = useMemo(() => {
    const isDividend = returnByStockType === "Dividend";
    return stats.currentHoldings
      .filter((h: any) => isDividend ? h.dividends !== 0 : h.realizedPnL !== 0)
      .map((h: any) => ({
        name: h.ticker,
        value: isDividend ? h.dividends : h.realizedPnL,
      }))
      .filter((h: any) => !hiddenPnlByStock.has(h.name))
      .sort((a: any, b: any) => b.value - a.value);
  }, [stats.currentHoldings, hiddenPnlByStock, returnByStockType]);

  // 4. Monthly History Data (Grouped Bar Chart)
  const monthlyHistoryData = useMemo(() => {
    const months: Record<string, any> = {};
    
    const getMonthLabel = (date: Date) => {
      return date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    };

    const now = new Date();
    const currentYear = now.getFullYear();
    
    let filteredTransactions = transactions;

    if (filterType === "This Year") {
      filteredTransactions = transactions.filter(t => new Date(t.date).getFullYear() === currentYear);
    } else if (filterType === "Last 12 Months") {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      filteredTransactions = transactions.filter(t => new Date(t.date) >= twelveMonthsAgo);
    } else if (filterType === "Custom") {
      const start = new Date(customRange.start + "-01");
      const end = new Date(customRange.end + "-01");
      end.setMonth(end.getMonth() + 1); // Include the end month
      filteredTransactions = transactions.filter(t => {
        const d = new Date(t.date);
        return d >= start && d < end;
      });
    }

    filteredTransactions.forEach(t => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!months[monthKey]) {
        months[monthKey] = { 
          monthKey, 
          label: getMonthLabel(date),
          deposit: 0, 
          investmentBuy: 0, 
          tradingBuy: 0, 
          tradingSell: 0,
          pnl: 0, 
          dividend: 0,
        };
      }
      
      if (t.type === "Deposit") {
        months[monthKey].deposit += t.total;
      } else if (t.type === "Buy") {
        if (t.portfolio === "Investment") months[monthKey].investmentBuy += t.total;
        else if (t.portfolio === "Trading") months[monthKey].tradingBuy += t.total;
      } else if (t.type === "Sell") {
        if (t.portfolio === "Trading") months[monthKey].tradingSell += t.total;
      } else if (t.type === "Dividend") {
        months[monthKey].dividend += t.total;
      }
    });

    // Calculate P&L for sales and Cumulative values
    const sortedT = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const holdings: Record<string, { qty: number, cost: number }> = {};
    
    let runningDeposit = 0;
    let runningInvestmentCost = 0;
    let runningTradingCost = 0;

    // We need to iterate through ALL transactions to get correct cumulative values,
    // but only record them for the months present in our filtered 'months' object.
    sortedT.forEach(t => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Update running totals
      if (t.type === "Deposit") {
        runningDeposit += t.total;
      } else if (t.type === "Buy") {
        const key = `${t.portfolio}|${t.ticker}`;
        if (!holdings[key]) holdings[key] = { qty: 0, cost: 0 };
        holdings[key].qty += t.qty;
        holdings[key].cost += t.total;
        
        if (t.portfolio === "Investment") runningInvestmentCost += t.total;
        else if (t.portfolio === "Trading") runningTradingCost += t.total;
      } else if (t.type === "Sell") {
        const key = `${t.portfolio}|${t.ticker}`;
        if (holdings[key] && holdings[key].qty > 0) {
          const avgCost = holdings[key].cost / holdings[key].qty;
          const costOfSold = t.qty * avgCost;
          const pnl = t.total - costOfSold;
          
          if (months[monthKey]) months[monthKey].pnl += pnl;
          
          holdings[key].qty -= t.qty;
          holdings[key].cost -= costOfSold;
          
          if (t.portfolio === "Investment") runningInvestmentCost -= costOfSold;
          else if (t.portfolio === "Trading") runningTradingCost -= costOfSold;
        }
      }

      // Record cumulative state if this month is in our view
      if (months[monthKey]) {
        months[monthKey].cumDeposit = runningDeposit;
        months[monthKey].cumInvestment = runningInvestmentCost;
        months[monthKey].cumTrading = runningTradingCost;
      }
    });

    return Object.values(months)
      .map(m => {
        const netTrading = m.tradingBuy - m.tradingSell;
        return {
          ...m,
          netTrading,
          totalBuy: m.investmentBuy + netTrading,
          cumTotalPortfolio: (m.cumInvestment || 0) + (m.cumTrading || 0)
        };
      })
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [transactions, filterType, customRange]);

  // 5. Return History Data
  const returnHistoryData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // 1. Get all months and their monthly values
    const sortedT = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const holdings: Record<string, { qty: number, cost: number }> = {};
    const monthMap: Record<string, any> = {};
    
    sortedT.forEach(t => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          monthKey,
          label: date.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
          pnl: 0,
          dividend: 0,
          charge: 0,
          date: new Date(date.getFullYear(), date.getMonth(), 1)
        };
      }

      const key = `${t.portfolio}|${t.ticker}`;
      if (t.type === "Buy") {
        if (!holdings[key]) holdings[key] = { qty: 0, cost: 0 };
        holdings[key].qty += t.qty;
        holdings[key].cost += t.total;
      } else if (t.type === "Sell") {
        if (holdings[key] && holdings[key].qty > 0) {
          const avgCost = holdings[key].cost / holdings[key].qty;
          const costOfSold = t.qty * avgCost;
          const pnl = t.total - costOfSold;
          monthMap[monthKey].pnl += pnl;
          holdings[key].qty -= t.qty;
          holdings[key].cost -= costOfSold;
        }
      } else if (t.type === "Dividend") {
        monthMap[monthKey].dividend += t.total;
      } else if (t.type === "Charge") {
        monthMap[monthKey].charge += t.total;
      }
    });

    let allMonths = Object.values(monthMap).sort((a: any, b: any) => a.monthKey.localeCompare(b.monthKey));

    // 2. If Cumulative, calculate running totals
    if (returnView === "Cumulative") {
      let runningPnl = 0;
      let runningDividend = 0;
      let runningCharge = 0;
      allMonths = allMonths.map((m: any) => {
        runningPnl += m.pnl;
        runningDividend += m.dividend;
        runningCharge += m.charge;
        return {
          ...m,
          pnl: runningPnl,
          dividend: runningDividend,
          charge: runningCharge,
          netReturn: runningPnl + runningDividend - Math.abs(runningCharge),
          labelY: Math.max(0, runningPnl) + runningDividend
        };
      });
    } else {
      allMonths = allMonths.map((m: any) => ({
        ...m,
        netReturn: m.pnl + m.dividend - Math.abs(m.charge),
        labelY: Math.max(0, m.pnl) + m.dividend
      }));
    }

    // 3. Filter by date range
    let data = allMonths;
    if (returnFilterType === "This Year") {
      data = data.filter(m => new Date(m.monthKey + "-01").getFullYear() === currentYear);
    } else if (returnFilterType === "Last 12 Months") {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      data = data.filter(m => new Date(m.monthKey + "-01") >= twelveMonthsAgo);
    } else if (returnFilterType === "Custom") {
      const start = new Date(returnCustomRange.start + "-01");
      const end = new Date(returnCustomRange.end + "-01");
      end.setMonth(end.getMonth() + 1);
      data = data.filter(m => {
        const d = new Date(m.monthKey + "-01");
        return d >= start && d < end;
      });
    }

    // Remove leading months with no data
    const firstDataIndex = data.findIndex(m => m.pnl !== 0 || m.dividend !== 0);
    if (firstDataIndex !== -1) {
      data = data.slice(firstDataIndex);
    }

    return data;
  }, [transactions, returnView, returnFilterType, returnCustomRange]);

  const yAxisTicksReturn = useMemo(() => {
    if (returnHistoryData.length === 0) return [0];
    const values = returnHistoryData.flatMap(d => [d.pnl, d.dividend, d.netReturn]);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 2000);
    
    const interval = 2000;
    
    const start = Math.floor(min / interval) * interval;
    const end = Math.ceil(max / interval) * interval;
    
    const ticks = [];
    for (let i = start; i <= end; i += interval) {
      ticks.push(i);
    }
    return ticks;
  }, [returnHistoryData]);

  const yAxisTicksMonthly = useMemo(() => {
    if (monthlyHistoryData.length === 0) return [0];
    
    let values: number[] = [];
    let interval = 25000;

    if (historyView === "Monthly") {
      values = monthlyHistoryData.flatMap(d => [d.deposit, d.investmentBuy + Math.max(0, d.netTrading), d.netTrading]);
    } else {
      values = monthlyHistoryData.flatMap(d => [d.cumDeposit || 0, (d.cumInvestment || 0) + (d.cumTrading || 0)]);
      // For cumulative, if values are large, increase interval
      const max = Math.max(...values, 0);
      if (max > 1000000) interval = 200000;
      else if (max > 500000) interval = 100000;
      else if (max > 250000) interval = 50000;
    }

    const min = Math.min(...values, 0);
    const max = Math.max(...values, interval);
    
    const start = Math.floor(min / interval) * interval;
    const end = Math.ceil(max / interval) * interval;
    
    const ticks = [];
    for (let i = start; i <= end; i += interval) {
      ticks.push(i);
    }
    return ticks;
  }, [monthlyHistoryData, historyView]);

  return (
    <div className="space-y-8 p-4 md:p-6">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-6 text-center uppercase underline decoration-teal-500/50 underline-offset-8 tracking-widest">
        Charts & Analytics
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">

        {/* Transaction History */}
        <ChartContainer title="Transaction History" className="lg:col-span-10">
          <div className="flex flex-col gap-4 mb-8">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
                {(["Monthly", "Cumulative"] as HistoryViewType[]).map((view) => (
                  <button
                    key={view}
                    onClick={() => setHistoryView(view)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                      historyView === view 
                        ? "bg-teal-500 text-white shadow-lg" 
                        : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                    )}
                  >
                    {view}
                  </button>
                ))}
              </div>

              <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
                {(["This Year", "Last 12 Months", "Custom"] as FilterType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                      filterType === type 
                        ? "bg-teal-500 text-white shadow-lg" 
                        : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {filterType === "Custom" && (
              <div className="flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <input
                  type="month"
                  value={customRange.start}
                  onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-teal-500"
                />
                <span className="text-slate-500 text-xs">to</span>
                <input
                  type="month"
                  value={customRange.end}
                  onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-teal-500"
                />
              </div>
            )}
          </div>

          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={monthlyHistoryData}
                margin={{ top: 20, right: isMobile ? 10 : 30, left: isMobile ? -20 : 40, bottom: isMobile ? 20 : 5 }}
                barGap={2}
                stackOffset="sign"
              >
                <CartesianGrid stroke={THEME.gridLines} vertical={false} strokeDasharray="3 3" />
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: THEME.mutedText, fontSize: isMobile ? 9 : 11 }}
                  angle={isMobile ? -45 : 0}
                  textAnchor={isMobile ? "end" : "middle"}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  ticks={yAxisTicksMonthly}
                  tick={{ fill: THEME.mutedText, fontSize: isMobile ? 9 : 11 }}
                  tickFormatter={(val) => `৳${formatChartValue(val)}`}
                  width={isMobile ? 45 : 60}
                />
                <Tooltip content={<CustomMonthlyTooltip view={historyView} />} cursor={false} />
                
                <Bar 
                  dataKey={historyView === "Monthly" ? "deposit" : "cumDeposit"} 
                  name={historyView === "Monthly" ? "Deposit" : "Total Deposit"} 
                  stackId="deposit" 
                  fill="#5b8dee" 
                  radius={[3, 3, 0, 0]} 
                  barSize={isMobile ? 12 : 20}
                  hide={hiddenHistory.has("Deposit")}
                >
                  {(!isMobile || monthlyHistoryData.length <= 6) && (
                    <LabelList 
                      dataKey={historyView === "Monthly" ? "deposit" : "cumDeposit"} 
                      position="top" 
                      angle={-90} 
                      offset={10}
                      formatter={(val: any) => val === 0 ? "" : formatChartValue(val)}
                      style={{ fill: THEME.mutedText, fontSize: 10, fontWeight: 'bold', textAnchor: 'start' }}
                    />
                  )}
                </Bar>
                <Bar 
                  dataKey={historyView === "Monthly" ? "netTrading" : "cumTrading"} 
                  name={historyView === "Monthly" ? "Net Trading" : "Trading Portfolio"} 
                  stackId="buy" 
                  fill="#f97316" 
                  barSize={isMobile ? 12 : 20} 
                  hide={hiddenHistory.has("Trading")}
                />
                <Bar 
                  dataKey={historyView === "Monthly" ? "investmentBuy" : "cumInvestment"} 
                  name={historyView === "Monthly" ? "Investment Buy" : "Investment Portfolio"} 
                  stackId="buy" 
                  fill="#22c55e" 
                  radius={[3, 3, 0, 0]} 
                  barSize={isMobile ? 12 : 20}
                  hide={hiddenHistory.has("Investment")}
                >
                  {(!isMobile || monthlyHistoryData.length <= 6) && (
                    <LabelList 
                      dataKey={historyView === "Monthly" ? "totalBuy" : "cumTotalPortfolio"} 
                      position="top" 
                      angle={-90} 
                      offset={10}
                      formatter={(val: any) => val === 0 ? "" : formatChartValue(val)}
                      style={{ fill: THEME.mutedText, fontSize: 10, fontWeight: 'bold', textAnchor: 'start' }}
                    />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-8">
            <LegendItem 
              color="#5b8dee" 
              label={historyView === "Monthly" ? "Deposit" : "Total Deposit"} 
              isHidden={hiddenHistory.has("Deposit")}
              onClick={() => toggleHidden(hiddenHistory, setHiddenHistory, "Deposit")}
            />
            <LegendItem 
              color="#f97316" 
              label={historyView === "Monthly" ? "Net Trading" : "Trading Portfolio"} 
              isHidden={hiddenHistory.has("Trading")}
              onClick={() => toggleHidden(hiddenHistory, setHiddenHistory, "Trading")}
            />
            <LegendItem 
              color="#22c55e" 
              label={historyView === "Monthly" ? "Investment Buy" : "Investment Portfolio"} 
              isHidden={hiddenHistory.has("Investment")}
              onClick={() => toggleHidden(hiddenHistory, setHiddenHistory, "Investment")}
            />
          </div>
        </ChartContainer>

        {/* Return History */}
        <ChartContainer title="Return History" className="lg:col-span-10">
          <div className="flex flex-col gap-4 mb-8">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
                {(["Monthly", "Cumulative"] as ReturnViewType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setReturnView(type)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                      returnView === type 
                        ? "bg-teal-500 text-white shadow-lg" 
                        : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
                {(["This Year", "Last 12 Months", "Custom"] as ReturnFilterType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setReturnFilterType(type)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                      returnFilterType === type 
                        ? "bg-teal-500 text-white shadow-lg" 
                        : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {returnFilterType === "Custom" && (
              <div className="flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <input
                  type="month"
                  value={returnCustomRange.start}
                  onChange={(e) => setReturnCustomRange({ ...returnCustomRange, start: e.target.value })}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-teal-500"
                />
                <span className="text-slate-500 text-xs">to</span>
                <input
                  type="month"
                  value={returnCustomRange.end}
                  onChange={(e) => setReturnCustomRange({ ...returnCustomRange, end: e.target.value })}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-teal-500"
                />
              </div>
            )}
          </div>

          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={returnHistoryData}
                margin={{ top: 20, right: isMobile ? 10 : 30, left: isMobile ? -20 : 40, bottom: isMobile ? 20 : 5 }}
                stackOffset="sign"
              >
                <CartesianGrid stroke={THEME.gridLines} vertical={false} strokeDasharray="3 3" />
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: THEME.mutedText, fontSize: isMobile ? 9 : 11 }}
                  angle={isMobile ? -45 : 0}
                  textAnchor={isMobile ? "end" : "middle"}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  ticks={yAxisTicksReturn}
                  tick={{ fill: THEME.mutedText, fontSize: isMobile ? 9 : 11 }}
                  tickFormatter={(val) => `৳${formatChartValue(val)}`}
                  width={isMobile ? 45 : 60}
                />
                <Tooltip content={<CustomReturnTooltip />} cursor={false} />
                <ReferenceLine y={0} stroke={THEME.gridLines} />
                
                <Bar 
                  dataKey="pnl" 
                  name="Realized P&L" 
                  stackId="a"
                  radius={[2, 2, 0, 0]} 
                  barSize={isMobile ? 16 : 24}
                  hide={hiddenReturn.has("P&L")}
                >
                  {returnHistoryData.map((entry, index) => (
                    <Cell key={`cell-pnl-${index}`} fill={entry.pnl >= 0 ? "#22c55e" : "#f43f5e"} />
                  ))}
                </Bar>

                <Bar 
                  dataKey="dividend" 
                  name="Dividend" 
                  stackId="a"
                  fill="#7c3aed" 
                  radius={[2, 2, 0, 0]} 
                  barSize={isMobile ? 16 : 24}
                  hide={hiddenReturn.has("Dividend")}
                />

                {/* Line component with stroke="none" used solely for centered labels above bars */}
                <Line 
                  dataKey="labelY" 
                  stroke="none" 
                  dot={false} 
                  activeDot={false}
                  isAnimationActive={false}
                >
                  {(!isMobile || returnHistoryData.length <= 6) && (
                    <LabelList 
                      dataKey="netReturn" 
                      position="top" 
                      offset={10}
                      formatter={(val: any) => val === 0 ? "" : formatChartValue(val)}
                      style={{ fill: THEME.mutedText, fontSize: 10, fontWeight: 'bold' }}
                    />
                  )}
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-8">
            <LegendItem 
              gradient="linear-gradient(135deg, #22c55e 50%, #f43f5e 50%)" 
              label="Realized P&L" 
              isHidden={hiddenReturn.has("P&L")}
              onClick={() => toggleHidden(hiddenReturn, setHiddenReturn, "P&L")}
            />
            <LegendItem 
              color="#7c3aed" 
              label="Dividend" 
              isHidden={hiddenReturn.has("Dividend")}
              onClick={() => toggleHidden(hiddenReturn, setHiddenReturn, "Dividend")}
            />
          </div>
        </ChartContainer>

        {/* Return by Stock */}
        <ChartContainer title="Return by Stock" className="lg:col-span-10">
          <div className="flex justify-center mb-6">
            <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
              {(["Dividend", "Realized P&L"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setReturnByStockType(type)}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                    returnByStockType === type 
                      ? "bg-teal-500 text-white shadow-lg" 
                      : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: Math.max(400, returnByStockData.length * (isMobile ? 30 : 35)) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={returnByStockData}
                margin={{ top: 5, right: isMobile ? 45 : 100, left: isMobile ? 0 : 20, bottom: 20 }}
                barSize={isMobile ? 16 : 22}
                barCategoryGap="25%"
              >
                <CartesianGrid stroke={THEME.gridLines} horizontal={false} vertical={true} strokeDasharray="3 3" />
                <XAxis 
                  type="number" 
                  axisLine={true}
                  tickLine={true}
                  tick={{ fill: THEME.mutedText, fontSize: isMobile ? 8 : 10 }}
                  tickFormatter={(val) => formatChartValue(val)}
                  domain={['dataMin - 500', 'dataMax + 500']}
                  ticks={(() => {
                    const values = returnByStockData.map(d => d.value);
                    if (values.length === 0) return [0, 500];
                    const minVal = Math.min(...values, 0);
                    const maxVal = Math.max(...values, 0);
                    
                    const ticks = [];
                    const start = Math.floor(minVal / 500) * 500;
                    const end = Math.ceil(maxVal / 500) * 500;
                    
                    for (let i = start; i <= end; i += 500) {
                      ticks.push(i);
                    }
                    return ticks;
                  })()}
                />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: THEME.mutedText, fontSize: isMobile ? 9 : 12, fontWeight: 'bold' }}
                  width={isMobile ? 65 : 110}
                  interval={0}
                  minTickGap={0}
                />
                <Tooltip content={<CustomReturnByStockTooltip type={returnByStockType} />} cursor={false} />
                <ReferenceLine x={0} stroke={THEME.mutedText} strokeWidth={2} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {returnByStockData.map((entry: any, index: number) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.value >= 0 ? (returnByStockType === "Dividend" ? "#7c3aed" : "#22c55e") : "#f43f5e"} 
                    />
                  ))}
                  <LabelList 
                    dataKey="value" 
                    content={(props: any) => {
                      const { x, y, width, height, value } = props;
                      const isPositive = value >= 0;
                      const textX = isPositive ? x + width + (isMobile ? 4 : 8) : x - (isMobile ? 4 : 8);
                      const textAnchor = isPositive ? "start" : "end";
                      
                      return (
                        <text 
                          x={textX} 
                          y={y + height / 2} 
                          fill="white" 
                          textAnchor={textAnchor} 
                          dominantBaseline="middle"
                          style={{ fontSize: isMobile ? 8 : 10, fontWeight: 'bold' }}
                        >
                          {`৳${formatChartValue(value)}`}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent, bg, isFirst, isLast }: { 
  label: string; 
  value: number; 
  accent: string; 
  bg: string;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  return (
    <div 
      className={cn(
        "flex-1 h-[80px] p-[10px_12px] md:p-[14px_18px] border-l-[4px] flex flex-col justify-center relative",
        "border-r border-b md:border-b-0 border-slate-800/50"
      )}
      style={{ 
        backgroundColor: bg, 
        borderLeftColor: accent,
      }}
    >
      <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: accent }}>{label}</p>
      <p className="text-white font-bold flex items-baseline gap-1">
        <span className="text-xs md:text-sm opacity-80">৳</span>
        <span className="text-[18px] md:text-[24px] leading-none">{formatNumber(Math.abs(value))}</span>
      </p>
    </div>
  );
}

function CustomReturnByStockTooltip({ active, payload, type }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3 rounded-md shadow-xl border-none" style={{ backgroundColor: THEME.tooltipBg }}>
        <p className="text-white font-bold text-[13px] mb-1">{data.name}</p>
        <p className={cn("text-[12px] font-bold", data.value >= 0 ? "text-teal-400" : "text-red-400")}>
          {type}: ৳{formatNumber(data.value)}
        </p>
      </div>
    );
  }
  return null;
}

function CustomMonthlyTooltip({ active, payload, label, view }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isCumulative = view === "Cumulative";

    return (
      <div className="p-3 rounded-md shadow-xl border-none min-w-[220px]" style={{ backgroundColor: THEME.tooltipBg }}>
        <p className="text-white font-bold text-[13px] mb-2 border-b border-slate-700 pb-1">
          {label} {isCumulative ? "(Cumulative)" : ""}
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm bg-[#5b8dee]" />
              <p className="text-slate-300 text-[11px]">{isCumulative ? "Total Deposit" : "Monthly Deposit"}</p>
            </div>
            <p className="text-white text-[11px] font-mono">৳{formatNumber(isCumulative ? data.cumDeposit : data.deposit)}</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm bg-[#22c55e]" />
              <p className="text-slate-300 text-[11px]">{isCumulative ? "Investment Portfolio" : "Investment Buy"}</p>
            </div>
            <p className="text-white text-[11px] font-mono">৳{formatNumber(isCumulative ? data.cumInvestment : data.investmentBuy)}</p>
          </div>

          {!isCumulative ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm bg-[#f97316]" />
                  <p className="text-slate-300 text-[11px]">Trading Buy</p>
                </div>
                <p className="text-white text-[11px] font-mono">৳{formatNumber(data.tradingBuy)}</p>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm bg-red-400" />
                  <p className="text-slate-300 text-[11px]">Trading Sell</p>
                </div>
                <p className="text-white text-[11px] font-mono">৳{formatNumber(data.tradingSell)}</p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-sm bg-[#f97316]" />
                <p className="text-slate-300 text-[11px]">Trading Portfolio</p>
              </div>
              <p className="text-white text-[11px] font-mono">৳{formatNumber(data.cumTrading)}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm bg-orange-500" />
              <p className="text-slate-300 text-[11px] font-bold">
                {isCumulative ? "Total Portfolio Value" : "Net Trading"}
              </p>
            </div>
            <p className={cn("text-[11px] font-mono font-bold", (isCumulative ? data.cumTotalPortfolio : data.netTrading) >= 0 ? "text-green-400" : "text-red-400")}>
              ৳{formatNumber(isCumulative ? data.cumTotalPortfolio : data.netTrading)}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function CustomReturnTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3 rounded-md shadow-xl border-none min-w-[180px]" style={{ backgroundColor: THEME.tooltipBg }}>
        <p className="text-white font-bold text-[13px] mb-2 border-b border-slate-700 pb-1">{label}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm bg-[#7c3aed]" />
              <p className="text-slate-300 text-[11px]">Dividend</p>
            </div>
            <p className="text-white text-[11px] font-mono">৳{formatNumber(data.dividend)}</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm bg-[#fbbf24]" />
              <p className="text-slate-300 text-[11px]">Realized P&L</p>
            </div>
            <p className={cn("text-[11px] font-mono font-bold", data.pnl >= 0 ? "text-green-400" : "text-red-400")}>
              ৳{formatNumber(data.pnl)}
            </p>
          </div>

          {data.charge > 0 && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-sm bg-red-500" />
                <p className="text-slate-300 text-[11px]">Charge</p>
              </div>
              <p className="text-red-400 text-[11px] font-mono">৳{formatNumber(data.charge)}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <p className="text-slate-300 text-[11px] font-bold">Net Return</p>
            </div>
            <p className={cn("text-[11px] font-mono font-bold", (data.pnl + data.dividend - Math.abs(data.charge || 0)) >= 0 ? "text-green-400" : "text-red-400")}>
              ৳{formatNumber(data.pnl + data.dividend - Math.abs(data.charge || 0))}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
}


