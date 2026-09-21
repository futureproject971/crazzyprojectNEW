export type CommunityRank = {
  points: number;
  code: string;
  label: string;
  color: string;
  tone: "blue" | "green" | "gold" | "pink" | "neutral";
};

export type CommunityBadge = {
  id: string;
  label: string;
  tone: "blue" | "green" | "gold" | "pink" | "neutral";
};

export type CommunityPrimaryRole = {
  label: string;
  color: string;
  kind: "admin" | "moderator" | "discord" | "member";
};

export type CommunityAuthor = {
  key: string;
  name: string;
  avatarUrl: string | null;
  primaryRole: CommunityPrimaryRole;
  badges: CommunityBadge[];
  rank: CommunityRank | null;
  discordRoles: string[];
};

export type CommunityReaction = {
  emoji: string;
  count: number;
  reacted: boolean;
};

export type CommunityAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
  expiresIn: number;
};

export type CommunityReplyPreview = {
  id: string;
  deleted: boolean;
  body: string | null;
  authorName: string;
};

export type CommunityMessage = {
  id: string;
  body: string | null;
  deleted: boolean;
  editedAt: string | null;
  createdAt: string;
  author: CommunityAuthor;
  reply: CommunityReplyPreview | null;
  reactions: CommunityReaction[];
  attachments: CommunityAttachment[];
  mine: boolean;
  canDelete: boolean;
};

export type CommunityChannel = {
  slug: string;
  name: string;
  description: string | null;
};

export type CommunitySnapshot = {
  channel: CommunityChannel;
  channels: CommunityChannel[];
  messages: CommunityMessage[];
  viewer: {
    key: string;
    staff: boolean;
  };
  activity: {
    recentUsers: number;
  };
  emoji: string[];
};

export type CommunityProfile = {
  key: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  primaryRole: CommunityPrimaryRole;
  appRoles: string[];
  discordRoles: string[];
  badges: CommunityBadge[];
  rank: CommunityRank | null;
  discord: {
    connected: boolean;
    guildMember: boolean;
  };
  stats: {
    entitlements: number;
    activeEntitlements: number;
  };
};
