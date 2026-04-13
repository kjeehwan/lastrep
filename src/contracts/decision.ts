export type ReasonCode =
  | "FREE_WINDOW_EXHAUSTED"
  | "DAILY_LIMIT"
  | "COOLDOWN_ACTIVE";

export type NormalizedDecisionError =
  | {
      bucket: "business_gate";
      reasonCode: ReasonCode;
      retryAfterSeconds?: number;
      message?: string;
    }
  | {
      bucket: "seatbelt";
      message?: string;
    }
  | {
      bucket: "other";
      message?: string;
    };
