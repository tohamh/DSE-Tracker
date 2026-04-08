import { useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Briefcase, 
  ArrowUpRight, 
  History,
  Info,
  Wallet
} from "lucide-react";
import { Transaction, ActiveSection, CustomStock, PortfolioType } from "../types";
import { formatCurrency, formatNumber, cn, getStockName } from "../lib/utils";
import { TransactionSummaryChart } from "./Charts";

interface DashboardProps {
  stats: any;
  allStats: any;
  investmentStats: any;
  tradingStats: any;
  transactions: Transaction[];
  setActiveSection: (section: ActiveSection) => void;
  customStocks: CustomStock[];
  activePortfolio: PortfolioType;
}

export default function Dashboard({ 
  stats, 
  allStats, 
  investmentStats, 
  tradingStats, 
  transactions, 
  setActiveSection,
  customStocks,
  activePortfolio
}: DashboardProps) {
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8)
      .map(t => ({
        ...t,
        companyName: getStockName(t.ticker, customStocks)
      }));
  }, [transactions, customStocks]);

  const returnPercent = stats.overallReturnPercent;
  const pnlPercent = stats.overallPnlPercent;
  
  // Global Return Calculation
  const allTotalReturn = allStats.netReturn;
  const allReturnPercent = allStats.overallReturnPercent;

  return (
    <div className="space-y-8">
      {/* Primary Stats - Always Global */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Cash Balance" 
          value={formatCurrency(allStats.currentBalance)} 
          icon={DollarSign}
          color="blue"
          valueColor={allStats.currentBalance >= 0 ? "green" : "red"}
          description="Total Deposit - Total Withdrawal - Current Holding + Net Return"
          extraInfo={<div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800" />}
        />
        <StatCard 
          title="Total Deposit" 
          value={formatCurrency(allStats.totalDeposits)} 
          icon={Wallet}
          color="teal"
          description="Total money deposited into Global portfolios"
          extraInfo={<div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800" />}
        />
        <StatCard 
          title="Current Holding" 
          value={formatCurrency(allStats.totalHoldingCost)} 
          icon={Briefcase}
          color="blue"
          description="Total cost basis of currently held stocks across Global portfolios"
          extraInfo={
            <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[9px] text-slate-500 dark:text-slate-400 font-medium">
              <div className="flex justify-between">
                <span>Investment:</span>
                <span className="text-slate-700 dark:text-slate-200">{formatCurrency(investmentStats.totalHoldingCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Trading:</span>
                <span className="text-slate-700 dark:text-slate-200">{formatCurrency(tradingStats.totalHoldingCost)}</span>
              </div>
            </div>
          }
        />
        <StatCard 
          title={
            <span className="flex items-center gap-1">
              <span>Net Return</span>
              <span className={allReturnPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                ({allReturnPercent >= 0 ? "+" : ""}{formatNumber(allReturnPercent)}%)
              </span>
            </span>
          }
          value={formatCurrency(allTotalReturn)} 
          icon={allTotalReturn >= 0 ? TrendingUp : TrendingDown}
          color={allTotalReturn >= 0 ? "green" : "red"}
          description="Total Dividend + Realized P&L - absolute value of Charge across Global portfolios"
          extraInfo={
            <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[9px] text-slate-500 dark:text-slate-400 font-medium">
              <div className="flex justify-between">
                <span>Investment:</span>
                <span className={investmentStats.netReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {formatCurrency(investmentStats.netReturn)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Trading:</span>
                <span className={tradingStats.netReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {formatCurrency(tradingStats.netReturn)}
                </span>
              </div>
            </div>
          }
        />
      </div>

      {/* Secondary Stats - Context Sensitive */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(activePortfolio === "Global" || activePortfolio === "Investment") ? (
          <>
            <MiniStatCard 
              title="Total Withdrawal" 
              value={formatCurrency(stats.totalWithdrawals)} 
              valueColor="text-red-600 dark:text-red-400"
              description="Total money withdrawn from the selected portfolio"
            />
            <MiniStatCard 
              title="Total Charge" 
              value={formatCurrency(Math.abs(stats.totalCharges))} 
              valueColor="text-orange-600 dark:text-orange-400"
              description="Total account charges across the selected portfolio"
            />
            <MiniStatCard 
              title="Total Dividend" 
              value={formatCurrency(stats.totalDividends)} 
              valueColor="text-purple-600 dark:text-purple-400"
              description="Total dividends received across the selected portfolio"
            />
            <MiniStatCard 
              title="Realized P&L" 
              value={formatCurrency(stats.totalRealizedPnL)} 
              valueColor={stats.totalRealizedPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
              description="Profit or loss from completed trades (sold shares)"
            />
          </>
        ) : (
          <>
            <MiniStatCard 
              title="Realized P&L" 
              value={formatCurrency(stats.totalRealizedPnL)} 
              valueColor={stats.totalRealizedPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
              description="Profit or loss from completed trades (sold shares)"
            />
            <MiniStatCard 
              title="P&L %" 
              value={`${pnlPercent >= 0 ? "+" : ""}${formatNumber(pnlPercent)}%`} 
              valueColor={pnlPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
              description="(Realized P&L / Total Cost of Sold Shares) × 100"
            />
            <MiniStatCard 
              title="Net Return"
              value={formatCurrency(stats.netReturn)} 
              valueColor={stats.netReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
              description="Realized P&L + Dividends - Charges"
            />
            <MiniStatCard 
              title="Return %" 
              value={`${returnPercent >= 0 ? "+" : ""}${formatNumber(returnPercent)}%`} 
              valueColor={returnPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
              description="(Net Return / Total Amount Ever Bought) × 100"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Transaction Summary */}
        <TransactionSummaryChart transactions={transactions} />

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <History size={18} className="text-teal-500" />
              Recent Transactions
            </h3>
            <button 
              onClick={() => setActiveSection("Transaction")}
              className="text-teal-500 hover:text-teal-600 text-sm font-semibold flex items-center gap-1"
            >
              View All <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Stock</th>
                  <th className="px-6 py-4 text-right">QTY & PRICE</th>
                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
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
                            {t.qty ? `${formatNumber(t.qty)} x ${formatNumber(t.price)}` : "-"}
                          </span>
                          {t.commission > 0 && (
                            <span className="text-[10px] text-red-500 font-medium">
                              Comm {formatNumber(t.commission)}
                            </span>
                          )}
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
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400 dark:text-slate-600 italic">
                      No transactions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, subValue, description, className, extraInfo, valueColor }: any) {
  const colorClasses: any = {
    teal: "bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400",
    blue: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
    green: "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400",
    red: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
    purple: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };

  const textColors: any = {
    green: "text-green-600 dark:text-green-400",
    red: "text-red-600 dark:text-red-400",
    default: "text-slate-800 dark:text-white",
  };

  return (
    <div className={cn("bg-white dark:bg-slate-900 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-3 md:gap-4", className)}>
      <div className="flex items-start justify-between">
        <div className={cn("p-2 md:p-3 rounded-lg", colorClasses[color])}>
          <Icon size={20} className="md:w-6 md:h-6" />
        </div>
        <div className="group relative">
          <Info size={14} className="text-slate-300 dark:text-slate-600 cursor-help md:w-4 md:h-4" />
          <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 dark:bg-slate-700 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
            {description}
          </div>
        </div>
      </div>
      <div>
        <p className="text-[10px] md:text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 truncate">{title}</p>
        <h2 className={cn("text-sm md:text-lg font-bold", valueColor ? textColors[valueColor] : textColors.default)}>{value}</h2>
        {subValue && (
          <p className={cn(
            "text-[10px] md:text-xs font-semibold mt-1",
            subValue.startsWith("+") ? "text-green-600 dark:text-green-400" : subValue.startsWith("-") ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"
          )}>
            {subValue}
          </p>
        )}
        {extraInfo}
      </div>
    </div>
  );
}

function MiniStatCard({ title, value, valueColor, description }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm relative group">
      <div className="flex justify-between items-start mb-1">
        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{title}</p>
        {description && (
          <div className="relative">
            <Info size={12} className="text-slate-300 dark:text-slate-600 cursor-help" />
            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 dark:bg-slate-700 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
              {description}
            </div>
          </div>
        )}
      </div>
      <p className={cn("text-xs font-bold", valueColor || "text-slate-700 dark:text-slate-200")}>{value}</p>
    </div>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const classes: any = {
    Buy: "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20",
    Sell: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20",
    Deposit: "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
    Withdrawal: "bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
    Charge: "bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20",
    Dividend: "bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
  };

  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
      classes[type] || "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
    )}>
      {type}
    </span>
  );
}
