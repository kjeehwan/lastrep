export type PurchaseResult =
  | { status: "PURCHASED" }
  | { status: "CANCELLED" }
  | { status: "ERROR"; errorCode?: string };

export type RestoreResult =
  | { status: "RESTORED" }
  | { status: "ERROR"; errorCode?: string };
