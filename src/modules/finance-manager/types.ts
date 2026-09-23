export type FinanceSummary = {
  completed_payments: number;
  gross_cents: number;
  known_gateway_fee_cents: number;
  unpriced_payments: number;
  refunds_completed_cents: number;
  refunds_pending_cents: number;
  chargebacks_lost_cents: number;
  chargebacks_unknown_count: number;
  open_dispute_exposure_cents: number;
  open_dispute_unknown_count: number;
  manual_holds_open_cents: number;
  net_before_unknown_fees_cents: number;
  net_estimated_cents: number | null;
};

export type FinanceMethodRow = {
  method: "pix" | "card" | "crypto";
  label: string;
  payments_count: number;
  gross_cents: number;
  known_fee_cents: number;
  unpriced_count: number;
  refunds_cents: number;
  chargebacks_cents: number;
  net_estimated_cents: number | null;
  fee_rule: {
    id: string;
    percent_bps: number;
    fixed_cents: number;
    source_label: string | null;
    notes: string | null;
    effective_from: string;
  } | null;
};

export type FinanceDailyRow = {
  day: string;
  gross_cents: number;
  payments_count: number;
  known_fee_cents: number;
  unpriced_count: number;
  refunds_cents: number;
};

export type FinancePaymentRow = {
  payment_id: string;
  username: string;
  payment_method: string | null;
  paid_at: string;
  gross_cents: number;
  fee_cents: number | null;
  fee_source: "manual" | "provider" | "estimated" | "unconfigured";
  provider_net_cents: number | null;
  net_after_fee_cents: number | null;
  refunds_completed_cents: number;
  dispute_status: string | null;
  open_hold_cents: number;
};

export type FinanceHoldRow = {
  id: string;
  payment_id: string | null;
  amount_cents: number;
  reason: string | null;
  provider_ref: string | null;
  status: "open" | "released" | "cancelled";
  opened_at: string;
  released_at: string | null;
};

export type FinancePayload = {
  range: {
    from: string;
    to: string;
    method: string | null;
  };
  summary: FinanceSummary;
  methods: FinanceMethodRow[];
  daily: FinanceDailyRow[];
  recent_payments: FinancePaymentRow[];
  holds: FinanceHoldRow[];
};
