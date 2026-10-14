// Clicks through sign-in and account management in a real Chromium browser.
// Run with: npm run test:browser  (what must be running first is in tests/README.md)
// Screenshots go to tests/screenshots/.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { APP, ADMIN_EMAIL, ADMIN_PASSWORD } from "./testEnv.js";

const OUT = fileURLToPath(new URL("./screenshots/", import.meta.url));
mkdirSync(OUT, { recursive: true });
let failures = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) failures++; };
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const STAFF_EMAIL = `maria.${Date.now()}@example.com`; // new staff account every run

// --- admin ---
const adminCtx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const a = await adminCtx.newPage();
await a.goto(APP + "/records");
await a.waitForURL("**/login"); ok(true, "signed out: /records redirects to /login");
ok(!(await a.locator("text=Demo credentials").count()) && !(await a.locator("button:has-text('Admin')").count()), "no demo credentials, no staff/admin toggle");
await a.fill("input[type=email]", ADMIN_EMAIL); await a.fill("input[type=password]", "wrongpass1"); await a.click("button[type=submit]");
await a.waitForSelector("text=Incorrect email or password."); ok(true, "wrong password shows an error");
await a.click("text=Forgot password?"); ok(await a.locator("text=Ask your administrator to reset your password").isVisible(), "Forgot password explains the admin reset");
await a.fill("input[type=email]", ADMIN_EMAIL.toUpperCase()); await a.fill("input[type=password]", ADMIN_PASSWORD); await a.click("button[type=submit]");
await a.waitForSelector("text=Priority corridors for next month"); ok(true, "admin signs in (email in capitals) and the dashboard loads live data");
const ck = (await adminCtx.cookies()).find((c) => c.name === "qc_session");
ok(ck && ck.httpOnly && ck.expires === -1, "cookie is httpOnly and ends with the browser (no Remember me)");
ok(!(await a.evaluate(() => document.cookie.includes("qc_session"))), "page scripts can't read the session cookie");
await a.reload(); await a.waitForSelector("text=Priority corridors for next month"); ok(true, "reload keeps you signed in");

await a.click("text=Accounts"); await a.waitForSelector("text=Create staff account");
await a.fill("input[placeholder='Juan Dela Cruz']", "Maria Santos"); await a.fill("input[placeholder='juan@qc.gov.ph']", STAFF_EMAIL.replace("maria", "Maria"));
await a.click("button:has-text('Create staff account')");
await a.waitForSelector("text=Account created for Maria Santos.");
const temp = (await a.locator("span.font-mono.font-semibold").textContent()).trim();
ok(/^[A-Za-z2-9]{10}$/.test(temp), `temporary password shown once (${temp})`);
ok(await a.locator(`td:has-text('${STAFF_EMAIL}')`).count() === 1 && await a.locator("text=Temporary password").count() >= 1, "new row: lowercase email, 'Temporary password' status");
ok(await a.locator("text=You · change your password in Settings").count() >= 1, "admin's own row has no reset/disable buttons");
await a.screenshot({ path: OUT + "auth_accounts.png", fullPage: true });

// --- staff on a temporary password ---
const staffCtx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const s = await staffCtx.newPage();
await s.goto(APP + "/login");
await s.fill("input[type=email]", `${STAFF_EMAIL}`); await s.fill("input[type=password]", temp);
await s.check("input[type=checkbox]"); await s.click("button[type=submit]");
await s.waitForSelector("text=You're using a temporary password.");
ok(true, "staff with temporary password sees the reminder");
const sck = (await staffCtx.cookies()).find((c) => c.name === "qc_session");
const days = (sck.expires - Date.now() / 1000) / 86400; ok(days > 29.9 && days < 30.1, `Remember me: cookie lasts 30 days (${days.toFixed(2)})`);
ok(!(await s.locator("nav >> text=Accounts").count()) && !(await s.locator("a:has-text('Accounts')").count()), "staff sidebar has no Accounts");
await s.goto(APP + "/accounts"); await s.waitForURL(APP + "/"); ok(true, "staff typing /accounts is sent home");
await s.waitForSelector("text=You're using a temporary password.");
await s.screenshot({ path: OUT + "auth_banner.png" });
await s.click("text=Create password"); await s.waitForURL("**/settings#password");
ok(await s.waitForSelector("text=You're signed in with a temporary password", { timeout: 5000 }).then(() => true, () => false), "Settings explains the temporary password");
const pw = s.locator("#password input[type=password]");
await pw.nth(0).fill(temp); await pw.nth(1).fill("MariaPass7"); await pw.nth(2).fill("MariaPass8"); await s.click("button:has-text('Change password')");
await s.waitForSelector("text=The new passwords don't match."); ok(true, "mismatch caught");
await pw.nth(2).fill("MariaPass7"); await pw.nth(1).fill("weak"); await pw.nth(2).fill("weak"); await s.click("button:has-text('Change password')");
await s.waitForSelector("text=Use at least 8 characters."); ok(true, "weak password rejected with the server's rule");
await pw.nth(1).fill("MariaPass7"); await pw.nth(2).fill("MariaPass7"); await s.click("button:has-text('Change password')");
await s.waitForSelector("text=Password changed."); 
ok(!(await s.locator("text=You're using a temporary password.").count()), "reminder disappears after choosing a password");
await s.screenshot({ path: OUT + "auth_settings.png", fullPage: true });
await a.reload(); await a.waitForSelector(`td:has-text('${STAFF_EMAIL}')`);
ok(await a.locator(`tr:has-text('${STAFF_EMAIL}') >> text=Active`).count() === 1, "admin sees Maria as Active now");

// report as staff: credited to Maria
await s.goto(APP + "/report-incident"); await s.waitForSelector("select");
// --- admin disables Maria while she is signed in ---
await a.locator(`tr:has-text('${STAFF_EMAIL}') >> button:has-text('Disable')`).click();
await a.waitForSelector(`tr:has-text('${STAFF_EMAIL}') >> text=Disabled`);
await s.goto(APP + "/records"); await s.waitForURL("**/login", { timeout: 10000 }); ok(true, "disabled staff is bounced to sign-in on their next page");
await s.fill("input[type=email]", `${STAFF_EMAIL}`); await s.fill("input[type=password]", "MariaPass7"); await s.click("button[type=submit]");
await s.waitForSelector("text=This account has been disabled."); ok(true, "disabled account can't sign in");
await a.locator(`tr:has-text('${STAFF_EMAIL}') >> button:has-text('Enable')`).click();
await a.waitForSelector(`tr:has-text('${STAFF_EMAIL}') >> text=Active`);
// --- reset ---
await a.locator(`tr:has-text('${STAFF_EMAIL}') >> button:has-text('Reset password')`).click();
await a.waitForSelector("text=Password reset for Maria Santos.");
const temp2 = (await a.locator("span.font-mono.font-semibold").textContent()).trim();
await s.fill("input[type=password]", "MariaPass7"); await s.click("button[type=submit]");
await s.waitForSelector("text=Incorrect email or password."); ok(true, "after reset the old password fails");
await s.fill("input[type=password]", temp2); await s.click("button[type=submit]");
await s.waitForSelector("text=You're using a temporary password."); ok(true, "new temporary password works and the reminder is back");

// --- sign out ---
await a.goto(APP + "/settings"); await a.click("text=Sign out").catch(async () => a.click("button.text-high"));
await a.waitForURL("**/login"); await a.goto(APP + "/"); await a.waitForURL("**/login"); ok(true, "sign out, then / goes to /login");
await a.screenshot({ path: OUT + "auth_login.png" });
await b.close();

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed. Screenshots: tests/screenshots/");
