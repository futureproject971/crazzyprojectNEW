export type SupportCategory =
  | "product"
  | "payment"
  | "delivery"
  | "technical"
  | "account"
  | "other";

export type SupportStatus =
  | "open"
  | "waiting_staff"
  | "waiting_user"
  | "resolved"
  | "closed";

export type SupportPriority = "low" | "normal" | "high" | "urgent";

export type SupportContext = {
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    status: string;
    statusLabel: string;
  } | null;
  plan: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  entitlement: {
    id: string;
    status: string;
    startsAt: string;
    expiresAt: string | null;
  } | null;
  order: {
    id: string;
    status: string;
    statusLabel: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  library: {
    id: string;
    deliveryType: string;
    status: string;
    deliveredAt: string;
    expiresAt: string | null;
  } | null;
  tutorialAvailable: boolean;
};

export type SupportTicketSummary = {
  id: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  priority: SupportPriority;
  lastMessageAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string | null;
  attachmentCount: number;
  context: SupportContext;
};

export type SupportSnapshot = {
  tickets: SupportTicketSummary[];
  stats: {
    total: number;
    open: number;
    waitingStaff: number;
    waitingUser: number;
    closed: number;
  };
};

export type SupportMessage = {
  id: string;
  senderRole: "user" | "staff" | "system";
  message: string;
  editedAt: string | null;
  createdAt: string;
  sender: {
    id: string | null;
    name: string;
    avatarUrl: string | null;
  };
};

export type SupportAttachment = {
  id: string;
  messageId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
  expiresIn: number;
};

export type SupportEvent = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
};

export type SupportThread = {
  ticket: {
    id: string;
    category: SupportCategory;
    subject: string;
    status: SupportStatus;
    priority: SupportPriority;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
    context: SupportContext;
  };
  messages: SupportMessage[];
  attachments: SupportAttachment[];
  events: SupportEvent[];
  canReply: boolean;
  canReopen: boolean;
};
