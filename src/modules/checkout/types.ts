export type CheckoutMethod = "pix" | "card" | "crypto";

export type CheckoutMethodConfig = {
  method: CheckoutMethod;
  label: string;
  enabled: boolean;
};

export type CheckoutConfig = {
  ready: boolean;
  methods: CheckoutMethodConfig[];
  cardGate: boolean;
};

export type CheckoutQuote = {
  subtotalCents: number;
  comboDiscountCents: number;
  couponDiscountCents: number;
  discountCents: number;
  discountSource: "none" | "combo" | "coupon";
  totalCents: number;
  couponId: string | null;
};

export type CheckoutCreateResponse = {
  success: boolean;
  payment_id: string;
  replayed?: boolean;
  charge?: {
    id: string;
    brCode: string;
    qrCodeImage: string;
    expiresAt: string | null;
  };
  paymentUrl?: string;
  charge_id?: string;
  expiresAt?: string | null;
  crypto?: {
    address: string;
    qrCode: string;
    payAmount: string;
    payCurrency: "LTC";
    network: "Litecoin";
    expiresAt: string | null;
  };
  authoritativeSubtotalCents: number;
  authoritativeDiscountCents: number;
  authoritativeTotalCents: number;
  discountSource?: "none" | "combo" | "coupon";
};
