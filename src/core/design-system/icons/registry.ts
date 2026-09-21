export const neonIconRegistry = {
  ai: "/icons/neon-v2/ai.svg",
  book: "/icons/neon-v2/book.svg",
  chat: "/icons/neon-v2/chat.svg",
  community: "/icons/neon-v2/community.svg",
  crown: "/icons/neon-v2/crown.svg",
  cube: "/icons/neon-v2/cube.svg",
  customization: "/icons/neon-v2/customization.svg",
  diamond: "/icons/neon-v2/diamond.svg",
  featured: "/icons/neon-v2/featured.svg",
  feedback: "/icons/neon-v2/feedback.svg",
  gamepad: "/icons/neon-v2/gamepad.svg",
  gear: "/icons/neon-v2/gear.svg",
  lightning: "/icons/neon-v2/lightning.svg",
  shield: "/icons/neon-v2/shield.svg",
  ticket: "/icons/neon-v2/ticket.svg",
  verified: "/icons/neon-v2/verified.svg",
} as const;

export const fallbackIconRegistry = {
  bolt: "/icons/bolt.svg",
  discord: "/icons/brand-discord.svg",
  google: "/icons/brand-google.svg",
  dots: "/icons/circle-dots.svg",
  card: "/icons/credit-card.svg",
  crown: "/icons/crown.svg",
  diamond: "/icons/diamond.svg",
  flame: "/icons/flame.svg",
  headset: "/icons/headset.svg",
  home: "/icons/home.svg",
  message: "/icons/message-circle.svg",
  package: "/icons/package.svg",
  send: "/icons/send.svg",
  shield: "/icons/shield-check.svg",
  bag: "/icons/shopping-bag.svg",
  cart: "/icons/shopping-cart.svg",
  star: "/icons/star.svg",
  tag: "/icons/tag.svg",
  user: "/icons/user.svg",
  users: "/icons/users.svg",
} as const;

export type NeonIconName = keyof typeof neonIconRegistry;
export type FallbackIconName = keyof typeof fallbackIconRegistry;
