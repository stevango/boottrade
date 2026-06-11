// Paper trading connector — simulates fills against last-known brapi prices.
// Lets the user test the entire OMS + signal pipeline TODAY without any real
// broker credentials. Behavior:
//   - placeOrder: immediately "fills" at the latest brapi price (with ±0.1%
//     slippage for realism)
//   - getAccount: tracks cash + positions in app_settings (per-user state)
//   - cancelOrder: marks pending row cancelled; market orders never pend so
//     this is mostly a no-op
//
// State lives in the bets/positions DB table so the user's paper portfolio
// survives restarts.

import { fetchDailyHistory } from "../marketData";
import { getAppSetting, setAppSetting } from "../db";
import type { BrokerConnector, OrderRequest, OrderResponse, Position, AccountSnapshot } from "./types";

const PAPER_BALANCE_KEY = "PAPER_BALANCE_BRL";
const PAPER_POSITIONS_KEY = "PAPER_POSITIONS_JSON";

async function getPaperBalance(): Promise<number> {
  const v = await getAppSetting(PAPER_BALANCE_KEY);
  if (v != null) {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  // Default starting balance for paper account: R$ 10.000
  await setAppSetting(PAPER_BALANCE_KEY, "10000");
  return 10000;
}

async function setPaperBalance(value: number): Promise<void> {
  await setAppSetting(PAPER_BALANCE_KEY, value.toString());
}

async function getPaperPositions(): Promise<Position[]> {
  const v = await getAppSetting(PAPER_POSITIONS_KEY);
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setPaperPositions(positions: Position[]): Promise<void> {
  await setAppSetting(PAPER_POSITIONS_KEY, JSON.stringify(positions));
}

async function getLastPrice(symbol: string): Promise<number | null> {
  try {
    const hist = await fetchDailyHistory(symbol, "1mo");
    if (!hist.points || hist.points.length === 0) return null;
    return hist.points[hist.points.length - 1].close;
  } catch {
    return null;
  }
}

function simulateSlippage(price: number): number {
  // +/- 0.1% to mimic spread
  const factor = 1 + (Math.random() * 0.002 - 0.001);
  return Math.round(price * factor * 100) / 100;
}

let paperOrderCounter = 1;

// Resets the paper portfolio back to its starting state.
export async function resetPaperPortfolio(startingBalance = 10000): Promise<void> {
  await setPaperBalance(startingBalance);
  await setPaperPositions([]);
}

export const paperConnector: BrokerConnector = {
  name: "Paper",
  market: "B3",

  async isConfigured() {
    return true; // always
  },

  async testConnection() {
    return { ok: true, message: "Paper trading: sempre disponível." };
  },

  async getAccount(): Promise<AccountSnapshot> {
    const cash = await getPaperBalance();
    const positions = await getPaperPositions();
    let totalEquity = cash;
    for (const p of positions) {
      const last = await getLastPrice(p.asset.symbol);
      if (last != null) {
        p.marketValue = p.quantity * last;
        p.unrealizedPnl = (last - p.averageEntryPrice) * p.quantity;
        totalEquity += p.marketValue;
      }
    }
    return { cashAvailable: cash, totalEquity, currency: "BRL", positions };
  },

  async getPositions() {
    return getPaperPositions();
  },

  async getOrder() {
    return null; // paper trading fills immediately, no order history outside the bets table
  },

  async listOpenOrders() {
    return []; // all paper orders fill immediately
  },

  async placeOrder(req: OrderRequest): Promise<OrderResponse> {
    const last = await getLastPrice(req.asset.symbol);
    if (last == null) {
      return {
        brokerOrderId: `paper-${Date.now()}-${paperOrderCounter++}`,
        status: "REJECTED",
        asset: req.asset, side: req.side, quantity: req.quantity, filledQuantity: 0,
        message: `Sem cotação disponível pra ${req.asset.symbol}`,
        placedAt: new Date().toISOString(),
      };
    }
    const fillPrice = req.orderType === "LIMIT" ? Math.min(req.limitPrice ?? last, last) : simulateSlippage(last);
    const cost = fillPrice * req.quantity;
    const cash = await getPaperBalance();
    const positions = await getPaperPositions();

    if (req.side === "BUY") {
      if (cost > cash) {
        return {
          brokerOrderId: `paper-${Date.now()}-${paperOrderCounter++}`,
          status: "REJECTED",
          asset: req.asset, side: req.side, quantity: req.quantity, filledQuantity: 0,
          message: `Saldo paper insuficiente: R$ ${cash.toFixed(2)} disponível, R$ ${cost.toFixed(2)} necessário.`,
          placedAt: new Date().toISOString(),
        };
      }
      // Increase position or open new
      const existing = positions.find((p) => p.asset.symbol === req.asset.symbol);
      if (existing) {
        const totalCost = existing.averageEntryPrice * existing.quantity + cost;
        existing.quantity += req.quantity;
        existing.averageEntryPrice = totalCost / existing.quantity;
      } else {
        positions.push({ asset: req.asset, quantity: req.quantity, averageEntryPrice: fillPrice });
      }
      await setPaperBalance(cash - cost);
      await setPaperPositions(positions);
    } else {
      // SELL — must have position
      const existing = positions.find((p) => p.asset.symbol === req.asset.symbol);
      if (!existing || existing.quantity < req.quantity) {
        return {
          brokerOrderId: `paper-${Date.now()}-${paperOrderCounter++}`,
          status: "REJECTED",
          asset: req.asset, side: req.side, quantity: req.quantity, filledQuantity: 0,
          message: `Posição paper insuficiente em ${req.asset.symbol}.`,
          placedAt: new Date().toISOString(),
        };
      }
      existing.quantity -= req.quantity;
      const realized = (fillPrice - existing.averageEntryPrice) * req.quantity;
      const filtered = positions.filter((p) => p.quantity > 0);
      await setPaperBalance(cash + cost);
      await setPaperPositions(filtered);
      // realized PnL is implicit in the cash change
      void realized;
    }

    return {
      brokerOrderId: `paper-${Date.now()}-${paperOrderCounter++}`,
      status: "FILLED",
      asset: req.asset, side: req.side, quantity: req.quantity,
      filledQuantity: req.quantity,
      averagePrice: fillPrice,
      placedAt: new Date().toISOString(),
    };
  },

  async cancelOrder() {
    return { ok: true, message: "Paper orders fill immediately, nada a cancelar." };
  },
};
