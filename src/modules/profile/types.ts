export type ProfileAvatarSource = "auto" | "crazzy" | "discord";

export type ProfileBadge = {
  id: "member" | "customer" | "discord_verified" | "admin" | "moderator" | "lifetime";
  label: string;
  tone: "blue" | "green" | "gold" | "pink" | "neutral";
};

export type ProfileDiscordRole = {
  id: string;
  roleName: string;
  status: "pending" | "granted" | "failed" | "revoked";
  grantedAt: string | null;
  revokedAt: string | null;
};

export type ProfileSnapshot = {
  account: {
    id: string;
    username: string;
    displayName: string;
    email: string | null;
    profileAvatarUrl: string | null;
    discordAvatarUrl: string | null;
    avatarUrl: string | null;
    createdAt: string;
  };
  preferences: {
    displayName: string | null;
    bio: string | null;
    primaryColor: string;
    avatarSource: ProfileAvatarSource;
  };
  discord: {
    connected: boolean;
    userId: string | null;
    username: string | null;
    globalName: string | null;
    guildMember: boolean;
    guildVerifiedAt: string | null;
    lastCheckedAt: string | null;
  };
  appRoles: string[];
  discordRoles: ProfileDiscordRole[];
  badges: ProfileBadge[];
  stats: {
    entitlements: number;
    activeEntitlements: number;
    completedPayments: number;
    grantedDiscordRoles: number;
  };
};

export type ProfilePreferencesInput = {
  displayName: string | null;
  bio: string | null;
  primaryColor: string;
  avatarSource: ProfileAvatarSource;
};
