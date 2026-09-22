export type PaymentMethodSetting = {
  method: "pix" | "card" | "crypto";
  label: string;
  enabled: boolean;
  updated_at: string;
};

export type PaymentManagerSummary = {
  total: number;
  completed: number;
  active: number;
  failed: number;
  gross_completed_cents: number;
  needs_reconcile: number;
  open_disputes: number;
  refund_cases: number;
};

export type PaymentManagerRow = {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  amount_cents: number;
  discount_amount: number;
  status: string;
  payment_method: string | null;
  charge_reference: string | null;
  idempotency_reference: string | null;
  created_at: string;
  paid_at: string | null;
  expires_at: string | null;
  updated_at: string;
  event_count: number;
  last_event: {
    event_type: string;
    severity: string;
    created_at: string;
  } | null;
  reconcile_status: string | null;
  refund_count: number;
  dispute_count: number;
  attention: boolean;
};

export type PaymentsManagerPayload = {
  summary: PaymentManagerSummary;
  methods: PaymentMethodSetting[];
  payments: PaymentManagerRow[];
  limit: number;
  offset: number;
};

export type PaymentManagerDetail = {
  payment: {
    id: string;
    user_id: string;
    username: string;
    avatar_url: string | null;
    amount_cents: number;
    discount_amount: number;
    status: string;
    payment_method: string | null;
    charge_reference: string | null;
    idempotency_reference: string | null;
    created_at: string;
    paid_at: string | null;
    expires_at: string | null;
    updated_at: string;
  };
  cart: Array<{
    product_id: string | null;
    product_name: string | null;
    plan_id: string | null;
    plan_name: string | null;
    plan_code: string | null;
    quantity: number;
    price: number;
    type: string;
  }>;
  events: Array<{
    id: string;
    source: string;
    event_type: string;
    severity: string;
    status_before: string | null;
    status_after: string | null;
    provider_status: string | null;
    amount_cents: number | null;
    http_status: number | null;
    detail: Record<string, unknown>;
    created_at: string;
  }>;
  reconciliations: Array<{
    id: string;
    reason: string | null;
    status: string;
    provider_status: string | null;
    status_before: string | null;
    status_after: string | null;
    last_error_code: string | null;
    requested_at: string;
    started_at: string | null;
    finished_at: string | null;
  }>;
  refunds: Array<{
    id: string;
    amount_cents: number;
    reason: string | null;
    status: string;
    provider_ref: string | null;
    provider_status: string | null;
    last_error_code: string | null;
    requested_at: string;
    completed_at: string | null;
  }>;
  disputes: Array<{
    id: string;
    provider_ref: string | null;
    status: string;
    reason: string | null;
    amount_cents: number | null;
    opened_at: string;
    due_at: string | null;
    resolved_at: string | null;
    evidence_count: number;
  }>;
};
