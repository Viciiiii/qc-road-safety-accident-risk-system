// End-to-end: real React pages -> the real FastAPI backend -> a test PostgreSQL database + the real models.
// Run with: npm run test:e2e  (what must be running first is in tests/README.md)
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../src/i18n/LanguageContext";
import { AuthProvider } from "../src/auth/AuthContext";
import { IncidentsProvider } from "../src/incidents/IncidentsContext";
import Dashboard from "../src/pages/Dashboard";
import RiskAreas from "../src/pages/RiskAreas";
import ReportIncident from "../src/pages/ReportIncident";
import Records from "../src/pages/Records";
import Analytics from "../src/pages/Analytics";

import { API, ADMIN_EMAIL, ADMIN_PASSWORD, resetIncidents } from "./testEnv";
const ranking = async () => (await (await fetch(`${API}/api/risk-areas`)).json());
const scoreOf = async (name) => (await ranking()).corridors.find((c) => c.corridor === name);

const wrap = (ui) => render(
  <MemoryRouter><LanguageProvider><AuthProvider><IncidentsProvider>{ui}</IncidentsProvider></AuthProvider></LanguageProvider></MemoryRouter>
);
// Sign in as the admin once, then send that session cookie with every API call
// (Node's fetch has no cookie jar, unlike a browser).
let cookie = "";
let adminName = "";
const nodeFetch = globalThis.fetch;
beforeAll(async () => {
  const r = await nodeFetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }) });
  expect(r.status, "sign-in for the test admin (see tests/README.md)").toBe(200);
  cookie = r.headers.get("set-cookie").split(";")[0];
  adminName = (await r.json()).name;
});
beforeEach(() => {
  localStorage.clear();
  globalThis.fetch = (url, opts = {}) => nodeFetch(url, { ...opts, headers: { ...(opts.headers || {}), cookie } });
});
afterEach(cleanup);

describe("Dashboard", () => {
  it("shows the live ranking with its data window and method", async () => {
    wrap(<Dashboard />);
    await screen.findByText("Priority corridors for next month");
    expect(screen.getByText(/based on Jan 2025 – Dec 2025/)).toBeTruthy();
    const table = document.querySelector("table");
    expect(within(table).getByText("Commonwealth Ave.")).toBeTruthy();
    expect(within(table).getByText("7,654")).toBeTruthy();
    expect(screen.getAllByText(/1 point for damage only, 3 for an injury, 10 for a death/).length).toBeGreaterThan(0);
  });
});

describe("Risk Areas", () => {
  it("lists all 29, and the Low filter leaves the bottom 9", async () => {
    wrap(<RiskAreas />);
    await screen.findByText(/Showing 29 of 29 monitored corridors/);
    fireEvent.change(screen.getByDisplayValue("All priority levels"), { target: { value: "Low" } });
    await screen.findByText(/Showing 9 of 29/);
    fireEvent.change(screen.getByPlaceholderText("Search corridor..."), { target: { value: "panay" } });
    await screen.findByText(/Showing 1 of 29/);
  });
});

describe("Trend arrows", () => {
  beforeAll(resetIncidents);
  it("Risk Areas shows a trend for every corridor and filters to the 4 rising ones", async () => {
    wrap(<RiskAreas />);
    await screen.findByText(/Showing 29 of 29 monitored corridors/);
    const table = document.querySelector("table");
    expect(within(table).getAllByText(/^(Rising|Steady|Falling)$/)).toHaveLength(29);
    fireEvent.change(screen.getByDisplayValue("All trends"), { target: { value: "rising" } });
    await screen.findByText(/Showing 4 of 29/);
    for (const road of ["IBP Road", "Payatas Road", "Timog Ave.", "Visayas Ave."]) expect(within(table).getByText(road)).toBeTruthy();
    expect(screen.getAllByText(/at least 15 points faster than the whole city/).length).toBeGreaterThan(0);
  });
  it("Dashboard lists the corridors rising faster than the city", async () => {
    wrap(<Dashboard />);
    await screen.findByText("Rising faster than the city");
    expect(screen.getByText("IBP Road")).toBeTruthy();
    expect(screen.getByText(/\+55\.6% \(207 → 322\)/)).toBeTruthy();
  });
});

describe("Report -> confirm -> ranking -> export", () => {
  beforeAll(resetIncidents);
  it("runs the whole loop against the real backend", async () => {
    const corridor = "Gen. Luis St.";
    const before = (await scoreOf(corridor)).severity_score;

    // 1. Report: real models predict, incident is saved in PostgreSQL
    wrap(<ReportIncident />);
    await screen.findByText("Incident details");
    fireEvent.change(screen.getByDisplayValue("Commonwealth Ave."), { target: { value: corridor } });
    fireEvent.change(document.querySelector('input[type="datetime-local"]'), { target: { value: "2025-11-20T21:30" } });
    fireEvent.click(screen.getByText("Log incident & get estimate"));
    await screen.findByText(/Saved to/, {}, { timeout: 20000 });
    expect(screen.getByText(/counts\s+toward retraining and toward Gen\. Luis St\./)).toBeTruthy();
    const saved = await (await fetch(`${API}/api/incidents`)).json();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ corridor, status: "Pending review", logged_by_name: adminName });
    for (const k of ["priority", "svm_priority", "nb_priority"]) expect(["High", "Medium", "Low"]).toContain(saved[0][k]);
    expect((await scoreOf(corridor)).severity_score).toBe(before); // unconfirmed: no effect yet
    cleanup();

    // 2. Records: admin confirms the real outcome
    wrap(<Records />);
    await waitFor(() => expect(document.querySelector("table").textContent).toContain(corridor), { timeout: 10000 });
    fireEvent.change(screen.getAllByDisplayValue("Fatal")[0], { target: { value: "Fatal" } });
    fireEvent.click(screen.getAllByText("Confirm")[0]);
    await waitFor(() => expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0));
    const expected = { High: "Correct", Medium: "Underestimated", Low: "Underestimated" }[saved[0].priority];
    await waitFor(() => expect(document.querySelector("table").textContent).toContain(expected));
    expect(screen.getByText(/the estimate matched/).textContent).toMatch(/matched (0|1) of 1 confirmed/);
    const after = await scoreOf(corridor);
    expect(after.severity_score).toBe(before + 10);       // 3. ranking moved
    expect(after.confirmed_incidents).toBe(1);

    // 4. Export: CSV built from the server's list, statuses flip to Included in training
    const blobs = [];
    globalThis.URL.createObjectURL = vi.fn((b) => { blobs.push(b); return "blob:x"; });
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByText(/Export for retraining/));
    await waitFor(() => expect(blobs).toHaveLength(1));
    const csv = await blobs[0].text();
    expect(csv).toContain("Gen. Luis St.,2025,November,20,21,30");
    expect(csv.trim().endsWith(",Fatal")).toBe(true);
    await waitFor(() => expect(screen.getAllByText("Included in training").length).toBeGreaterThan(0));
    expect((await (await fetch(`${API}/api/incidents`)).json())[0].status).toBe("Included in training");
  });
});

describe("When the backend is down", () => {
  it("Dashboard says so instead of showing stale numbers", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    wrap(<Dashboard />);
    await screen.findByText(/Couldn't load data from the server \(Failed to fetch\)/);
    globalThis.fetch = realFetch;
  });
});

describe("Estimate vs outcome with known values", () => {
  beforeAll(resetIncidents);
  it("Records and Analytics count correct / under / over exactly", async () => {
    const post = (path, body) => fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    const base = { corridor: "EDSA", weather: "Fair (Day)", collision_type: "Rear End", accident_factor: "Human Error", vehicles: {}, logged_by_name: "Test" };
    // [RF, SVM, NB, confirmed outcome]
    const cases = [
      ["Low", "High", "Medium", "Fatal"],              // RF under, SVM correct, NB under
      ["Medium", "Medium", "High", "Non Fatal Injury"], // RF correct, SVM correct, NB over
      ["High", "High", "High", "Damage to Property"],   // all over
      ["Low", null, null, "Damage to Property"],        // RF correct; logged before SVM/NB were saved
      ["Medium", "Low", "Low", null],                   // still pending: not counted
    ];
    let day = 1;
    for (const [rf, svm, nb, outcome] of cases) {
      const inc = await post("/api/incidents", { ...base, incident_datetime: `2025-10-${String(day++).padStart(2, "0")}T10:00`, priority: rf, svm_priority: svm, nb_priority: nb });
      if (outcome) await post(`/api/incidents/${inc.id}/confirm`, { outcome });
    }

    wrap(<Records />);
    await screen.findByText(/the estimate matched/);
    // Random Forest: correct = cases 2 and 4, under = case 1, over = case 3
    expect(screen.getByText(/the estimate matched/).textContent).toMatch(/matched 2 of 4 confirmed incidents \(50%\) · Underestimated 1 · Overestimated 1 · too few/);
    const table = document.querySelector("table");
    expect(within(table).getAllByText("Correct")).toHaveLength(2);
    expect(within(table).getAllByText("Underestimated")).toHaveLength(1);
    expect(within(table).getAllByText("Overestimated")).toHaveLength(1);
    expect(within(table).getAllByText("—").length).toBeGreaterThanOrEqual(1); // the pending one
    cleanup();

    wrap(<Analytics />);
    await screen.findByText("Live results on logged incidents");
    await screen.findByText(/Only 4 confirmed incidents so far/);
    const live = screen.getByText("Live results on logged incidents").closest("div.bg-elevated, div[class*=border]");
    const rowOf = (name) => [...document.querySelectorAll("tr")].filter((tr) => tr.firstChild?.textContent === name).at(-1).textContent; // the live table is the last one
    expect(rowOf("Random Forest")).toMatch(/2 of 4 \(50%\)11/);          // matched, under 1, over 1
    expect(rowOf("Random Forest")).toContain("0 of 1");                    // the one fatal crash was estimated Low
    expect(rowOf("SVM")).toMatch(/2 of 3 \(67%\)01/);                     // SVM: correct 2, under 0, over 1
    expect(rowOf("SVM")).toContain("1 of 1");                              // flagged the fatal crash High
    expect(rowOf("Naive Bayes")).toMatch(/0 of 3 \(0%\)12/);              // NB: under 1, over 2
    expect(live).toBeTruthy();
  });
});

describe("Estimate pills use the SVG icons", () => {
  it("Correct has the check icon, Under/Overestimated have the x icon", async () => {
    wrap(<Records />);
    await screen.findByText(/the estimate matched/);
    const pill = (label) => within(document.querySelector("table")).getAllByText(label)[0];
    const paths = (el) => [...el.querySelectorAll("svg path")].map((p) => p.getAttribute("d"));
    expect(paths(pill("Correct"))).toEqual(["M20 6 9 17l-5-5"]);
    expect(paths(pill("Underestimated"))).toEqual(["M18 6 6 18", "m6 6 12 12"]);
    expect(paths(pill("Overestimated"))).toEqual(["M18 6 6 18", "m6 6 12 12"]);
    expect(pill("Correct").querySelector("svg").getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Model update", () => {
  it("Analytics shows before vs after and the chance baseline; Report Incident shows each cutoff", async () => {
    wrap(<Analytics />);
    await screen.findByText("Model update: before vs after");
    const rowOf = (name) => [...document.querySelectorAll("tr")].find((tr) => tr.firstChild?.textContent === name).textContent;
    expect(rowOf("Random Forest")).toContain("12.8% → 15.8%");
    expect(rowOf("Naive Bayes")).toContain("11,938 → 3,922");
    expect(screen.getByText(/about 44× better than chance/)).toBeTruthy();
    cleanup();

    const r = await fetch(`${API}/api/predict-incident`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incident_datetime: "2025-11-20T23:30", weather: "Fair (Night)", collision_type: "Hit Pedestrian",
        accident_factor: "Human Error", vehicles: { Motorcycle: 1, Truck: 1 } }) }).then((x) => x.json());
    expect(r.predictions.random_forest.high_cutoff).toBe(18.4);
    expect(r.predictions.svm.high_cutoff).toBeNull();
  });
});
