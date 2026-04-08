import { Transaction, PortfolioType } from "../types";

export interface Holding {
  ticker: string;
  companyName: string;
  qty: number;
  avgBuyPrice: number;
  totalCost: number;
  realizedPnL: number;
  currentValue: number; // For now, we assume current price = avg buy price if not available
}

export function calculatePortfolioStats(
  transactions: Transaction[],
  activePortfolio: PortfolioType
) {
  // Portfolio-specific calculations
  const filteredTransactions = transactions.filter((t) => {
    if (activePortfolio === "Global") return true;
    return t.portfolio === activePortfolio || t.portfolio === "Global";
  });

  // Sort transactions by date and then by type priority to ensure Buy comes before Sell on same day
  const typePriority: Record<string, number> = {
    "Deposit": 1,
    "Buy": 2,
    "Dividend": 3,
    "Sell": 4,
    "Charge": 5
  };

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return (typePriority[a.type] || 99) - (typePriority[b.type] || 99);
  });

  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalCharges = 0;
  let totalDividends = 0;
  let totalCommission = 0;
  let totalBought = 0;
  let totalSold = 0;
  let totalCostOfSold = 0;

  const holdingsMap: Record<string, { 
    qty: number; 
    totalCost: number; 
    realizedPnL: number; 
    costOfSold: number; 
    dividends: number; 
    charges: number;
    companyName: string;
    totalBoughtQty: number;
    totalBoughtCost: number;
    totalSoldQty: number;
    totalSoldValue: number;
  }> = {};

  sortedTransactions.forEach((t) => {
    totalCommission += t.commission;

    if (t.type === "Deposit") {
      totalDeposits += t.total;
    } else if (t.type === "Withdrawal") {
      totalWithdrawals += t.total;
    } else if (t.type === "Charge") {
      // User Request: When "Trading" is selected, Dividend = 0, Charge = 0.
      const shouldInclude = activePortfolio !== "Trading";
      
      if (shouldInclude) {
        totalCharges += t.total;
      }
      
      const key = `${t.portfolio}|${t.ticker}`;
      if (t.ticker) {
        if (!holdingsMap[key]) {
          holdingsMap[key] = { 
            qty: 0, totalCost: 0, realizedPnL: 0, costOfSold: 0, dividends: 0, charges: 0, companyName: t.companyName,
            totalBoughtQty: 0, totalBoughtCost: 0, totalSoldQty: 0, totalSoldValue: 0
          };
        }
        if (shouldInclude) {
          holdingsMap[key].charges += t.total;
        }
      }
    } else if (t.type === "Dividend") {
      // User Request: When "Trading" is selected, Dividend = 0, Charge = 0.
      const shouldInclude = activePortfolio !== "Trading";
      
      if (shouldInclude) {
        totalDividends += t.total;
      }
      
      const key = `${t.portfolio}|${t.ticker}`;
      if (!holdingsMap[key]) {
        holdingsMap[key] = { 
          qty: 0, totalCost: 0, realizedPnL: 0, costOfSold: 0, dividends: 0, charges: 0, companyName: t.companyName,
          totalBoughtQty: 0, totalBoughtCost: 0, totalSoldQty: 0, totalSoldValue: 0
        };
      }
      if (shouldInclude) {
        holdingsMap[key].dividends += t.total;
      }
    } else if (t.type === "Buy") {
      totalBought += t.total;
      const key = `${t.portfolio}|${t.ticker}`;
      if (!holdingsMap[key]) {
        holdingsMap[key] = { 
          qty: 0, totalCost: 0, realizedPnL: 0, costOfSold: 0, dividends: 0, charges: 0, companyName: t.companyName,
          totalBoughtQty: 0, totalBoughtCost: 0, totalSoldQty: 0, totalSoldValue: 0
        };
      }
      holdingsMap[key].qty += t.qty;
      holdingsMap[key].totalCost += t.total;
      holdingsMap[key].totalBoughtQty += t.qty;
      holdingsMap[key].totalBoughtCost += t.total;
    } else if (t.type === "Sell") {
      totalSold += t.total;
      const key = `${t.portfolio}|${t.ticker}`;
      if (holdingsMap[key]) {
        const avgCost = holdingsMap[key].totalCost / holdingsMap[key].qty;
        const costOfSold = t.qty * avgCost;
        const pnl = t.total - costOfSold;
        
        holdingsMap[key].realizedPnL += pnl;
        holdingsMap[key].costOfSold += costOfSold;
        holdingsMap[key].qty -= t.qty;
        holdingsMap[key].totalCost -= costOfSold;
        holdingsMap[key].totalSoldQty += t.qty;
        holdingsMap[key].totalSoldValue += t.total;
        
        totalCostOfSold += costOfSold;

        if (holdingsMap[key].qty <= 0) {
          holdingsMap[key].qty = 0;
          holdingsMap[key].totalCost = 0;
        }
      }
    }
  });
  
  // Aggregate holdings by ticker for display
  const tickerHoldings: Record<string, any> = {};
  Object.entries(holdingsMap).forEach(([key, data]) => {
    const [_, ticker] = key.split("|");
    if (!tickerHoldings[ticker]) {
      tickerHoldings[ticker] = { ...data, ticker };
    } else {
      tickerHoldings[ticker].qty += data.qty;
      tickerHoldings[ticker].totalCost += data.totalCost;
      tickerHoldings[ticker].realizedPnL += data.realizedPnL;
      tickerHoldings[ticker].costOfSold += data.costOfSold;
      tickerHoldings[ticker].dividends += data.dividends;
      tickerHoldings[ticker].charges += data.charges;
      tickerHoldings[ticker].totalBoughtQty += data.totalBoughtQty;
      tickerHoldings[ticker].totalBoughtCost += data.totalBoughtCost;
      tickerHoldings[ticker].totalSoldQty += data.totalSoldQty;
      tickerHoldings[ticker].totalSoldValue += data.totalSoldValue;
    }
  });

  const currentHoldings: (Holding & { 
    dividends: number; 
    charges: number;
    netReturn: number; 
    returnPercent: number;
    pnlPercent: number;
    totalBoughtQty: number;
    totalBoughtCost: number;
    totalSoldQty: number;
    totalSoldValue: number;
  })[] = Object.values(tickerHoldings)
    .filter((data) => data.qty > 0 || data.realizedPnL !== 0 || data.dividends !== 0 || data.charges !== 0)
    .map((data) => {
      const netReturn = data.realizedPnL + data.dividends - Math.abs(data.charges);
      return {
        ticker: data.ticker,
        companyName: data.companyName,
        qty: data.qty,
        avgBuyPrice: data.qty > 0 ? data.totalCost / data.qty : 0,
        totalCost: data.totalCost,
        realizedPnL: data.realizedPnL,
        dividends: data.dividends,
        charges: data.charges,
        costOfSold: data.costOfSold,
        netReturn,
        currentValue: data.totalCost, // Placeholder
        returnPercent: (activePortfolio === "Global" || activePortfolio === "Investment")
          ? (data.totalCost > 0 ? (netReturn / data.totalCost) * 100 : 0)
          : (data.totalBoughtCost > 0 ? (netReturn / data.totalBoughtCost) * 100 : 0),
        pnlPercent: data.costOfSold > 0 ? (data.realizedPnL / data.costOfSold) * 100 : 0,
        totalBoughtQty: data.totalBoughtQty,
        totalBoughtCost: data.totalBoughtCost,
        totalSoldQty: data.totalSoldQty,
        totalSoldValue: data.totalSoldValue
      };
    });

  const totalHoldingCost = currentHoldings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalRealizedPnL = currentHoldings.reduce((sum, h) => sum + h.realizedPnL, 0);
  const totalDividendsSum = currentHoldings.reduce((sum, h) => sum + h.dividends, 0);
  const totalReturnSum = totalRealizedPnL + totalDividendsSum - Math.abs(totalCharges);
  
  const currentBalance = totalDeposits - totalWithdrawals - totalHoldingCost + totalReturnSum;
  const portfolioBalance = currentBalance;
  const investedCapital = totalDeposits - portfolioBalance;
  
  const overallReturnPercent = (activePortfolio === "Global" || activePortfolio === "Investment")
    ? (totalHoldingCost > 0 ? (totalReturnSum / totalHoldingCost) * 100 : 0)
    : (totalBought > 0 ? (totalReturnSum / totalBought) * 100 : 0);
    
  const overallPnlPercent = totalCostOfSold > 0 ? (totalRealizedPnL / totalCostOfSold) * 100 : 0;

  return {
    currentBalance,
    portfolioBalance,
    totalHoldingCost,
    totalRealizedPnL,
    netReturn: totalReturnSum,
    overallReturnPercent,
    overallPnlPercent,
    stocksHeldCount: currentHoldings.filter(h => h.qty > 0).length,
    totalInvestedInHeld: totalHoldingCost,
    totalDeposits,
    totalWithdrawals,
    totalCharges,
    totalDividends,
    totalBought,
    totalSold,
    totalCommission,
    totalCostOfSold,
    currentHoldings,
  };
}
