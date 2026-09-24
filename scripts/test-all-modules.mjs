import { spawn } from "node:child_process";

const tests = [
  "scripts/test-lzt-preview.mjs",
  "scripts/test-m08-checkout.mjs",
  "scripts/test-m09-auth.mjs",
  "scripts/test-m10-client-hub.mjs",
  "scripts/test-m11-library.mjs",
  "scripts/test-m12-profile.mjs",
  "scripts/test-m13-support.mjs",
  "scripts/test-m13-support-realtime.mjs",
  "scripts/test-m14-community.mjs",
  "scripts/test-m17-rewards.mjs",
  "scripts/test-m18-luck.mjs",
  "scripts/test-bonus-arcade.mjs",
  "scripts/test-m19-coupons.mjs",
  "scripts/test-m20-rank.mjs",
  "scripts/test-m21-status.mjs",
  "scripts/test-m22-academy.mjs",
  "scripts/test-m23-help.mjs",
  "scripts/test-m23-1-mtsounds.mjs",
  "scripts/test-m24-control-center.mjs",
  "scripts/test-m25-product-manager.mjs",
  "scripts/test-m26-category-manager.mjs",
  "scripts/test-m27-stock-manager.mjs",
  "scripts/test-m25-m27-product-stock-ux.mjs",
  "scripts/test-m28-sales-manager.mjs",
  "scripts/test-m29-payments-manager.mjs",
  "scripts/test-m30-finance.mjs",
  "scripts/test-crazzy-call.mjs",
  "scripts/test-discord-call-auth.mjs",
  "scripts/test-discord-integration.mjs",
  "scripts/test-m46-mtsounds.mjs",
  "scripts/test-live-storefront.mjs",
  "scripts/test-release-modules.mjs",
];

function run(file) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [file], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("exit", (code, signal) => {
      resolve({
        file,
        ok: code === 0,
        code,
        signal,
        durationMs: Date.now() - startedAt,
      });
    });

    child.on("error", () => {
      resolve({
        file,
        ok: false,
        code: null,
        signal: null,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

const results = [];
for (const file of tests) {
  console.log("\n============================================================");
  console.log("[MODULE SMOKE] " + file);
  console.log("============================================================");
  results.push(await run(file));
}

const failed = results.filter((item) => !item.ok);

console.log("\n================ MODULE REGRESSION SUMMARY ================");
for (const item of results) {
  console.log(
    (item.ok ? "[PASS] " : "[FAIL] ") +
      item.file +
      " • " +
      Math.round(item.durationMs / 100) / 10 +
      "s"
  );
}

if (failed.length) {
  console.error("\nFailed module smokes: " + failed.map((item) => item.file).join(", "));
  process.exit(1);
}

console.log("\n[PASS] CRAZZY PROJECT full module regression suite");
