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
  LabelList,
} from "recharts";
import { Transaction } from "../types";
import { formatNumber, formatChartValue, cn } from "../lib/utils";
import { calculatePortfolioStats } from "../lib/portfolioUtils";

export const THEME = {
  pageBg: "#0d1117",
  cardBg: "#151d2e",
  cardBorder: "#1e2d45",
  gridLines: "#1e2d45",
  mutedText: "#64748b",
  tooltipBg: "#0f1520",
};

export const TICKER_COLORS: Record<string, string> = {
  "MARICO": "#5b8dee",
  "BXPHARMA": "#22c55e",
  "SQURPHARMA": "#f97316",
  "GP": "#7c3aed",
  "RECKITTBEN": "#eab308",
  "IBNSINA": "#06b6d4",
  "BERGERPBL": "#ec4899",
  "RENATA": "#84cc16",
  "LHBL": "#f43f5e",
  "SHAHJABANK": "#14b8a6",
  "OLYMPIC": "#3b82f6",
  "ROBI": "#4ade80",
};

export const DEFAULT_COLORS = [
  "#5b8dee", "#22c55e", "#f97316", "#7c3aed", "#eab308", "#06b6d4", "#ec4899", "#84cc16", "#f43f5e", "#14b8a6", "#3b82f6", "#4ade80"
];

export function ChartContainer({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("p-4 md:p-6 rounded-[12px] border transition-all", className)} style={{ backgroundColor: THEME.cardBg, borderColor: THEME.cardBorder }}>
      <h3 className="text-white text-[13px] md:text-[14px] font-bold mb-4 md:mb-6 text-center uppercase underline decoration-teal-500/50 underline-offset-4 tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function LegendItem({ color, gradient, label, isHidden, onClick }: { color?: string; gradient?: string; label: string; isHidden?: boolean; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded transition-all hover:bg-slate-800/50",
        isHidden && "opacity-40"
      )}
    >
      <div 
        className="w-3 h-3 rounded-sm" 
        style={{ 
          background: gradient || color,
          boxShadow: isHidden ? "none" : `0 0 10px ${color}44`
        }} 
      />
      <span className={cn(
        "text-[11px] font-bold tracking-tight",
        isHidden ? "text-slate-500 line-through" : "text-slate-300"
      )}>
        {label}
      </span>
    </button>
  );
}

function CustomSummaryTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3 rounded-md shadow-xl border-none" style={{ backgroundColor: THEME.tooltipBg }}>
        <p className="text-white font-bold text-[13px] mb-1">{data.name}</p>
        <p className="text-teal-400 text-[12px] font-bold">
          Value: ৳{formatNumber(data.value)}
        </p>
      </div>
    );
  }
  return null;
}

function CustomPieTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3 rounded-md shadow-xl border-none" style={{ backgroundColor: THEME.tooltipBg }}>
        <p className="text-white font-bold text-[13px] mb-1">{data.name}</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
          <p className="text-white text-[12px]">{data.name}: ৳{formatNumber(data.value)}</p>
        </div>
      </div>
    );
  }
  return null;
}

export function TransactionSummaryChart({ transactions }: { transactions: Transaction[] }) {
  const [hiddenSummary, setHiddenSummary] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleHidden = (label: string) => {
    const newSet = new Set(hiddenSummary);
    if (newSet.has(label)) newSet.delete(label);
    else newSet.add(label);
    setHiddenSummary(newSet);
  };

  const transactionSummaryData = useMemo(() => {
    const allStats = calculatePortfolioStats(transactions, "Global");
    const investmentStats = calculatePortfolioStats(transactions, "Investment");
    const tradingStats = calculatePortfolioStats(transactions, "Trading");

    return [
      { name: "Balance", value: allStats.currentBalance, fill: "#06b6d4" },
      { name: "Return", value: allStats.netReturn, fill: "#fbbf24" },
      { name: "Trading", value: tradingStats.totalHoldingCost, fill: "#f97316" },
      { name: "Investment", value: investmentStats.totalHoldingCost, fill: "#22c55e" },
      { name: "Holding", value: allStats.totalHoldingCost, fill: "#14b8a6" },
      { name: "Deposit", value: allStats.totalDeposits, fill: "#5b8dee" },
    ];
  }, [transactions]);

  const maxVal = useMemo(() => {
    const rawMax = Math.max(...transactionSummaryData.map(d => d.value), 100000);
    return Math.ceil(rawMax / 100000) * 100000;
  }, [transactionSummaryData]);

  const xAxisTicks = useMemo(() => {
    const ticks = [];
    const step = isMobile ? 200000 : 100000;
    for (let i = 0; i <= maxVal; i += step) {
      ticks.push(i);
    }
    return ticks;
  }, [maxVal, isMobile]);

  return (
    <ChartContainer title="Transaction Summary" className="w-full">
      <div className={cn("h-[280px]", isMobile && "h-[220px]")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={transactionSummaryData}
            margin={{ top: 5, right: isMobile ? 50 : 80, left: isMobile ? -15 : 10, bottom: 5 }}
            barSize={isMobile ? 18 : 20}
            barCategoryGap={isMobile ? "10%" : "20%"}
          >
            <CartesianGrid stroke={THEME.gridLines} horizontal={true} vertical={!isMobile} strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              domain={[0, maxVal]} 
              ticks={xAxisTicks}
              interval={0}
              axisLine={false}
              tickLine={false}
              tick={{ fill: THEME.mutedText, fontSize: isMobile ? 8 : 9 }}
              tickFormatter={(val) => val === 0 ? "0" : formatChartValue(val)}
              hide={isMobile}
            />
            <YAxis 
              dataKey="name" 
              type="category" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: "white", fontSize: isMobile ? 9 : 11, fontWeight: "bold" }}
              width={isMobile ? 70 : 100}
            />
            <Tooltip 
              content={<CustomSummaryTooltip />} 
              cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} 
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {transactionSummaryData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.fill} 
                  fillOpacity={hiddenSummary.has(entry.name) ? 0 : 1}
                />
              ))}
              <LabelList 
                dataKey="value" 
                position="right" 
                content={(props: any) => {
                  const { x, y, width, value, index } = props;
                  const name = transactionSummaryData[index]?.name;
                  if (hiddenSummary.has(name)) return null;
                  return (
                    <text 
                      x={x + width + (isMobile ? 5 : 10)} 
                      y={y + (isMobile ? 8 : 10)} 
                      fill="white" 
                      fontSize={isMobile ? 9 : 10} 
                      fontWeight="bold" 
                      textAnchor="start"
                      dominantBaseline="middle"
                    >
                      ৳{formatChartValue(value)}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={cn("flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6", isMobile && "gap-x-4 gap-y-1 mt-4")}>
        <LegendItem 
          color="#5b8dee" 
          label="Deposit" 
          isHidden={hiddenSummary.has("Deposit")}
          onClick={() => toggleHidden("Deposit")}
        />
        <LegendItem 
          color="#14b8a6" 
          label="Holding" 
          isHidden={hiddenSummary.has("Holding")}
          onClick={() => toggleHidden("Holding")}
        />
        <LegendItem 
          color="#22c55e" 
          label="Investment" 
          isHidden={hiddenSummary.has("Investment")}
          onClick={() => toggleHidden("Investment")}
        />
        <LegendItem 
          color="#f97316" 
          label="Trading" 
          isHidden={hiddenSummary.has("Trading")}
          onClick={() => toggleHidden("Trading")}
        />
        <LegendItem 
          color="#fbbf24" 
          label="Return" 
          isHidden={hiddenSummary.has("Return")}
          onClick={() => toggleHidden("Return")}
        />
        <LegendItem 
          color="#06b6d4" 
          label="Balance" 
          isHidden={hiddenSummary.has("Balance")}
          onClick={() => toggleHidden("Balance")}
        />
      </div>
    </ChartContainer>
  );
}

export function PortfolioAllocationChart({ stats }: { stats: any }) {
  const [hiddenAllocation, setHiddenAllocation] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleHidden = (label: string) => {
    const newSet = new Set(hiddenAllocation);
    if (newSet.has(label)) newSet.delete(label);
    else newSet.add(label);
    setHiddenAllocation(newSet);
  };

  const tickerAllocationData = useMemo(() => {
    return stats.currentHoldings
      .filter((h: any) => h.totalCost > 0)
      .map((h: any, index: number) => ({
        name: h.ticker,
        value: h.totalCost,
        color: TICKER_COLORS[h.ticker] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
      }))
      .filter((h: any) => !hiddenAllocation.has(h.name))
      .sort((a: any, b: any) => b.value - a.value);
  }, [stats.currentHoldings, hiddenAllocation]);

  const totalValue = useMemo(() => {
    return stats.currentHoldings.reduce((s: number, i: any) => s + i.totalCost, 0);
  }, [stats.currentHoldings]);

  return (
    <ChartContainer title="Portfolio Allocation" className="w-full">
      <div className="flex flex-col md:flex-row items-center h-auto md:h-[350px] gap-4">
        <div className="w-full md:w-2/3 h-[300px] md:h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={tickerAllocationData}
                cx="50%"
                cy="50%"
                innerRadius={isMobile ? 50 : 70}
                outerRadius={isMobile ? 90 : 130}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {tickerAllocationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="w-full md:w-1/3 flex flex-row md:flex-col flex-wrap justify-center md:justify-start gap-2 md:gap-1 overflow-y-auto max-h-[200px] md:max-h-[320px] pr-2 pt-4">
          {stats.currentHoldings
            .filter((h: any) => h.totalCost > 0)
            .sort((a: any, b: any) => b.totalCost - a.totalCost)
            .map((h: any, index: number) => {
              const isHidden = hiddenAllocation.has(h.ticker);
              const color = TICKER_COLORS[h.ticker] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
              const percentage = ((h.totalCost / totalValue) * 100).toFixed(1);

              return (
                <button 
                  key={index} 
                  onClick={() => toggleHidden(h.ticker)}
                  className="flex items-center justify-start gap-2 text-left hover:bg-slate-800/30 p-1 rounded transition-colors"
                >
                  <div 
                    className="w-3 h-3 rounded-sm shrink-0" 
                    style={{ backgroundColor: isHidden ? "#334155" : color }} 
                  />
                  <span className={cn(
                    "text-white text-[10px] md:text-[11px] whitespace-nowrap",
                    isHidden && "line-through text-slate-500"
                  )}>
                    {h.ticker} ({percentage}%)
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    </ChartContainer>
  );
}
