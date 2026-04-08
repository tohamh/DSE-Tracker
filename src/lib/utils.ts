import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CustomStock } from "../types";
import { DSE_STOCKS } from "../constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getStockName(ticker: string, customStocks: CustomStock[]) {
  if (!ticker) return "-";
  const custom = customStocks.find(s => s.ticker === ticker);
  if (custom) return custom.companyName;
  
  const defaultStock = DSE_STOCKS.find(s => s.ticker === ticker);
  return defaultStock ? defaultStock.companyName : ticker;
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace("BDT", "৳");
}

export function formatNumber(num: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatChartValue(num: number) {
  const absNum = Math.abs(num);
  if (absNum >= 1000000) {
    const lVal = num / 100000;
    return Number.isInteger(lVal) ? `${lVal}L` : `${lVal.toFixed(1)}L`;
  }
  if (absNum >= 1000) {
    const kVal = num / 1000;
    return Number.isInteger(kVal) ? `${kVal}k` : `${kVal.toFixed(1)}k`;
  }
  return Math.round(num).toString();
}
