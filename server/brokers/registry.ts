// Broker registry — single place to look up "which connector should route
// this order" given the routing mode the user picked.

import type { BrokerConnector } from "./types";
import { paperConnector } from "./paper";
import { clearConnector } from "./clear";
import { ibkrConnector } from "./interactiveBrokers";
import { mercadoBitcoinConnector } from "./mercadoBitcoin";
import { getAppSetting, setAppSetting } from "../db";

// More connectors join here as they're implemented.
// const cedroConnector = ... (Cedro)
// const btgConnector = ... (BTG)
// const oandaConnector = ... (Forex)

export const CONNECTORS: Record<string, BrokerConnector> = {
  paper: paperConnector,
  clear: clearConnector,
  ibkr: ibkrConnector,
  mercado_bitcoin: mercadoBitcoinConnector,
};

export type RoutingMode = "off" | "paper" | "clear" | "ibkr" | "mercado_bitcoin";

export async function getRoutingMode(): Promise<RoutingMode> {
  const v = await getAppSetting("ROUTING_MODE");
  if (v === "off" || v === "paper" || v === "clear" || v === "ibkr" || v === "mercado_bitcoin") return v;
  return "off";
}

export async function setRoutingMode(mode: RoutingMode): Promise<void> {
  await setAppSetting("ROUTING_MODE", mode);
}

export async function getActiveConnector(): Promise<BrokerConnector | null> {
  const mode = await getRoutingMode();
  if (mode === "off") return null;
  return CONNECTORS[mode] ?? null;
}
