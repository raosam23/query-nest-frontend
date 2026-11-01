/**
 * Capture README screenshots of the real QueryNest UI.
 *
 * The production app is unchanged. Browser calls to the REST API and the
 * research WebSocket are intercepted and answered with a fusion-research
 * fixture. Shapes match query-nest-backend main:
 *
 *   POST   /auth/register            { message, email }
 *   POST   /auth/login               { access_token, token_type }
 *   GET    /history                   ResearchResponse[]
 *   DELETE /history/{session_id}     { status, msg }
 *   POST   /research                  ResearchResponse (status pending; the
 *                                  background run is what flips it to running)
 *   GET    /research/{session_id}     ResearchResponse
 *   GET    /research/{session_id}/sources   SourceResponse[]
 *   WS     /research/{session_id}/stream?token=
 *          { agent, status } then { agent, status, output }
 *          agents: search_agent, summarizer_agent, fact_checker_agent, writer_agent
 *          then { type: "pipeline_completed", status: "done" } and the socket closes
 *          A connection without ?token= is closed with code 1008.
 *
 * Re-run from the repo root (Google Chrome required, port 3000 free):
 *   npm run screenshots
 *
 * The script rebuilds the production app, serves it on port 3000, writes PNGs
 * to docs/screenshots/, and stops the server. No Postgres, OpenAI key, or
 * running backend is required. The build sets NEXT_PUBLIC_API_URL to
 * http://localhost:8000 so REST and the derived WebSocket stay on that origin.
 */
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "docs", "screenshots");
const API_ORIGIN = "http://localhost:8000";
const PORT = 3000;
const BASE = `http://127.0.0.1:${PORT}`;

const EMAIL = "maya.chen@example.com";
const PASSWORD = "correct-horse";

const FUSION_ID = "11111111-1111-4111-8111-111111111111";
const MRNA_ID = "22222222-2222-4222-8222-222222222222";
const CITIES_ID = "33333333-3333-4333-8333-333333333333";
const BATTERY_ID = "44444444-4444-4444-8444-444444444444";
const LK99_ID = "55555555-5555-4555-8555-555555555555";

const FUSION_QUERY = "What is the current state of commercial nuclear fusion?";

const FUSION_REPORT = `**Summary.** NIF and two private tokamaks have logged repeatable shots with Q greater than 1.

**Fact check.** No blanket has bred enough tritium to close the fuel cycle, so the mid-2030s pilot date is uncertain. Breakeven is verified. Commercial fusion still waits on a blanket that breeds its own tritium.`;

const FUSION_SOURCES = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    url: "https://www.iaea.org/publications/fusion-outlook-2026",
    title: "IAEA World Fusion Outlook 2026",
    snippet: "Repeatable shots above breakeven. A closed tritium cycle is still unproven.",
    credibility_score: 0.96,
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    url: "https://www.nature.com/articles/fusion-gain-2026",
    title: "Repeatable gain at the National Ignition Facility",
    snippet: "A second campaign reproduced Q greater than 1. No claim of continuous operation.",
    credibility_score: 0.93,
  },
];

function session(id, query, status, created_at, final_report = null) {
  return { id, query, status, final_report, created_at };
}

const sessions = [
  session(
    MRNA_ID,
    "How do mRNA cancer vaccines compare with checkpoint inhibitors?",
    "done",
    "2026-10-28T15:00:00.000Z",
    "Sample report held on the session. The fusion brief is the one opened in the screenshots.",
  ),
  session(
    CITIES_ID,
    "Which cities copied London's congestion charge?",
    "running",
    "2026-10-21T15:00:00.000Z",
  ),
  session(
    BATTERY_ID,
    "What limits solid-state EV batteries in mass production?",
    "done",
    "2026-10-09T15:00:00.000Z",
    "Manufacturing yield, not cathode chemistry, is the constraint cited most often.",
  ),
  session(
    LK99_ID,
    "Have independent labs reproduced the LK-99 result?",
    "failed",
    "2026-09-30T15:00:00.000Z",
  ),
];

const AGENT_SCRIPT = [
  { agent: "search_agent", status: "running" },
  { agent: "search_agent", status: "done", output: "Found 5 results" },
  { agent: "summarizer_agent", status: "running" },
  {
    agent: "summarizer_agent",
    status: "done",
    output: "Extracted key claims succesfully",
  },
  { agent: "fact_checker_agent", status: "running" },
  {
    agent: "fact_checker_agent",
    status: "done",
    output: "Fact check complete: 1 claims evaluated",
  },
  { agent: "writer_agent", status: "running" },
];

const AGENT_FINISH = [
  {
    agent: "writer_agent",
    status: "done",
    output: "Report generated successfully. Length: 612 characters",
  },
  { type: "pipeline_completed", status: "done" },
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

function json(route, status, body) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: CORS,
    body: JSON.stringify(body),
  });
}

function researchPayload(item) {
  return {
    id: item.id,
    query: item.query,
    status: item.status,
    final_report: item.final_report,
    created_at: item.created_at,
  };
}

let fusionCompleted = false;
let pageSocket = null;
let progressDelivered = false;

async function mockApi(route) {
  const request = route.request();
  const method = request.method();
  const pathName = new URL(request.url()).pathname.replace(/\/+$/, "") || "/";

  if (method === "OPTIONS") {
    return route.fulfill({ status: 204, headers: CORS, body: "" });
  }

  const log = (status) => console.log(`  mock ${method} ${pathName} -> ${status}`);

  if (method === "POST" && pathName === "/auth/register") {
    const body = request.postDataJSON();
    log(200);
    return json(route, 200, {
      message: "Account created successfully",
      email: body.email,
    });
  }

  if (method === "POST" && pathName === "/auth/login") {
    log(200);
    return json(route, 200, {
      access_token: "mock-access-token",
      token_type: "bearer",
    });
  }

  if (method === "GET" && pathName === "/history") {
    log(200);
    const ordered = [...sessions].sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1,
    );
    return json(route, 200, ordered.map(researchPayload));
  }

  if (method === "POST" && pathName === "/research") {
    const body = request.postDataJSON();
    const created = session(
      body.query === FUSION_QUERY ? FUSION_ID : crypto.randomUUID(),
      body.query,
      "running",
      "2026-11-01T15:00:00.000Z",
    );
    sessions.unshift(created);
    log(200);
    // The real handler returns the row before the background task marks it running.
    return json(route, 200, { ...researchPayload(created), status: "pending" });
  }

  const sourcesMatch = pathName.match(/^\/research\/([^/]+)\/sources$/);
  if (sourcesMatch && method === "GET") {
    const id = sourcesMatch[1];
    const found = sessions.find((item) => item.id === id);
    if (!found) {
      log(404);
      return json(route, 404, { detail: "Session not found" });
    }
    log(200);
    return json(route, 200, id === FUSION_ID ? FUSION_SOURCES : []);
  }

  const researchMatch = pathName.match(/^\/research\/([^/]+)$/);
  if (researchMatch && method === "GET") {
    const found = sessions.find((item) => item.id === researchMatch[1]);
    if (!found) {
      log(404);
      return json(route, 404, { detail: "Session not found" });
    }
    if (found.id === FUSION_ID && fusionCompleted) {
      found.status = "done";
      found.final_report = FUSION_REPORT;
    }
    log(200);
    return json(route, 200, researchPayload(found));
  }

  const deleteMatch = pathName.match(/^\/history\/([^/]+)$/);
  if (deleteMatch && method === "DELETE") {
    const index = sessions.findIndex((item) => item.id === deleteMatch[1]);
    if (index < 0) {
      log(404);
      return json(route, 404, { detail: "Session not found" });
    }
    sessions.splice(index, 1);
    log(200);
    return json(route, 200, { status: 200, msg: "Session deleted successfully" });
  }

  log(404);
  return json(route, 404, { detail: `No mock for ${method} ${pathName}` });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendSteps(ws, steps) {
  for (const step of steps) {
    ws.send(JSON.stringify(step));
    await delay(40);
  }
}

function watchResearchSocket(context) {
  let resolveProgress = () => {};
  const progressDone = new Promise((resolve) => {
    resolveProgress = resolve;
  });
  const ready = context.routeWebSocket(/\/research\/[^/]+\/stream(?:\?.*)?$/, (ws) => {
    const url = new URL(ws.url());
    const token = url.searchParams.get("token");
    if (!token) {
      console.error(`  ws rejected, missing token ${url.pathname}`);
      ws.close({ code: 1008, reason: "Invalid token or session access denied" });
      return;
    }
    const id = url.pathname.split("/")[2];
    console.log(`  ws open ${id}`);
    if (id === FUSION_ID && !progressDelivered) {
      pageSocket = ws;
      progressDelivered = true;
      sendSteps(ws, AGENT_SCRIPT).then(() => {
        console.log("  ws progress delivered");
        resolveProgress();
      });
      return;
    }
    sendSteps(ws, [...AGENT_SCRIPT, ...AGENT_FINISH]).then(() => {
      console.log("  ws full script delivered");
      ws.close();
    });
  });

  return {
    ready,
    progressDone,
    finishPage() {
      if (!pageSocket) throw new Error("Research WebSocket was not connected");
      fusionCompleted = true;
      pageSocket.send(JSON.stringify(AGENT_FINISH[0]));
      pageSocket.send(JSON.stringify(AGENT_FINISH[1]));
      pageSocket.close();
      console.log("  ws closed after pipeline_completed");
    },
  };
}

function portInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => server.close(() => resolve(false)));
    server.listen(port, "127.0.0.1");
  });
}

const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

function run(args, extraEnv = {}) {
  return spawn(process.execPath, [NEXT_BIN, ...args], {
    cwd: ROOT,
    detached: true,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_API_URL: API_ORIGIN,
      ...extraEnv,
    },
  });
}

function stop(child) {
  if (!child || child.killed || child.pid == null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function waitForServer(child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`next start exited early (${child.exitCode})`);
    }
    try {
      const response = await fetch(BASE, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Server still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not start on ${BASE}`);
}

async function settle(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.waitForTimeout(200);
}

async function shoot(page, name, expectedWidth, expectedHeight) {
  await settle(page);
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file, animations: "disabled", caret: "hide" });
  const bytes = await readFile(file);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  console.log(`  saved ${path.relative(ROOT, file)} (${width}x${height})`);
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(
      `${name} is ${width}x${height}, expected ${expectedWidth}x${expectedHeight}`,
    );
  }
}

async function assertFullyVisible(page, locator, label) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error(`${label} has no box`);
  const bottom = box.y + box.height;
  if (box.y < -1 || bottom > viewport.height + 1) {
    throw new Error(
      `${label} is clipped (y=${Math.round(box.y)} bottom=${Math.round(bottom)} viewport=${viewport.height})`,
    );
  }
}

function attachLogs(page) {
  page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") console.error(`  console: ${message.text()}`);
  });
}

async function dismissWelcome(page) {
  const toast = page.getByText("Welcome Back!");
  try {
    await toast.waitFor({ timeout: 4000 });
    await toast.waitFor({ state: "hidden", timeout: 8000 });
  } catch {
    // The toast can already be gone, or the redirect can beat it.
  }
}

async function exerciseApi(page) {
  const report = await page.evaluate(
    async ({ api, fusionId, lk99Id }) => {
      const calls = [];
      async function hit(method, path, options = {}) {
        const response = await fetch(`${api}${path}`, {
          method,
          ...options,
        });
        const contentType = response.headers.get("content-type") || "";
        const body = contentType.includes("application/json")
          ? await response.json()
          : await response.text();
        calls.push({ method, path, status: response.status, body });
        return body;
      }

      await hit("POST", "/auth/register", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "maya.chen@example.com", password: "correct-horse" }),
      });
      await hit("POST", "/auth/login", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "maya.chen@example.com", password: "correct-horse" }),
      });
      await hit("GET", "/history");
      await hit("POST", "/research", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "Where do solid-state cells lose yield?" }),
      });
      const created = calls.at(-1).body;
      await hit("GET", `/research/${fusionId}`);
      await hit("GET", `/research/${fusionId}/sources`);
      await hit("DELETE", `/history/${lk99Id}`);

      const wsMessages = await new Promise((resolve, reject) => {
        const messages = [];
        const ws = new WebSocket(
          `ws://localhost:8000/research/${fusionId}/stream?token=${encodeURIComponent("mock-access-token")}`,
        );
        const timer = setTimeout(() => reject(new Error("WebSocket timed out")), 8000);
        ws.onmessage = (event) => messages.push(JSON.parse(event.data));
        ws.onerror = () => {
          clearTimeout(timer);
          reject(new Error("WebSocket error"));
        };
        ws.onclose = () => {
          clearTimeout(timer);
          resolve(messages);
        };
      });

      return {
        calls: calls.map((call) => ({
          method: call.method,
          path: call.path,
          status: call.status,
          isArray: Array.isArray(call.body),
          keys:
            call.body && typeof call.body === "object" && !Array.isArray(call.body)
              ? Object.keys(call.body)
              : [],
          id: call.body?.id,
          sessionStatus: call.body?.status,
          itemKeys:
            Array.isArray(call.body) && call.body[0] && typeof call.body[0] === "object"
              ? Object.keys(call.body[0])
              : [],
        })),
        createdId: created.id,
        wsMessages,
      };
    },
    { api: API_ORIGIN, fusionId: FUSION_ID, lk99Id: LK99_ID },
  );

  const expect = (method, path, status) => {
    const found = report.calls.find((call) => call.method === method && call.path === path);
    if (!found || found.status !== status) {
      throw new Error(
        `Expected ${method} ${path} -> ${status}, got ${JSON.stringify(found ?? null)}`,
      );
    }
    return found;
  };

  const register = expect("POST", "/auth/register", 200);
  for (const key of ["message", "email"]) {
    if (!register.keys.includes(key)) throw new Error(`Register response missing ${key}`);
  }
  const login = expect("POST", "/auth/login", 200);
  for (const key of ["access_token", "token_type"]) {
    if (!login.keys.includes(key)) throw new Error(`Login response missing ${key}`);
  }
  const history = expect("GET", "/history", 200);
  if (!history.isArray) throw new Error("History was not an array");
  for (const key of ["id", "query", "status", "final_report", "created_at"]) {
    if (!history.itemKeys.includes(key)) throw new Error(`History row missing ${key}`);
  }
  const created = expect("POST", "/research", 200);
  if (created.sessionStatus !== "pending") {
    throw new Error(`New research status was ${created.sessionStatus}, expected pending`);
  }
  for (const key of ["id", "query", "status", "final_report", "created_at"]) {
    if (!created.keys.includes(key)) throw new Error(`Research response missing ${key}`);
  }
  expect("GET", `/research/${FUSION_ID}`, 200);
  const sources = expect("GET", `/research/${FUSION_ID}/sources`, 200);
  if (!sources.isArray) throw new Error("Sources were not an array");
  for (const key of ["id", "url", "title", "snippet", "credibility_score"]) {
    if (!sources.itemKeys.includes(key)) throw new Error(`Source missing ${key}`);
  }
  const deleted = expect("DELETE", `/history/${LK99_ID}`, 200);
  for (const key of ["status", "msg"]) {
    if (!deleted.keys.includes(key)) throw new Error(`Delete response missing ${key}`);
  }

  const agents = report.wsMessages
    .filter((message) => message.agent)
    .map((message) => `${message.agent}:${message.status}`);
  const expectedAgents = [
    "search_agent:running",
    "search_agent:done",
    "summarizer_agent:running",
    "summarizer_agent:done",
    "fact_checker_agent:running",
    "fact_checker_agent:done",
    "writer_agent:running",
    "writer_agent:done",
  ];
  if (agents.join(",") !== expectedAgents.join(",")) {
    throw new Error(`WebSocket agents were ${agents.join(",")}`);
  }
  const doneSearch = report.wsMessages.find(
    (message) => message.agent === "search_agent" && message.status === "done",
  );
  if (doneSearch?.output !== "Found 5 results") {
    throw new Error("Search done payload missing output");
  }
  const completed = report.wsMessages.find((message) => message.type === "pipeline_completed");
  if (!completed || completed.status !== "done") {
    throw new Error(`WebSocket completion was ${JSON.stringify(completed ?? null)}`);
  }
  if (!report.createdId) throw new Error("Created research session had no id");
  console.log("  api mock ok");
}

async function capture(browser) {
  const desktop = {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "UTC",
  };

  const anon = await browser.newContext(desktop);
  anon.setDefaultTimeout(20_000);
  await anon.route(`${API_ORIGIN}/**`, mockApi);
  const login = await anon.newPage();
  attachLogs(login);
  await login.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await login.getByRole("heading", { name: "Login to QueryNest" }).waitFor();
  await login.getByRole("button", { name: "Login" }).waitFor();
  await login.getByPlaceholder("Email").waitFor();
  await login.getByPlaceholder("Password").waitFor();
  await shoot(login, "login.png", 2880, 1800);

  const register = await anon.newPage();
  attachLogs(register);
  await register.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  await register.getByRole("heading", { name: "Sign Up to QueryNest" }).waitFor();
  await register.getByRole("button", { name: "Sign Up" }).waitFor();
  await register.getByText("Already have an account? Login here").waitFor();
  await shoot(register, "register.png", 2880, 1800);

  await login.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await login.getByPlaceholder("Email").fill(EMAIL);
  await login.getByPlaceholder("Password").fill(PASSWORD);
  await login.getByRole("button", { name: "Login" }).click();
  await login.getByRole("heading", { name: "QueryNest", exact: true }).waitFor();
  await login.getByText("mRNA cancer vaccines").waitFor();
  await login.getByText("LK-99").waitFor();
  await dismissWelcome(login);
  await login.getByPlaceholder("Enter your research query").fill(FUSION_QUERY);
  await login.getByRole("button", { name: "New Research" }).waitFor();
  await assertFullyVisible(login, login.getByText("LK-99"), "failed session");
  await shoot(login, "dashboard.png", 2880, 1800);

  const socket = watchResearchSocket(anon);
  await socket.ready;
  await login.getByRole("button", { name: "New Research" }).click();
  await login.getByRole("heading", { name: FUSION_QUERY }).waitFor();
  await socket.progressDone;
  await login.getByText("search_agent", { exact: true }).waitFor();
  await login.getByText("summarizer_agent", { exact: true }).waitFor();
  await login.getByText("fact_checker_agent", { exact: true }).waitFor();
  await login.getByText("writer_agent", { exact: true }).waitFor();
  await login.getByText("running", { exact: true }).waitFor();
  await assertFullyVisible(login, login.getByText("writer_agent", { exact: true }), "writer row");
  await shoot(login, "progress.png", 2880, 1800);

  socket.finishPage();
  await login.getByRole("heading", { name: "Final Report" }).waitFor();
  await login.getByText("96% credible").waitFor();
  // Reopening the finished session is what View does: no socket, so the
  // page shows the summary line instead of the live rows.
  await login.reload({ waitUntil: "networkidle" });
  await login.getByRole("heading", { name: FUSION_QUERY }).waitFor();
  await login.getByText("4 agents completed").waitFor();
  await login.getByRole("heading", { name: "Final Report" }).waitFor();
  await login.getByRole("heading", { name: "Sources" }).waitFor();
  await login.getByText("IAEA World Fusion Outlook 2026").waitFor();
  await login.getByText("96% credible").waitFor();
  await login.getByText("93% credible").waitFor();
  await login.getByText("breeds its own tritium").waitFor();
  const layout = await login.evaluate(() =>
    [...document.querySelectorAll("h1, h2, h3")].map((el) => {
      const rect = el.getBoundingClientRect();
      return `${el.tagName} ${Math.round(rect.top)}-${Math.round(rect.bottom)} ${el.textContent?.slice(0, 48)}`;
    }),
  );
  console.log(layout.map((line) => `  layout ${line}`).join("\n"));
  const sourcesCard = login
    .locator("[data-slot='card']")
    .filter({ has: login.getByRole("heading", { name: "Sources" }) });
  await assertFullyVisible(login, sourcesCard, "sources card");
  await assertFullyVisible(
    login,
    login.getByText("No claim of continuous operation."),
    "last source snippet",
  );
  await assertFullyVisible(login, login.getByRole("heading", { name: FUSION_QUERY }), "query title");
  await shoot(login, "report.png", 2880, 1800);

  await exerciseApi(login);
  await anon.close();

  const phone = await browser.newContext({
    ...desktop,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  phone.setDefaultTimeout(20_000);
  await phone.route(`${API_ORIGIN}/**`, mockApi);
  const mobileLogin = await phone.newPage();
  attachLogs(mobileLogin);
  await mobileLogin.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await mobileLogin.getByRole("heading", { name: "Login to QueryNest" }).waitFor();
  const overflow = await mobileLogin.evaluate(() => document.documentElement.scrollWidth);
  if (overflow > 390) {
    throw new Error(`Phone login overflows horizontally (${overflow}px)`);
  }
  await shoot(mobileLogin, "login-mobile.png", 780, 1688);
  await phone.close();
}

let serverProcess;

process.on("SIGINT", () => {
  stop(serverProcess);
  process.exit(130);
});
process.on("SIGTERM", () => {
  stop(serverProcess);
  process.exit(143);
});

async function main() {
  if (await portInUse(PORT)) {
    throw new Error(`Port ${PORT} is already in use. Stop that process and re-run.`);
  }

  await mkdir(OUT_DIR, { recursive: true });

  console.log("Building production app…");
  const build = run(["build"]);
  const buildCode = await new Promise((resolve) => build.on("exit", resolve));
  if (buildCode !== 0) throw new Error(`build failed (${buildCode})`);

  console.log(`Starting server on ${BASE}…`);
  serverProcess = run(["start", "-H", "127.0.0.1", "-p", String(PORT)]);
  try {
    await waitForServer(serverProcess);
    const browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
    try {
      await capture(browser);
    } finally {
      await browser.close();
    }
  } finally {
    stop(serverProcess);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
