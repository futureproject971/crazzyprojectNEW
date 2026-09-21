export type AppRole = "admin" | "moderator" | "user";

export type AuthMe = {
  id: string;
  email: string | null;
  username: string;
  avatarUrl: string | null;
  role: AppRole;
  roles: AppRole[];
  banned: boolean;
  discord: {
    connected: boolean;
    userId: string | null;
    username: string | null;
    globalName: string | null;
    avatarUrl: string | null;
    guildId: string | null;
    guildMember: boolean;
    guildVerifiedAt: string | null;
    lastCheckedAt: string | null;
  };
};
