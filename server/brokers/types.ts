// Common contract every broker connector implements. Keeps the OMS
// (Order Manager) and the signal pipeline agnostic to which broker is
// actually routing orders — Clear, IB, Cedro, BTG, Paper, etc.

export type Asset = {
  symbol: string;          // "PETR4", "AAPL", "BTCBRL", etc
  market?: "B3" | "NASDAQ" | "NYSE" | "FX" | "CRYPTO";
};

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT";
export type TimeInForce = "DAY" | "GTC" | "IOC" | "FOK";

export type OrderRequest = {
  asset: Asset;
  side: OrderSide;
  quantity: number;            // in shares/contracts, not BRL
  orderType: OrderType;
  limitPrice?: number;          // required for LIMIT
  stopPrice?: number;           // required for STOP
  timeInForce?: TimeInForce;    // default DAY
  clientOrderId?: string;       // idempotency key
};

export type OrderStatus = "PENDING_SUBMIT" | "SUBMITTED" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" | "REJECTED" | "EXPIRED";

export type OrderResponse = {
  brokerOrderId: string;
  status: OrderStatus;
  asset: Asset;
  side: OrderSide;
  quantity: number;
  filledQuantity: number;
  averagePrice?: number;
  message?: string;
  placedAt: string;            // ISO
};

export type Position = {
  asset: Asset;
  quantity: number;
  averageEntryPrice: number;
  marketValue?: number;
  unrealizedPnl?: number;
};

export type AccountSnapshot = {
  cashAvailable: number;       // BRL or USD depending on broker
  totalEquity: number;
  marginUsed?: number;
  currency: string;            // "BRL" | "USD" | etc
  positions: Position[];
};

export type BrokerConnector = {
  name: string;
  market: "B3" | "NASDAQ" | "NYSE" | "FX" | "CRYPTO" | "MULTI";

  // Connectivity
  isConfigured(): Promise<boolean>;
  testConnection(): Promise<{ ok: boolean; message: string }>;

  // Reading
  getAccount(): Promise<AccountSnapshot>;
  getPositions(): Promise<Position[]>;
  getOrder(brokerOrderId: string): Promise<OrderResponse | null>;
  listOpenOrders(): Promise<OrderResponse[]>;

  // Writing
  placeOrder(req: OrderRequest): Promise<OrderResponse>;
  cancelOrder(brokerOrderId: string): Promise<{ ok: boolean; message?: string }>;
};
