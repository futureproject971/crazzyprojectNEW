export type SalesSummary = {
  total_sales: number;
  completed: number;
  pending: number;
  failed: number;
  gross_completed_cents: number;
  needs_attention: number;
};

export type SalesRow = {
  payment_id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  amount_cents: number;
  discount_amount: number;
  payment_method: string | null;
  payment_status: string;
  charge_reference: string | null;
  created_at: string;
  paid_at: string | null;
  expires_at: string | null;
  updated_at: string;
  ticket_total: number;
  ticket_delivered: number;
  ticket_attention: number;
  entitlement_total: number;
  entitlement_active: number;
  delivery_total: number;
  discord_status: string;
  tutorial_unlock_count: number;
  fulfillment_status: string;
};

export type SalesManagerPayload = {
  summary: SalesSummary;
  sales: SalesRow[];
  limit: number;
  offset: number;
};

export type SaleDetail = {
  payment: {
    id: string;
    user_id: string;
    username: string;
    avatar_url: string | null;
    amount_cents: number;
    discount_amount: number;
    payment_method: string | null;
    status: string;
    charge_reference: string | null;
    created_at: string;
    paid_at: string | null;
    expires_at: string | null;
    updated_at: string;
  };
  cart: Array<{
    product_id: string | null;
    product_name: string | null;
    product_image: string | null;
    plan_id: string | null;
    plan_name: string | null;
    plan_code: string | null;
    quantity: number;
    unit_price: number;
    type: string;
  }>;
  tickets: Array<{
    id: string;
    product_id: string;
    product_name: string;
    product_plan_id: string;
    plan_name: string;
    delivery_mode: string;
    status: string;
    status_label: string;
    has_stock_item: boolean;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
  }>;
  entitlements: Array<{
    id: string;
    product_id: string;
    product_name: string;
    product_plan_id: string | null;
    plan_name: string | null;
    status: string;
    starts_at: string;
    expires_at: string | null;
    tutorial_access: boolean;
    created_at: string;
  }>;
  deliveries: Array<{
    id: string;
    delivery_type: string;
    status: string;
    product_id: string | null;
    product_plan_id: string | null;
    entitlement_id: string | null;
    source_order_ticket_id: string | null;
    delivered_at: string;
    expires_at: string | null;
    reveal_count: number;
    last_revealed_at: string | null;
  }>;
  discord_roles: Array<{
    id: string;
    entitlement_id: string | null;
    role_name: string | null;
    status: string;
    granted_at: string | null;
    revoked_at: string | null;
    last_error_code: string | null;
    updated_at: string;
  }>;
  tutorials: Array<{
    id: string;
    title: string;
    slug: string;
    active: boolean;
  }>;
};
