export type HubPayment = {
  id: string;
  amountCents: number;
  status: string;
  method: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type HubOrder = {
  id: string;
  status: string;
  statusLabel: string;
  productName: string;
  planName: string;
  createdAt: string;
  updatedAt: string;
  paymentId: string | null;
};

export type HubEntitlement = {
  id: string;
  status: "active" | "expired" | "revoked" | "refunded" | "disputed";
  productName: string;
  productImage: string | null;
  productStatus: string;
  productStatusLabel: string;
  planName: string | null;
  planCode: string | null;
  startsAt: string;
  expiresAt: string | null;
  tutorialAccess: boolean;
  hasTutorial: boolean;
};

export type HubTutorial = {
  entitlementId: string;
  productName: string;
  productImage: string | null;
  entitlementStatus: string;
  expiresAt: string | null;
};

export type HubRoleGrant = {
  id: string;
  roleName: string;
  status: "pending" | "granted" | "failed" | "revoked";
  grantedAt: string | null;
  revokedAt: string | null;
};

export type HubRewardDelivery = {
  id: string;
  mode: string;
  deliveredAt: string;
  expiresAt: string | null;
};

export type ClientHubSnapshot = {
  profile: {
    username: string;
    avatarUrl: string | null;
    role: string;
    roles: string[];
  };
  discord: {
    connected: boolean;
    username: string | null;
    avatarUrl: string | null;
    guildConfigured: boolean;
    guildMember: boolean;
    lastCheckedAt: string | null;
  };
  stats: {
    payments: number;
    completedPayments: number;
    orders: number;
    activeProducts: number;
    tutorials: number;
    roleGrants: number;
  };
  payments: HubPayment[];
  orders: HubOrder[];
  entitlements: HubEntitlement[];
  tutorials: HubTutorial[];
  roleGrants: HubRoleGrant[];
  rewardDeliveries: HubRewardDelivery[];
};
