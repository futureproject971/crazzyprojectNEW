import type { KeyboardEvent } from "react";

export function sendOnEnter(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, send: () => void | Promise<void>) {
  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
  event.preventDefault();
  if (!event.repeat) void send();
}
