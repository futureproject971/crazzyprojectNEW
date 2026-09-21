const project = "https://nnmglkdpmffmaiuwbcct.supabase.co";
const rest = project + "/rest/v1";
const key = "sb_publishable_Gu8G1uqggVf2pvVenX7EPQ_yIi5t2Kb";

async function req(path, init = {}) {
  return fetch(rest + path, {
    ...init,
    headers: {
      apikey: key,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
}

for (const [name,path,body] of [
  ["is_current_admin","/rpc/is_current_admin",{}],
  ["get_control_center","/rpc/get_control_center",{}],
  ["set_control_center_alert_state","/rpc/set_control_center_alert_state",{
    p_alert_id:"00000000-0000-4000-8000-000000000000",
    p_state:"resolved"
  }],
]) {
  const response = await req(path,{
    method:"POST",
    body:JSON.stringify(body),
  });
  if (response.ok) {
    throw new Error(name + " must not be executable by anonymous users");
  }
  console.log("[PASS] " + name + " blocks anonymous access (" + response.status + ")");
}

const direct = await req("/control_center_alerts?select=*&limit=1");
if (direct.ok) {
  const rows = await direct.json();
  if (!Array.isArray(rows) || rows.length !== 0) {
    throw new Error("Anonymous users must not read Control Center alerts");
  }
}
console.log("[PASS] Control Center alert table exposes no anonymous rows");

console.log("[PASS] M24 CRAZZY CONTROL CENTER security smoke");
