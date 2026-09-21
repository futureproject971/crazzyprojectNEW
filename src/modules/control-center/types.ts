export type ControlSummary = {
  payment_divergence: number;
  fulfillment_failures: number;
  discord_failures: number;
  low_stock: number;
  missing_tutorials: number;
  active_incidents: number;
  manual_open_alerts: number;
  stale_active_payments: number;
};

export type PaymentDivergence = {
  id: string;
  charge_id: string | null;
  amount: number;
  payment_method: string | null;
  created_at: string;
  paid_at: string | null;
};

export type FulfillmentFailure = {
  id: string;
  payment_id: string | null;
  product_id: string;
  product_plan_id: string;
  status: string;
  status_label: string;
  created_at: string;
  updated_at: string;
};

export type DiscordFailure = {
  id: string;
  user_id: string;
  entitlement_id: string | null;
  role_name: string | null;
  status: string;
  last_error_code: string | null;
  updated_at: string;
};

export type LowStockItem = {
  plan_id: string;
  product_id: string;
  product_name: string;
  plan_name: string;
  known_stock: number;
  available_stock: number;
};

export type MissingTutorial = {
  product_id: string;
  product_name: string;
};

export type ActiveIncident = {
  id: string;
  title: string;
  state: string;
  impact: string;
  message: string;
  started_at: string;
};

export type ManualControlAlert = {
  id: string;
  category: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  state: "open" | "acknowledged" | "resolved";
  reference_type: string | null;
  reference_id: string | null;
  context: Record<string, unknown>;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ControlCenterSnapshot = {
  generated_at: string;
  summary: ControlSummary;
  payment_divergence: PaymentDivergence[];
  fulfillment_failures: FulfillmentFailure[];
  discord_failures: DiscordFailure[];
  low_stock: LowStockItem[];
  missing_tutorials: MissingTutorial[];
  active_incidents: ActiveIncident[];
  manual_alerts: ManualControlAlert[];
};
