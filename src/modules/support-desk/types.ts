import type { SupportThread } from "@/modules/support";

export type SupportDeskTicket = {
  id: string;
  userId: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  lastMessageAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string | null;
  lastSenderRole: string | null;
  attachmentCount: number;
  customer: {
    username: string | null;
    avatarUrl: string | null;
    banned: boolean;
    discordUserId: string | null;
    discordUsername: string | null;
    guildMember: boolean;
  };
};

export type SupportDeskPayload = {
  tickets: SupportDeskTicket[];
  stats: {
    total: number;
    waitingStaff: number;
    waitingUser: number;
    urgent: number;
    unassigned: number;
  };
  staffUserId: string;
};

export type SupportDeskThread = SupportThread;
