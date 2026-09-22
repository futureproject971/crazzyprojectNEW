export type StockPlanSummary = {
  product_id: string;
  product_name: string;
  product_active: boolean;
  game_name: string;
  plan_id: string;
  plan_name: string;
  plan_code: string | null;
  plan_active: boolean;
  price: number;
  show_when_out_of_stock: boolean;
  delivery_mode: string;
  supplier_provider: string | null;
  local_stock: number;
  available_stock: number;
  reserved_stock: number;
  used_stock: number;
  disabled_stock: number;
};

export type StockBatchSummary = {
  id: string;
  product_plan_id: string;
  source: string;
  note: string | null;
  submitted_count: number;
  accepted_count: number;
  duplicate_count: number;
  created_at: string;
};

export type StockEventSummary = {
  id: string;
  stock_item_id: string | null;
  batch_id: string | null;
  reservation_id: string | null;
  product_plan_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type StockManagerCatalog = {
  plans: StockPlanSummary[];
  recent_batches: StockBatchSummary[];
  recent_events: StockEventSummary[];
};

export type StockManagerItem = {
  id: string;
  masked_content: string;
  used: boolean;
  used_at: string | null;
  disabled: boolean;
  disabled_at: string | null;
  disabled_reason: string | null;
  source: string;
  batch_id: string | null;
  created_at: string;
  reservation: {
    id: string;
    status: string;
    expires_at: string;
    created_at: string;
  } | null;
};

export type StockItemsResponse = {
  total: number;
  items: StockManagerItem[];
};
