import { Transaction, PortfolioType } from "../types";

export interface Holding {
  ticker: string;
  companyName: string;
  qty: number;
  avgBuyPrice: number;
  totalCost: number;
  realizedPnL: number;
  currentValue: number;
}

export function calculatePortfolioStats(
  transactions: Transaction[],
  activePortfolio: PortfolioType
) {
  const filteredTransactions = transactions.filter((t) => {
    if (activePortfolio === "Global") return true;
    return t.portfolio === activePortfolio || t.portfolio === "Global";
  });

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

  // ── Direct accumulators (used for cash balance) ──
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalCharges = 0;     // always positive, always subtracted
  let totalDividends = 0;   // always positive, always added
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
    totalCommission += t.commission || 0;

    if (t.type === "Deposit") {
      totalDeposits += Math.abs(t.total);

    } else if (t.type === "Withdrawal") {
      totalWithdrawals += Math.abs(t.total);

    } else if (t.type === "Charge") {
      // ✅ FIX: always treat charge as positive and subtract from balance
      const chargeAmount = Math.abs(t.total);
      if (activePortfolio !== "Trading") {
        totalCharges += chargeAmount;
      }
      if (t.ticker) {
        const key = `${t.portfolio}|${t.ticker}`;
        if (!holdingsMap[key]) {
          holdingsMap[key] = {
            qty: 0, totalCost: 0, realizedPnL: 0, costOfSold: 0,
            dividends: 0, charges: 0, companyName: t.companyName,
            totalBoughtQty: 0, totalBoughtCost: 0, totalSoldQty: 0, totalSoldValue: 0
          };
        }
        if (activePortfolio !== "Trading") {
          holdingsMap[key].charges += chargeAmount;
        }
      }

    } else if (t.type === "Dividend") {
      const dividendAmount = Math.abs(t.total);
      if (activePortfolio !== "Trading") {
        totalDividends += dividendAmount;
      }
      const key = `${t.portfolio}|${t.ticker}`;
      if (!holdingsMap[key]) {
        holdingsMap[key] = {
          qty: 0, totalCost: 0, realizedPnL: 0, costOfSold: 0,
          dividends: 0, charges: 0, companyName: t.companyName,
          totalBoughtQty: 0, totalBoughtCost: 0, totalSoldQty: 0, totalSoldValue: 0
        };
      }
      if (activePortfolio !== "Trading") {
        holdingsMap[key].dividends += dividendAmount;
      }

    } else if (t.type === "Buy") {
      totalBought += t.total;
      const key = `${t.portfolio}|${t.ticker}`;
      if (!holdingsMap[key]) {
        holdingsMap[key] = {
          qty: 0, totalCost: 0, realizedPnL: 0, costOfSold: 0,
          dividends: 0, charges: 0, companyName: t.companyName,
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
      if (holdingsMap[key] && holdingsMap[key].qty > 0) {
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

  // Aggregate holdings by ticker
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
      const netReturn = data.realizedPnL + data.dividends - data.charges;
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
        currentValue: data.totalCost,
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

  // ✅ FIX: explicit, unambiguous balance formula
  // Cash = what you deposited, minus what you withdrew, minus what you spent on stocks still held,
  //        plus what you got from selling, plus dividends, minus charges
  
const currentBalance =
    totalDeposits
    - totalWithdrawals
    - totalHoldingCost
    + totalRealizedPnL   // ✅ add back profit/loss from sold stocks
    + totalDividends
    - totalCharges;
  
  const totalReturnSum = totalRealizedPnL + totalDividends - totalCharges;

  const overallReturnPercent = (activePortfolio === "Global" || activePortfolio === "Investment")
    ? (totalHoldingCost > 0 ? (totalReturnSum / totalHoldingCost) * 100 : 0)
    : (totalBought > 0 ? (totalReturnSum / totalBought) * 100 : 0);

  const overallPnlPercent = totalCostOfSold > 0 ? (totalRealizedPnL / totalCostOfSold) * 100 : 0;

  return {
    currentBalance,
    portfolioBalance: currentBalance,
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
