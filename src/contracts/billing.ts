import type { CustomerInfo } from "react-native-purchases";

export type PurchaseResult =
  | { status: "PURCHASED" }
  | { status: "CANCELLED" }
  | { status: "ERROR"; errorCode?: string };

export type RestoreResult =
  | { status: "RESTORED"; customerInfo: CustomerInfo }
  | { status: "ERROR"; errorCode?: string };
