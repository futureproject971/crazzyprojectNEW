export type LibraryDeliveryType = "key" | "account" | "link" | "reward" | "manual";
export type LibraryDeliveryStatus = "available" | "expired" | "revoked" | "refunded" | "disputed";

export type LibraryDiscordRole = {
  id: string;
  entitlement_id: string | null;
  role_name: string | null;
  status: "pending" | "granted" | "failed" | "revoked";
  granted_at: string | null;
  revoked_at: string | null;
};

export type LibraryDelivery = {
  id: string;
  deliveryType: LibraryDeliveryType;
  status: LibraryDeliveryStatus;
  deliveredAt: string;
  expiresAt: string | null;
  revealCount: number;
  lastRevealedAt: string | null;
  canReveal: boolean;
  product: {
    id: string | null;
    name: string;
    imageUrl: string | null;
    status: string | null;
    statusLabel: string | null;
  };
  plan: {
    id: string | null;
    name: string | null;
    code: string | null;
  };
  entitlement: {
    id: string;
    status: string;
    tutorialAccess: boolean;
  } | null;
  tutorialAvailable: boolean;
  discordRoles: LibraryDiscordRole[];
  metadata: Record<string, unknown>;
};

export type LibraryHistoryEvent = {
  id: string;
  deliveryId: string;
  action: "reveal" | "copy";
  createdAt: string;
  productName: string;
  deliveryType: LibraryDeliveryType;
};

export type LibrarySnapshot = {
  deliveries: LibraryDelivery[];
  history: LibraryHistoryEvent[];
  stats: {
    total: number;
    available: number;
    keys: number;
    accounts: number;
    rewards: number;
  };
};

export type LibraryRevealResponse = {
  deliveryId: string;
  payload: string;
  payloadFormat: "text" | "json" | "url";
  deliveryType: LibraryDeliveryType;
};
