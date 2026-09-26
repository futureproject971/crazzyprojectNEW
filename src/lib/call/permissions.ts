export function canPublishInCall(mode: "call" | "live", role: "host" | "cohost" | "participant" | "viewer") {
  return mode === "live" ? role === "host" || role === "cohost" : role !== "viewer";
}
