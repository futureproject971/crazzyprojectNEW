export type CouponStatus = "available" | "used" | "expired" | "inactive";

export type CustomerCoupon = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  min_order_value: number;
  active: boolean;
  expires_at: string | null;
  origin: "promotion" | "reward" | "wheel" | "scratch" | "drop" | "admin" | "manual" | "other";
  created_at: string;
  status: CouponStatus;
  products: Array<{ id: string; name: string; image_url: string | null }>;
};
