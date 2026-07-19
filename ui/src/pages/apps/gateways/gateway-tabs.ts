import { Activity, LayoutGrid, KeyRound, Wrench, Boxes } from "lucide-react";

/**
 * Gateway detail tabs (PAP-11200). Terminology is locked by the approved
 * PAP-11178 design of record: Overview · Apps & tools · Tokens · Activity ·
 * Advanced. Raw protocol / JSON / transport details live under Advanced.
 */
export const GATEWAY_TABS = [
  { key: "overview", labelKey: "ui.toolsGateways.tabs.overview", icon: LayoutGrid },
  { key: "apps", labelKey: "ui.toolsGateways.tabs.apps", icon: Boxes },
  { key: "tokens", labelKey: "ui.toolsGateways.tabs.tokens", icon: KeyRound },
  { key: "activity", labelKey: "ui.toolsGateways.tabs.activity", icon: Activity },
  { key: "advanced", labelKey: "ui.toolsGateways.tabs.advanced", icon: Wrench },
] as const;

export type GatewayTabKey = (typeof GATEWAY_TABS)[number]["key"];

export function gatewayTabHref(gatewayId: string, tab: GatewayTabKey): string {
  return `/apps/gateways/${gatewayId}/${tab}`;
}

export function isGatewayTabKey(value: string | undefined): value is GatewayTabKey {
  return GATEWAY_TABS.some((tab) => tab.key === value);
}

export function gatewayTabLabel(tabKey: GatewayTabKey): string {
  return GATEWAY_TABS.find((tab) => tab.key === tabKey)?.labelKey ?? "ui.toolsGateways.tabs.overview";
}
