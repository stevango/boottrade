// Broker registry — single place to look up "which connector should route
// this order" given the routing mode the user picked.

import type { BrokerConnector } from "./types";
import { paperConnector } from "./paper";
import { clearConnector } from "./clear";
import { getAppSetting, setAppSetting } from "../db";

// More connectors land here as they're implemented.
// const ibConnector  = ... (Interactive Brokers)
// const cedroConnector = ... (Cedro)
// const btgConnector = ... (BTG)

export const CONNECTORS: Record<string, BrokerConnector> = {
  paper: paperConnector,
  clear: clearConnector,
};

export type RoutingMode = "paper" | "clear" | "off";

export async function getRoutingMode(): Promise<RoutingMode> {
  const v = await getAppSetting("ROUTING_MODE");
  if (v === "paper" || v === "clear" || v === "off") return v;
  return "off"; // safe default — orders go nowhere unless explicitly enabled
}

export async function setRoutingMode(mode: RoutingMode): Promise<void> {
  await setAppSetting("ROUTING_MODE", mode);
}

export async function getActiveConnector(): Promise<BrokerConnector | null> {
  const mode = await getRoutingMode();
  if (mode === "off") return null;
  return CONNECTORS[mode] ?? null;
}
