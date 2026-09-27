/* =========================================================================
   0. CONFIG — fill these in with your own Supabase project's values.
   Find them in: Supabase Dashboard → Project Settings → API
   ========================================================================= */
const SUPABASE_URL = "https://rsxbortronrhtdwlvwao.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzeGJvcnRyb25yaHRkd2x2d2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNjY0NTcsImV4cCI6MjEwNDc0MjQ1N30.cVemoSdCmpxV22YMJQCFukAZstQnNUx4dEli9TXefZQ";

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =========================================================================
   1. SMALL SHARED HELPERS
   ========================================================================= */
async function getMyProfile() {
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

async function logout() {
  await sb.auth.signOut();
  navigate("/login");
}

function toast(message, type = "") {
  let el = document.getElementById("__toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "__toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = "toast show" + (type ? " " + type : "");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.remove("show");
  }, 3200);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatCountdown(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDurationShort(seconds) {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderMath(root) {
  if (!root) return;
  const run = () => {
    if (typeof renderMathInElement !== "function") return setTimeout(run, 100);
    try {
      renderMathInElement(root, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
        strict: "ignore",
      });
    } catch (_) {}
  };
  run();
}

function normaliseImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const match =
      url.hostname.includes("drive.google.com") &&
      (url.pathname.match(/\/d\/([^/]+)/) || url.searchParams.get("id"));
    const id = Array.isArray(match) ? match[1] : match;
    return id
      ? `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`
      : url.href;
  } catch (_) {
    return null;
  }
}

function questionImageHtml(url) {
  const safeUrl = normaliseImageUrl(url);
  return safeUrl
    ? `<div class="question-image"><img src="${escapeHtml(safeUrl)}" alt="Question diagram" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='<div class=&quot;image-fallback&quot;>This question image could not be loaded. Please report it.</div>'"></div>`
    : "";
}

async function uploadQuestionImage(file) {
  if (!file) return null;
  if (!file.type.startsWith("image/"))
    throw new Error("Please choose an image file.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Image must be 5 MB or smaller.");
  const extension = (file.name.split(".").pop() || "png")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const unique = crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  const path = `${currentTest.id}/${Date.now()}-${unique}.${extension || "png"}`;
  const { data, error } = await sb.storage
    .from("question-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (error) throw error;
  const { data: publicUrl } = sb.storage
    .from("question-images")
    .getPublicUrl(data.path);
  return publicUrl.publicUrl;
}

function friendlyError(err) {
  if (!err) return "Something went wrong. Please try again.";
  const msg = err.message || String(err);
  return msg.replace(/^.*?:\s*/, "");
}

// Precise, exact-to-the-second duration, e.g. "1h 4m 32s", "6m 8s", "42s"
function formatDurationPrecise(seconds) {
  if (seconds == null || isNaN(seconds)) return "—";
  seconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h > 0) parts.push(h + "h");
  if (h > 0 || m > 0) parts.push(m + "m");
  parts.push(s + "s");
  return parts.join(" ");
}

// Consistent colour identity for each subject/category, used as small badges
// and accents throughout the app so students can visually tell them apart at a glance.
const SUBJECT_COLORS = {
  Physics: "#2451B0",
  Chemistry: "#1C8A5A",
  Mathematics: "#B15B00",
  Biology: "#B1305B",
};
function subjectColor(subject) {
  return SUBJECT_COLORS[subject] || "#5B6478";
}
function subjectDot(subject) {
  return `<span class="subject-dot" style="background:${subjectColor(subject)}"></span>`;
}

const CATEGORY_COLORS = {
  "JEE Main": ["#EAF0FB", "#193A85"],
  "JEE Advanced": ["#F1ECFC", "#5B2FBD"],
  NEET: ["#E5F5EE", "#1C8A5A"],
  "Class 9th": ["#FFF3E0", "#B15B00"],
  "Class 10th": ["#FFF3E0", "#B15B00"],
  "Class 11th": ["#FDECEF", "#B1305B"],
  "Class 12th": ["#FDECEF", "#B1305B"],
};
function categoryBadge(category) {
  const [bg, fg] = CATEGORY_COLORS[category] || ["#EEF0F3", "#5B6478"];
  return `<span class="status-tag" style="background:${bg};color:${fg};">${escapeHtml(category || "Other")}</span>`;
}

/* =========================================================================
   2. ROUTER — this is a single HTML page; different "views" are just
   sections toggled on/off, and the URL hash carries the route + params,
  e.g. #/exam?test=<uuid>  or  #/result?attempt=<uuid>
   ========================================================================= */
const VIEWS = [
  "landing",
  "auth",
  "dashboard",
  "tests",
  "test-details",
  "admin-test",
  "bulk-import",
  "exam",
  "review",
  "result",
  "leaderboard",
  "analytics",
  "profile",
];

// Views that show the signed-in app shell (desktop sidebar / mobile bottom
// nav). The exam view deliberately stays off this list — no site nav during
// a timed test, on purpose, same as the existing appbar convention.
const APP_SHELL_VIEWS = new Set([
  "dashboard",
  "tests",
  "test-details",
  "admin-test",
  "bulk-import",
  "result",
  "leaderboard",
  "analytics",
  "profile",
]);
let currentRoute = { path: "/login", params: new URLSearchParams() };

// Set to true while a student is actively inside a running exam, so they
// can't accidentally navigate away (hash edit / back button) mid-test.
let examLocked = false;
let lastExamHash = "/exam";

function parseHash() {
  let raw = window.location.hash.slice(1);
  if (!raw) raw = "/";
  const qIndex = raw.indexOf("?");
  const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const query = qIndex === -1 ? "" : raw.slice(qIndex + 1);
  return {
    path: path.startsWith("/") ? path : "/" + path,
    params: new URLSearchParams(query),
  };
}

function navigate(pathWithQuery) {
  window.location.hash = pathWithQuery;
}

function qs(name) {
  return currentRoute.params.get(name);
}

function showView(name) {
  VIEWS.forEach((v) =>
    document.getElementById("view-" + v).classList.toggle("active", v === name),
  );
}

async function router() {
  const parsed = parseHash();

  // Supabase silently re-fires auth-state changes on things like the tab
  // regaining focus — which happens right after a tab-switch violation
  // warning — and that calls router() again even though the route never
  // changed. If a test is already running, treat that as a no-op instead
  // of re-running enterExamView() and wiping out progress / reopening the
  // instructions modal mid-test.
  if (examStarted && !submitted && parsed.path === "/exam") {
    currentRoute = parsed;
    return;
  }

  if (examLocked && parsed.path !== "/exam") {
    toast("Finish or submit your test before leaving this page.", "error");
    window.location.hash = lastExamHash;
    return;
  }

  currentRoute = parsed;

  const {
    data: { session },
  } = await sb.auth.getSession();

  if (!session) {
    // Public, signed-out visitors land on the marketing page first; only an
    // explicit "/login" request (e.g. the Participate buttons) — or a deep
    // link to a page that requires a session — opens the existing auth view.
    if (parsed.path === "/" || parsed.path === "/landing") {
      showView("landing");
    } else {
      showView("auth");
    }
    syncAppShell(null, false);
    return;
  }

  if (
    parsed.path === "/login" ||
    parsed.path === "/" ||
    parsed.path === "/landing"
  ) {
    navigate("/dashboard");
    return;
  }

  switch (parsed.path) {
    case "/dashboard":
      showView("dashboard");
      await enterHomeView();
      break;
    case "/tests":
      showView("tests");
      await enterTestsView();
      break;
    case "/test-details":
      showView("test-details");
      await enterTestDetailsView();
      break;
    case "/admin-test":
      showView("admin-test");
      await enterAdminTestView();
      break;
    case "/bulk-import":
      showView("bulk-import");
      await enterBulkImportView();
      break;
    case "/exam":
      lastExamHash =
        "/exam" +
        (parsed.params.toString() ? "?" + parsed.params.toString() : "");
      showView("exam");
      await enterExamView();
      break;
    case "/result":
      showView("result");
      await enterResultView();
      break;
    case "/review":
      showView("review");
      await enterReviewView();
      break;
    case "/leaderboard":
      showView("leaderboard");
      await enterGlobalLeaderboardView();
      break;
    case "/analytics":
      showView("analytics");
      await enterAnalyticsView();
      break;
    case "/profile":
      showView("profile");
      await enterProfilePlaceholder();
      break;
    default:
      navigate("/dashboard");
      return;
  }

  await syncAppShell(
    document.querySelector(".view.active")?.id.replace("view-", ""),
    true,
  );
}

window.addEventListener("hashchange", router);
sb.auth.onAuthStateChange(() => {
  router();
});

/* =========================================================================
   3. AUTH VIEW
   ========================================================================= */
function setupAuthListeners() {
  const tabLoginBtn = document.getElementById("tabLoginBtn");
  const tabSignupBtn = document.getElementById("tabSignupBtn");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const authMessage = document.getElementById("authMessage");

  document.querySelectorAll(".password-toggle").forEach((btn) =>
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.passwordTarget);
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      btn.setAttribute(
        "aria-label",
        visible ? "Show password" : "Hide password",
      );
      btn.setAttribute("aria-pressed", String(!visible));
      btn.textContent = visible ? "👁️" : "🙈";
    }),
  );

  function showTab(tab) {
    authMessage.innerHTML = "";
    if (tab === "login") {
      tabLoginBtn.classList.add("active");
      tabSignupBtn.classList.remove("active");
      loginForm.style.display = "block";
      signupForm.style.display = "none";
    } else {
      tabLoginBtn.classList.remove("active");
      tabSignupBtn.classList.add("active");
      loginForm.style.display = "none";
      signupForm.style.display = "block";
    }
  }
  tabLoginBtn.addEventListener("click", () => showTab("login"));
  tabSignupBtn.addEventListener("click", () => showTab("signup"));

  function setMessage(html, kind) {
    authMessage.innerHTML = `<div class="${kind === "error" ? "error-box" : "success-box"}">${html}</div>`;
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.textContent = "Logging in…";
    authMessage.innerHTML = "";

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(escapeHtml(friendlyError(error)), "error");
      btn.disabled = false;
      btn.textContent = "Log in";
      return;
    }
    btn.disabled = false;
    btn.textContent = "Log in";
    navigate("/dashboard");
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("signupBtn");
    btn.disabled = true;
    btn.textContent = "Creating account…";
    authMessage.innerHTML = "";

    const full_name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name } },
    });

    btn.disabled = false;
    btn.textContent = "Create account";

    if (error) {
      setMessage(escapeHtml(friendlyError(error)), "error");
      return;
    }
    if (data.session) {
      navigate("/dashboard");
      return;
    }
    setMessage(
      "Account created. Check your email to confirm your address, then log in.",
      "success",
    );
    showTab("login");
  });
}

/* =========================================================================
   4. TESTS VIEW (join-a-test, my attempts, admin's test list)
   ========================================================================= */
let myProfile = null;

function setupDashboardListeners() {
  document.getElementById("segStudent").addEventListener("click", () => {
    document.getElementById("segStudent").classList.add("active");
    document.getElementById("segAdmin").classList.remove("active");
    document.getElementById("studentSection").style.display = "block";
    document.getElementById("adminSection").style.display = "none";
  });
  document.getElementById("segAdmin").addEventListener("click", () => {
    document.getElementById("segAdmin").classList.add("active");
    document.getElementById("segStudent").classList.remove("active");
    document.getElementById("studentSection").style.display = "none";
    document.getElementById("adminSection").style.display = "block";
  });
}

// Powers the "Tests" page (join-a-test box, my attempts, admin's test
// list) — kept as its own function/route so old shared links and all the
// existing join/admin logic below work completely unchanged.
async function enterTestsView() {
  myProfile = await getMyProfile();
  const {
    data: { session },
  } = await sb.auth.getSession();
  document.getElementById("userName").textContent =
    myProfile?.full_name || session.user.email;

  // reset segmented state to a known default each time we arrive here
  document.getElementById("segStudent").classList.add("active");
  document.getElementById("segAdmin").classList.remove("active");
  document.getElementById("studentSection").style.display = "block";
  document.getElementById("adminSection").style.display = "none";

  const roleChip = document.getElementById("roleChip");
  roleChip.className = "role-chip";
  if (myProfile?.role === "admin") {
    roleChip.textContent = "Admin";
    roleChip.classList.add("admin");
    document.getElementById("adminSegmentWrap").style.display = "block";
  } else {
    roleChip.textContent = "Student";
    document.getElementById("adminSegmentWrap").style.display = "none";
  }

  // reset the tests catalog's search/filter UI to a known default each time
  testsFilterState = { status: "all", query: "" };
  const searchInput = document.getElementById("testsSearchInput");
  if (searchInput) searchInput.value = "";
  document
    .querySelectorAll("#testsStatusTabs button")
    .forEach((b) => b.classList.toggle("active", b.dataset.filter === "all"));

  await loadTestsCatalog();
  if (myProfile?.role === "admin") await loadAdminTests();
}

/* ---- Tests catalog: every published test the student can see, merged
   with their own attempt (if any), filterable by search + Ongoing/
   Upcoming/Past. Replaces the old plain "my attempts" list. ---- */
let testsCatalogCache = [];
let testsFilterState = { status: "all", query: "" };
function fetchTestsCatalog() {
  return sb.rpc("get_student_dashboard_tests").then(({ data, error }) => ({
    data: (data || []).map((entry) => ({
      ...entry,
      windowState:
        entry.lifecycle === "live"
          ? "ongoing"
          : entry.lifecycle === "locked"
            ? "upcoming"
            : "past",

      myAttempt: entry.attempt_id
        ? {
            id: entry.attempt_id,
            status: entry.attempt_status,
            total_score: entry.attempt_score,
            submitted_at: entry.attempt_submitted_at,
          }
        : null,
    })),
    error,
  }));
}

function classifyTestWindow(test, nowMs = Date.now()) {
  if (test.lifecycle) {
    return test.lifecycle === "live"
      ? "ongoing"
      : test.lifecycle === "locked"
        ? "upcoming"
        : "past";
  }
  const from = test.available_from
    ? new Date(test.available_from).getTime()
    : null;
  const until = test.available_until
    ? new Date(test.available_until).getTime()
    : null;
  if (from !== null && nowMs < from) return "upcoming";
  if (until !== null && nowMs > until) return "past";
  return "ongoing";
}

function mergeCatalogWithAttempts(catalog, attempts) {
  const latestByTest = new Map();

  (attempts || []).forEach((a) => {
    const existing = latestByTest.get(a.test_id);

    if (
      !existing ||
      new Date(a.started_at) > new Date(existing.started_at)
    ) {
      latestByTest.set(a.test_id, a);
    }
  });

  return (catalog || []).map((t) => ({
    ...t,
    myAttempt: latestByTest.get(t.id) || null,
    windowState: classifyTestWindow(t),
  }));
}
function reminderKey(testId) {
  return `jh_reminder_${testId}`;
}
function isReminderSet(testId) {
  try {
    return localStorage.getItem(reminderKey(testId)) === "1";
  } catch (e) {
    return false;
  }
}
function setReminder(testId, on) {
  try {
    if (on) localStorage.setItem(reminderKey(testId), "1");
    else localStorage.removeItem(reminderKey(testId));
  } catch (e) {
    /* localStorage unavailable (private browsing etc) — reminder is a
       best-effort local convenience, never worth erroring over */
  }
}

function testCardCta(entry) {
  const a = entry.myAttempt;
  if (a && a.status !== "in_progress") {
    return `<a class="btn btn-sm" href="#/result?attempt=${a.id}">View Report</a>`;
  }
  if (entry.windowState === "past") {
    return `<a class="btn btn-sm" href="#/test-details?test=${encodeURIComponent(entry.id)}">View details</a>`;
  }
  if (entry.windowState === "upcoming") {
    return `<a class="btn btn-sm" href="#/test-details?test=${encodeURIComponent(entry.id)}">View syllabus</a>`;
  }
  const label = a && a.status === "in_progress" ? "Resume" : "Attempt Now";
  return `<a class="btn btn-primary btn-sm" href="#/exam?test=${encodeURIComponent(entry.id)}">${label}</a>`;
}

function testCardMeta(entry) {
  const parts = [`${entry.duration_minutes} min`];
  if (entry.windowState === "upcoming") {
    parts.push(`Opens ${formatDateTime(entry.available_from)}`);
  } else if (entry.windowState === "past") {
    parts.push(`Closed ${formatDateTime(entry.available_until)}`);
  } else {
    parts.push(`Closes ${formatDateTime(entry.available_until)}`);
  }
  return parts.join(" · ");
}

function testCardHtml(entry) {
  const liveBadge =
    entry.windowState === "ongoing"
      ? `<span class="badge badge-live">Live</span>`
      : "";
  const lifecycleBadge =
    entry.windowState === "upcoming"
      ? `<span class="status-tag locked">🔒 Locked</span>`
      : entry.windowState === "past"
        ? `<span class="status-tag closed">🔴 Closed</span>`
        : "";
  const attemptTag = entry.myAttempt
    ? `<span class="status-tag ${entry.myAttempt.status}">${entry.myAttempt.status.replace("_", " ")}</span>`
    : "";
  return `
    <div class="test-card">
      <div class="test-card-top">${liveBadge}${lifecycleBadge}${categoryBadge(entry.category)}${attemptTag}</div>
      <h3 class="test-card-title">${escapeHtml(entry.title)}</h3>
      <div class="test-card-meta">${testCardMeta(entry)}</div>
      <div class="test-card-cta">${testCardCta(entry)}</div>
    </div>
  `;
}

function renderTestsCards(entries) {
  const grid = document.getElementById("testsCardGrid");
  if (!grid) return;
  if (!entries.length) {
    grid.innerHTML = `<div class="empty-state">No tests match this filter yet.</div>`;
    return;
  }
  grid.innerHTML = entries.map(testCardHtml).join("");
}

function renderHomeTestsToolbar() {
  const toolbar = document.getElementById("homeTestsToolbar");
  if (!toolbar) return;
  toolbar.innerHTML = `
    <div class="tests-search"><span class="tests-search-icon">⌕</span><input type="search" id="homeTestsSearch" placeholder="Search exams"></div>
    <div class="segmented tests-status-tabs" id="homeTestsStatusTabs">
      <button type="button" class="active" data-filter="all">All</button>
      <button type="button" data-filter="ongoing">Live</button>
      <button type="button" data-filter="upcoming">Locked</button>
      <button type="button" data-filter="past">Closed</button>
    </div>`;
  toolbar.querySelector("input").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    renderHomeTests(
      testsCatalogCache.filter(
        (entry) =>
          (!query || entry.title.toLowerCase().includes(query)) &&
          (testsFilterState.status === "all" ||
            entry.windowState === testsFilterState.status),
      ),
    );
  });
  toolbar.querySelectorAll("button[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      toolbar
        .querySelectorAll("button")
        .forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      testsFilterState.status = button.dataset.filter;
      renderHomeTests(testsCatalogCache);
    });
  });
}

function renderHomeTests(entries) {
  const grid = document.getElementById("homeTestsGrid");
  if (!grid) return;
  const filtered = entries.filter(
    (entry) =>
      testsFilterState.status === "all" ||
      entry.windowState === testsFilterState.status,
  );
  grid.innerHTML = filtered.length
    ? filtered.slice(0, 6).map(testCardHtml).join("")
    : `<div class="empty-state">No exams match this view yet.</div>`;
}

function applyTestsFilter() {
  const { status, query } = testsFilterState;
  const q = query.trim().toLowerCase();
  const filtered = testsCatalogCache.filter((t) => {
    if (status !== "all" && t.windowState !== status) return false;
    if (q && !t.title.toLowerCase().includes(q)) return false;
    return true;
  });
  renderTestsCards(filtered);
}

async function loadTestsCatalog() {
  const grid = document.getElementById("testsCardGrid");
  if (!grid) return;

  grid.innerHTML = `<div class="empty-state">Loading…</div>`;

  const { data: catalog, error } = await fetchTestsCatalog();

  if (error) {
    console.error("Student dashboard tests error:", error);
    grid.innerHTML = `
      <div class="error-box">
        ${escapeHtml(friendlyError(error))}
      </div>
    `;
    return;
  }

  testsCatalogCache = catalog || [];
  applyTestsFilter();
} 
function setupTestsCatalogListeners() {
  const searchInput = document.getElementById("testsSearchInput");
  const tabs = document.getElementById("testsStatusTabs");
  const grid = document.getElementById("testsCardGrid");
  if (!searchInput || !tabs || !grid) return;

  searchInput.addEventListener("input", (e) => {
    testsFilterState.query = e.target.value;
    applyTestsFilter();
  });

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-filter]");
    if (!btn) return;
    tabs
      .querySelectorAll("button")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    testsFilterState.status = btn.dataset.filter;
    applyTestsFilter();
  });

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".js-remind");
    if (!btn) return;
    const id = btn.dataset.testId;
    const nowSet = !isReminderSet(id);
    setReminder(id, nowSet);
    toast(
      nowSet ? "We'll remind you when this test opens" : "Reminder removed",
    );
    const entry = testsCatalogCache.find((t) => String(t.id) === String(id));
    if (entry) btn.outerHTML = testCardCta(entry);
  });
}

/* =========================================================================
   4b. HOME VIEW — greeting, live-test spotlight, quick stats, quick access
   ========================================================================= */
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function firstNameOf(fullName) {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0];
}

function greetingWord(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function formatHomeDate(date = new Date()) {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}, ${date.getFullYear()}`;
}

async function enterTestDetailsView() {
  const content = document.getElementById("testDetailsContent");
  const testId = qs("test");
  if (!testId) {
    content.innerHTML = `<div class="error-box">No test was selected.</div>`;
    return;
  }
  content.innerHTML = `<div class="empty-state">Loading syllabus…</div>`;
  const { data, error } = await sb.rpc("get_student_test_details", {
    p_test_id: testId,
  });
  if (error || !data) {
    content.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error) || "Test details could not be loaded.")}</div>`;
    return;
  }
  const state = data.lifecycle;
  const stateLabel =
    state === "live"
      ? "🟢 Live"
      : state === "closed"
        ? "🔴 Closed"
        : "🔒 Locked";
  const subjectRows = (data.subjects || [])
    .map(
      (subject) => `
    <div class="syllabus-row">
      <div><strong>${subjectDot(subject.subject)}${escapeHtml(subject.subject)}</strong><div class="text-muted syllabus-chapters">${(subject.chapters || []).map(escapeHtml).join(" · ") || "Chapter details will be announced"}</div></div>
      <span>${subject.question_count} questions · ${subject.total_marks} marks</span>
    </div>`,
    )
    .join("");
  const marking = (data.marking_scheme || [])
    .map(
      (scheme) =>
        `<span class="detail-chip">+${scheme.positive_marks} / −${scheme.negative_marks}</span>`,
    )
    .join("");
  const attempt = data.attempt;
  const action =
    attempt && attempt.status !== "in_progress"
      ? `<a class="btn btn-primary" href="#/result?attempt=${encodeURIComponent(attempt.id)}">View report</a>`
      : state === "live"
        ? `<a class="btn btn-primary" href="#/exam?test=${encodeURIComponent(data.id)}">${attempt ? "Resume test" : "Start test"}</a>`
        : `<button class="btn btn-primary" disabled>${state === "closed" ? "Test closed" : `Starts ${formatDateTime(data.available_from)}`}</button>`;
  content.innerHTML = `
    <div class="details-hero">
      <div><span class="eyebrow-label">${escapeHtml(data.category || "Test series")}</span><h1>${escapeHtml(data.title)}</h1><p>${escapeHtml(data.description || "Review the syllabus and marking scheme before you begin.")}</p></div>
      <span class="details-state details-state-${state}">${stateLabel}</span>
    </div>
    <div class="details-metric-grid">
      <div class="details-metric"><strong>${data.duration_minutes}m</strong><span>Duration</span></div>
      <div class="details-metric"><strong>${data.question_count}</strong><span>Questions</span></div>
      <div class="details-metric"><strong>${data.total_marks}</strong><span>Total marks</span></div>
      <div class="details-metric"><strong>${formatDateTime(data.available_until)}</strong><span>Closes</span></div>
    </div>
    <div class="details-grid">
      <section class="card"><div class="section-title"><h2>Syllabus</h2><span class="text-muted">${data.question_count} questions</span></div><div class="syllabus-list">${subjectRows || `<div class="empty-state">Syllabus will be added soon.</div>`}</div></section>
      <section class="card"><h2>Marking scheme</h2><div class="detail-chip-row">${marking || `<span class="text-muted">Not specified</span>`}</div><h2 class="details-subheading">Schedule</h2><dl class="details-dl"><div><dt>Publishes</dt><dd>${formatDateTime(data.available_from)}</dd></div><div><dt>Closes</dt><dd>${formatDateTime(data.available_until)}</dd></div></dl><div class="details-actions">${action}</div></section>
    </div>
    <section class="card details-instructions"><h2>Instructions</h2><p>${escapeHtml(data.instructions || "Read every question carefully. Unattempted questions receive zero marks. Your attempt is timed from the moment you begin.")}</p></section>`;
}

function renderHomeSpotlight(merged) {
  const el = document.getElementById("homeSpotlight");
  if (!el) return;

  // The single most urgent live test: ongoing, and either never attempted
  // or still in progress. Soonest-closing first.
  const candidates = merged
    .filter(
      (t) =>
        t.windowState === "ongoing" &&
        (!t.myAttempt || t.myAttempt.status === "in_progress"),
    )
    .sort((a, b) => new Date(a.available_until) - new Date(b.available_until));

  if (!candidates.length) {
    el.innerHTML = `
      <div class="home-spotlight-empty">
        <div class="pes-icon">📭</div>
        <h2>No live test right now</h2>
        <p>Check the Tests tab for upcoming tests, or revisit ones you've already completed.</p>
        <a href="#/tests" class="btn btn-primary btn-sm">Go to Tests</a>
      </div>
    `;
    return;
  }

  const t = candidates[0];
  const label =
    t.myAttempt && t.myAttempt.status === "in_progress"
      ? "Resume Test"
      : "Take Test";
  el.innerHTML = `
    <div class="home-spotlight-card">
      <div class="home-spotlight-top">
        <span class="badge badge-live">Live</span>
        ${categoryBadge(t.category)}
      </div>
      <h2 class="home-spotlight-title">${escapeHtml(t.title)}</h2>
      <div class="home-spotlight-meta">${t.duration_minutes} minutes · Closes ${formatDateTime(t.available_until)}</div>
      <a href="#/exam?test=${encodeURIComponent(t.id)}" class="btn btn-primary home-spotlight-cta">🚀 ${label} →</a>
    </div>
  `;
}

// Total Tests / Attempted come straight from the catalog + attempts rows
// already fetched. Avg Score is a true marks-weighted percentage, matching
// the same math the Result page uses (total_score / sum of subject totals)
// — computed via the same get_full_report RPC, capped to the most recent
// 25 submitted attempts so this stays fast for very active students.
async function renderHomeStats(merged, attempts) {
  const el = document.getElementById("homeStats");
  if (!el) return;

  const totalTests = merged.length;
  const attemptedCount = new Set(attempts.map((a) => a.test_id)).size;

  const submittedAttempts = attempts
    .filter((a) => a.status !== "in_progress")
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
    .slice(0, 25);

  let avgScoreLabel = "—";
  if (submittedAttempts.length) {
    const reports = await Promise.all(
      submittedAttempts.map((a) =>
        sb.rpc("get_full_report", { p_attempt_id: a.id }).then(
          (r) => r.data,
          () => null,
        ),
      ),
    );
    let scoreSum = 0;
    let maxSum = 0;
    reports.forEach((report) => {
      if (!report || !report.subject_rows) return;
      const max = report.subject_rows.reduce((s, r) => s + Number(r.total), 0);
      if (max > 0) {
        scoreSum += Number(report.total_score) || 0;
        maxSum += max;
      }
    });
    if (maxSum > 0)
      avgScoreLabel = `${((scoreSum / maxSum) * 100).toFixed(1)}%`;
  }

  el.innerHTML = `
    <div class="home-stat-card"><div class="home-stat-val">${totalTests}</div><div class="home-stat-lbl">Total Tests</div></div>
    <div class="home-stat-card"><div class="home-stat-val">${attemptedCount}</div><div class="home-stat-lbl">Attempted</div></div>
    <div class="home-stat-card"><div class="home-stat-val">${avgScoreLabel}</div><div class="home-stat-lbl">Avg Score</div></div>
  `;
}

async function enterHomeView() {
  myProfile = myProfile || (await getMyProfile());
  const name = myProfile?.full_name || "Student";

  document.getElementById("homeGreetingWord").textContent = greetingWord();
  document.getElementById("homeGreetingName").textContent =
    firstNameOf(name) || "Student";
  document.getElementById("homeDateLine").textContent = formatHomeDate();
  const avatarEl = document.getElementById("homeAvatar");
  if (avatarEl)
    avatarEl.textContent = name.trim().charAt(0).toUpperCase() || "S";

  const spotlightEl = document.getElementById("homeSpotlight");
  const statsEl = document.getElementById("homeStats");
  spotlightEl.innerHTML = `<div class="empty-state">Loading…</div>`;
  statsEl.innerHTML = "";

  const [{ data: catalog, error: catErr }, { data: attempts, error: attErr }] =
    await Promise.all([
      fetchTestsCatalog(),
      sb
        .from("test_attempts")
        .select("id, test_id, status, total_score, started_at, submitted_at")
        .eq("user_id", myProfile.id),
    ]);

  if (catErr || attErr) {
    spotlightEl.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(catErr || attErr))}</div>`;
    return;
  }

  const merged = mergeCatalogWithAttempts(catalog, attempts);
  testsCatalogCache = merged;
  testsFilterState = { status: "all", query: "" };
  renderHomeTestsToolbar();
  renderHomeTests(merged);
  renderHomeSpotlight(merged);
  await renderHomeStats(merged, attempts || []);
}

async function loadAdminTests() {
  const list = document.getElementById("adminTestsList");
  const { data, error } = await sb
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error))}</div>`;
    return;
  }
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty-state">No tests have been created yet.</div>`;
    return;
  }

  const counts = await Promise.all(
    data.map((t) =>
      sb
        .from("test_attempts")
        .select("id", { count: "exact", head: true })
        .eq("test_id", t.id),
    ),
  );

  list.innerHTML = data
    .map((t, i) => {
      const attemptCount = counts[i]?.count ?? 0;
      return `
      <div class="list-row">
        <div class="list-row-main">
          <div class="list-row-title">${escapeHtml(t.title)} ${categoryBadge(t.category)}</div>
          <div class="list-row-meta">
            <span class="status-tag ${t.is_published ? "published" : "draft"}">${t.is_published ? "Scheduled" : "Locked"}</span>
            · ${attemptCount} attempt${attemptCount === 1 ? "" : "s"} · Duration ${t.duration_minutes}m
          </div>
        </div>
        <div class="list-row-actions">
          <a class="btn btn-primary btn-sm" href="#/admin-test?test=${t.id}">Manage</a>
          <button class="btn btn-sm btn-danger js-delete-test" data-id="${t.id}">Delete</button>
        </div>
      </div>
    `;
    })
    .join("");

  list
    .querySelectorAll(".js-delete-test")
    .forEach((btn) =>
      btn.addEventListener("click", () => deleteTest(btn.dataset.id)),
    );
}

async function deleteTest(id) {
  if (
    !confirm(
      "Delete this test, its questions, attempts, reports, and leaderboard entries? This cannot be undone.",
    )
  )
    return;
  const { error } = await sb.rpc("admin_delete_test", { p_test_id: id });
  if (error) {
    toast(friendlyError(error), "error");
    return;
  }
  toast("Test deleted");
  await loadAdminTests();
}

/* =========================================================================
   5. ADMIN TEST MANAGER VIEW
   ========================================================================= */
let currentTest = null;
let questionCounter = 0;
let editingQuestionId = null;
let editingQuestionImageUrl = null;

function toLocalInputValue(isoOrDate) {
  const d = new Date(isoOrDate);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// One combined "as students will see it" preview — covers the question
// text, every option, and the explanation, all with maths rendered. Lives
// below the form and updates on every keystroke/change.
function updateQuestionPreview() {
  const preview = document.getElementById("questionLivePreview");
  if (!preview) return;

  const subject = document.getElementById("subjectInput").value;
  const type = document.getElementById("typeInput").value;
  const questionText = document
    .getElementById("questionTextInput")
    .value.trim();
  const explanation = document.getElementById("explanationInput").value.trim();
  const positiveMarks = document.getElementById("positiveMarksInput").value;
  const negativeMarks = document.getElementById("negativeMarksInput").value;

  if (!questionText && !subject) {
    preview.innerHTML = `<div class="preview-empty">Start typing above — your question will appear here exactly as students will see it, with maths rendered.</div>`;
    return;
  }

  let bodyHtml;
  if (type === "mcq") {
    const correctOption = document.getElementById("correctOptionInput").value;
    const letters = ["A", "B", "C", "D"];
    const opts = letters
      .map((id) => ({
        id,
        text: document.getElementById("opt" + id).value.trim(),
      }))
      .filter((o) => o.text);
    bodyHtml = opts.length
      ? `<div class="option-list">` +
        opts
          .map(
            (o) => `
          <div class="option-item ${o.id === correctOption ? "review-correct" : ""}">
            <span class="option-letter">${o.id}</span>
            <span class="option-text">${escapeHtml(o.text)}</span>
            ${o.id === correctOption ? `<span class="status-tag published" style="margin-left:auto;">Correct</span>` : ""}
          </div>
        `,
          )
          .join("") +
        `</div>`
      : `<div class="preview-empty-inline">No options entered yet.</div>`;
  } else {
    const val = document.getElementById("correctIntegerInput").value;
    bodyHtml = `<p style="font-size:14px;margin:0;"><span style="color:var(--success);font-weight:650;">Correct answer: ${val !== "" ? escapeHtml(val) : "—"}</span></p>`;
  }

  preview.innerHTML = `
    <div class="question-meta">
      <span class="question-number-badge">${subject ? subjectDot(subject) + escapeHtml(subject) : `<span class="preview-empty-inline">No subject selected</span>`}</span>
      <span class="question-marks">+${positiveMarks || 0} / -${negativeMarks || 0}</span>
    </div>
    <div class="question-text">${questionText ? escapeHtml(questionText) : `<span class="preview-empty-inline">Question text will appear here…</span>`}</div>
    ${bodyHtml}
    ${explanation ? `<div class="explanation-box mt-8"><strong>Explanation:</strong> ${escapeHtml(explanation)}</div>` : ""}
  `;
  renderMath(preview);
}

function setupAdminTestListeners() {
  document.getElementById("typeInput").addEventListener("change", (e) => {
    const isMcq = e.target.value === "mcq";
    document.getElementById("mcqFields").style.display = isMcq
      ? "block"
      : "none";
    document.getElementById("integerFields").style.display = isMcq
      ? "none"
      : "block";
    updateQuestionPreview();
  });
  // One unified live preview reflecting the question exactly as a student
  // will see it — question text, every option, and the explanation all
  // render maths, instead of a preview limited to the question text alone.
  [
    "subjectInput",
    "questionTextInput",
    "optA",
    "optB",
    "optC",
    "optD",
    "correctOptionInput",
    "correctIntegerInput",
    "explanationInput",
    "positiveMarksInput",
    "negativeMarksInput",
  ].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", updateQuestionPreview);
    el.addEventListener("change", updateQuestionPreview);
  });
  document.getElementById("imageFileInput").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    const box = document.getElementById("imagePreview");
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      e.target.value = "";
      toast(
        !file.type.startsWith("image/")
          ? "Choose an image file."
          : "Image must be 5 MB or smaller.",
        "error",
      );
      return;
    }
    box.hidden = false;
    box.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Selected image preview">`;
  });

  document
    .getElementById("testDetailsForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("saveDetailsBtn");
      btn.disabled = true;

      const payload = {
        title: document.getElementById("titleInput").value.trim(),
        description: document.getElementById("descInput").value.trim() || null,
        instructions:
          document.getElementById("instructionsInput").value.trim() || null,
        category: document.getElementById("categoryInput").value,
        duration_minutes: parseInt(
          document.getElementById("durationInput").value,
          10,
        ),
        available_from: new Date(
          document.getElementById("fromInput").value,
        ).toISOString(),
        available_until: new Date(
          document.getElementById("untilInput").value,
        ).toISOString(),
        is_published: true,
      };

      if (
        new Date(payload.available_until) <= new Date(payload.available_from)
      ) {
        toast("Closing time must be after the opening time", "error");
        btn.disabled = false;
        return;
      }

      if (currentTest) {
        const { data, error } = await sb
          .from("tests")
          .update(payload)
          .eq("id", currentTest.id)
          .select()
          .single();
        btn.disabled = false;
        if (error) {
          toast(friendlyError(error), "error");
          return;
        }
        currentTest = data;
        toast("Test details saved", "success");
      } else {
        const { data, error } = await sb
          .from("tests")
          .insert({ ...payload, created_by: myProfile.id })
          .select()
          .single();
        btn.disabled = false;
        if (error) {
          toast(friendlyError(error), "error");
          return;
        }
        currentTest = data;
        navigate(`/admin-test?test=${data.id}`);
        document.getElementById("detailsTitle").textContent = "Test details";
        document.getElementById("saveDetailsBtn").textContent = "Save changes";
        toast("Test created — now add some questions", "success");
        showPostCreateSections();
        await loadQuestions();
        await loadStudentResults();
        await loadLeaderboard();
        await loadReports();
      }
    });

  document
    .getElementById("questionForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("addQuestionBtn");
      btn.disabled = true;

      const subject = document.getElementById("subjectInput").value.trim();
      const type = document.getElementById("typeInput").value;
      const question_text = document
        .getElementById("questionTextInput")
        .value.trim();
      let image_url = editingQuestionImageUrl;
      const imageFile = document.getElementById("imageFileInput").files?.[0];
      try {
        if (imageFile) image_url = await uploadQuestionImage(imageFile);
      } catch (uploadError) {
        toast(friendlyError(uploadError), "error");
        btn.disabled = false;
        return;
      }
      const explanation =
        document.getElementById("explanationInput").value.trim() || null;
      const positive_marks = parseFloat(
        document.getElementById("positiveMarksInput").value,
      );
      const negative_marks = parseFloat(
        document.getElementById("negativeMarksInput").value,
      );

      let options = null,
        correct_option = null,
        correct_integer_value = null;

      if (type === "mcq") {
        const letters = ["A", "B", "C", "D"];
        const texts = [
          document.getElementById("optA").value.trim(),
          document.getElementById("optB").value.trim(),
          document.getElementById("optC").value.trim(),
          document.getElementById("optD").value.trim(),
        ];
        options = letters
          .map((id, i) => ({ id, text: texts[i] }))
          .filter((o) => o.text);
        correct_option = document.getElementById("correctOptionInput").value;
        if (options.length < 2) {
          toast("Add at least two options", "error");
          btn.disabled = false;
          return;
        }
        if (!options.some((o) => o.id === correct_option)) {
          toast("Correct option must have text", "error");
          btn.disabled = false;
          return;
        }
      } else {
        const val = document.getElementById("correctIntegerInput").value;
        if (val === "") {
          toast("Enter the correct integer value", "error");
          btn.disabled = false;
          return;
        }
        correct_integer_value = parseFloat(val);
      }

      const wasEditing = !!editingQuestionId;
      const questionPayload = {
        test_id: currentTest.id,
        subject,
        question_type: type,
        question_text,
        image_url,
        explanation,
        options,
        correct_option,
        correct_integer_value,
        positive_marks,
        negative_marks,
      };
      if (!wasEditing) questionPayload.question_order = questionCounter++;

      // Make sure the current Supabase login session is available
      // before sending the INSERT/UPDATE request.
      const {
        data: { session },
      } = await sb.auth.getSession();

      if (!session?.user?.id) {
        btn.disabled = false;
        toast(
          "Your login session is not ready. Please refresh the page and try again.",
          "error",
        );
        return;
      }

      const { error } = wasEditing
        ? await sb
            .from("questions")
            .update(questionPayload)
            .eq("id", editingQuestionId)
        : await sb.from("questions").insert(questionPayload);

      btn.disabled = false;

      if (error) {
        console.error("Question save error:", error);
        toast(friendlyError(error), "error");
        return;
      }

      document.getElementById("questionTextInput").value = "";
      document.getElementById("imageFileInput").value = "";
      document.getElementById("explanationInput").value = "";
      document.getElementById("optA").value = "";
      document.getElementById("optB").value = "";
      document.getElementById("optC").value = "";
      document.getElementById("optD").value = "";
      document.getElementById("correctIntegerInput").value = "";
      document.getElementById("imagePreview").hidden = true;
      document.getElementById("imagePreview").innerHTML = "";
      editingQuestionId = null;
      editingQuestionImageUrl = null;
      btn.textContent = "Add question";
      updateQuestionPreview();
      document.getElementById("questionTextInput").focus();

      toast(wasEditing ? "Question updated" : "Question added", "success");
      await loadQuestions();
    });
}

async function enterAdminTestView() {
  myProfile = myProfile || (await getMyProfile());

  // reset all admin-test state/UI to a blank slate every time we arrive here
  currentTest = null;
  questionCounter = 0;
  editingQuestionId = null;
  editingQuestionImageUrl = null;
  document.getElementById("testDetailsForm").reset();
  document.getElementById("detailsTitle").textContent = "Test details";
  document.getElementById("saveDetailsBtn").textContent = "Create test";
  document.getElementById("shareCard").style.display = "none";
  document.getElementById("questionsCard").style.display = "none";
  document.getElementById("questionListCard").style.display = "none";
  document.getElementById("studentResultsCard").style.display = "none";
  document.getElementById("leaderboardCard").style.display = "none";
  document.getElementById("reportsCard").style.display = "none";
  document.getElementById("mcqFields").style.display = "block";
  document.getElementById("integerFields").style.display = "none";
  document.getElementById("typeInput").value = "mcq";

  if (!myProfile || myProfile.role !== "admin") {
    document.getElementById("notAdminNotice").style.display = "block";
    document.getElementById("adminMainContent").style.display = "none";
    return;
  }
  document.getElementById("notAdminNotice").style.display = "none";
  document.getElementById("adminMainContent").style.display = "block";

  const testId = qs("test");
  if (testId) {
    await loadExistingTest(testId);
  } else {
    const now = new Date();
    const later = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    document.getElementById("fromInput").value = toLocalInputValue(now);
    document.getElementById("untilInput").value = toLocalInputValue(later);
  }
}

async function loadExistingTest(testId) {
  const { data, error } = await sb
    .from("tests")
    .select("*")
    .eq("id", testId)
    .single();
  if (error || !data) {
    toast("Could not load that test", "error");
    return;
  }

  currentTest = data;
  document.getElementById("detailsTitle").textContent = "Test details";
  document.getElementById("saveDetailsBtn").textContent = "Save changes";
  document.getElementById("titleInput").value = data.title;
  document.getElementById("descInput").value = data.description || "";
  document.getElementById("instructionsInput").value = data.instructions || "";
  document.getElementById("categoryInput").value = data.category || "JEE Main";
  document.getElementById("durationInput").value = data.duration_minutes;
  document.getElementById("fromInput").value = toLocalInputValue(
    data.available_from,
  );
  document.getElementById("untilInput").value = toLocalInputValue(
    data.available_until,
  );

  showPostCreateSections();
  await loadQuestions();
  await loadStudentResults();
  await loadLeaderboard();
  await loadReports();
}

function showPostCreateSections() {
  document.getElementById("shareCard").style.display = "block";
  document.getElementById("questionsCard").style.display = "block";
  document.getElementById("questionListCard").style.display = "block";
  document.getElementById("studentResultsCard").style.display = "block";
  document.getElementById("leaderboardCard").style.display = "block";
  document.getElementById("reportsCard").style.display = "block";
  renderShareCard();
}

function renderShareCard() {
  const tag = document.getElementById("publishTag");
  const now = Date.now();
  const state =
    !currentTest.is_published ||
    now < new Date(currentTest.available_from).getTime()
      ? "locked"
      : now >= new Date(currentTest.available_until).getTime()
        ? "closed"
        : "live";
  tag.textContent =
    state === "live" ? "Live" : state === "closed" ? "Closed" : "Locked";
  tag.className = "status-tag " + state;
  document.getElementById("scheduleSummary").textContent =
    `Students see this test automatically. Publishes ${formatDateTime(currentTest.available_from)} · closes ${formatDateTime(currentTest.available_until)}.`;
}

async function loadQuestions() {
  const { data, error } = await sb
    .from("questions")
    .select("*")
    .eq("test_id", currentTest.id)
    .order("question_order");
  const list = document.getElementById("questionsList");
  const countTag = document.getElementById("questionCountTag");
  if (error) {
    list.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error))}</div>`;
    return;
  }

  questionCounter = data.length;
  countTag.textContent = `${data.length} question${data.length === 1 ? "" : "s"}`;

  if (data.length === 0) {
    list.innerHTML = `<div class="empty-state">No questions yet — add your first one above.</div>`;
    return;
  }

  list.innerHTML = data
    .map(
      (q, i) => `
    <div class="list-row">
      <div class="list-row-main">
        <div class="list-row-title">Q${i + 1}. ${escapeHtml(q.question_text.slice(0, 90))}${q.question_text.length > 90 ? "…" : ""}</div>
        <div class="list-row-meta">${subjectDot(q.subject)}${escapeHtml(q.subject)} · ${q.question_type === "mcq" ? "MCQ" : "Integer"} · +${q.positive_marks} / -${q.negative_marks}${q.explanation ? " · has explanation" : ""}</div>
      </div>
      <div class="list-row-actions">
        <button class="btn btn-sm js-edit-question" data-id="${q.id}">Edit</button>
        <button class="btn btn-sm btn-danger js-delete-question" data-id="${q.id}">Delete</button>
      </div>
    </div>
  `,
    )
    .join("");

  list.querySelectorAll(".js-delete-question").forEach((btn) => {
    btn.addEventListener("click", () => deleteQuestion(btn.dataset.id));
  });
  list.querySelectorAll(".js-edit-question").forEach((btn) => {
    btn.addEventListener("click", () =>
      editQuestion((data || []).find((q) => q.id === btn.dataset.id)),
    );
  });
}

function editQuestion(q) {
  if (!q) return;
  editingQuestionId = q.id;
  document.getElementById("subjectInput").value = q.subject || "";
  document.getElementById("typeInput").value = q.question_type;
  document.getElementById("typeInput").dispatchEvent(new Event("change"));
  document.getElementById("questionTextInput").value = q.question_text || "";
  editingQuestionImageUrl = q.image_url || null;
  const imagePreview = document.getElementById("imagePreview");
  imagePreview.hidden = !editingQuestionImageUrl;
  imagePreview.innerHTML = editingQuestionImageUrl
    ? `<img src="${escapeHtml(editingQuestionImageUrl)}" alt="Current question image">`
    : "";
  document.getElementById("explanationInput").value = q.explanation || "";
  document.getElementById("positiveMarksInput").value = q.positive_marks;
  document.getElementById("negativeMarksInput").value = q.negative_marks;
  if (q.question_type === "mcq") {
    (q.options || []).forEach((o) => {
      const field = document.getElementById("opt" + o.id);
      if (field) field.value = o.text || "";
    });
    document.getElementById("correctOptionInput").value =
      q.correct_option || "A";
  } else
    document.getElementById("correctIntegerInput").value =
      q.correct_integer_value ?? "";
  document.getElementById("addQuestionBtn").textContent =
    "Save question changes";
  updateQuestionPreview();
  document
    .getElementById("questionsCard")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteQuestion(id) {
  if (!confirm("Delete this question? This can't be undone.")) return;
  const { error } = await sb.from("questions").delete().eq("id", id);
  if (error) {
    toast(friendlyError(error), "error");
    return;
  }
  toast("Question deleted");
  await loadQuestions();
}

function medalFor(rank) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
}

function rankRowClass(rank) {
  return rank === 1
    ? "rank-gold"
    : rank === 2
      ? "rank-silver"
      : rank === 3
        ? "rank-bronze"
        : "";
}

async function loadStudentResults() {
  const statusEl = document.getElementById("resultDeclarationStatus");
  const actionsEl = document.getElementById("resultDeclarationActions");
  const body = document.getElementById("studentResultsBody");

  const declared = !!currentTest.result_release_at;
  statusEl.innerHTML = declared
    ? `<span class="status-tag published">Results Declared ✓</span>`
    : `<span class="status-tag draft">Results not declared yet</span>`;

  actionsEl.innerHTML = declared
    ? ""
    : `<button class="btn btn-primary btn-sm" id="declareResultsBtn">🏆 Declare Results</button>`;

  const declareBtn = document.getElementById("declareResultsBtn");
  if (declareBtn) {
    declareBtn.onclick = async () => {
      if (
        !confirm(
          "Are you sure you want to declare the results? Rank, percentile and leaderboard will become visible to students.",
        )
      )
        return;
      declareBtn.disabled = true;
      declareBtn.textContent = "Declaring…";
      const { error } = await sb.rpc("admin_declare_results", {
        p_test_id: currentTest.id,
      });
      if (error) {
        toast(friendlyError(error), "error");
        declareBtn.disabled = false;
        declareBtn.textContent = "🏆 Declare Results";
        return;
      }
      currentTest.result_release_at = new Date().toISOString();
      toast(
        "Results declared — students can now see their rank and the leaderboard",
        "success",
      );
      await loadStudentResults();
      await loadLeaderboard();
    };
  }

  const { data, error } = await sb.rpc("admin_get_test_results", {
    p_test_id: currentTest.id,
  });
  if (error) {
    body.innerHTML = `<tr><td colspan="7" class="text-muted">${escapeHtml(friendlyError(error))}</td></tr>`;
    return;
  }
  body.innerHTML = !data?.length
    ? `<tr><td colspan="7" class="text-muted">No attempts yet.</td></tr>`
    : data
        .map(
          (r) => `
    <tr>
      <td>${escapeHtml(r.full_name || "Student")}${
        r.disqualified_at
          ? ` <span class="status-tag" style="background:var(--danger-tint);color:var(--danger);">DQ</span>`
          : ""
      }</td>
      <td><span class="status-tag ${r.status}">${r.status.replace("_", " ")}</span></td>
      <td>${r.total_score}</td>
      <td>${r.correct_count}</td>
      <td>${r.wrong_count}</td>
<td>${r.unanswered_count ?? 0}</td>
      <td>${r.submitted_at ? formatDateTime(r.submitted_at) : "—"}</td>
    </tr>
  `,
        )
        .join("");
}

async function loadLeaderboard() {
  // admin_get_test_leaderboard() is never gated by result_release_at, so
  // admins can review and disqualify suspicious attempts before results are
  // declared — unlike the student-facing get_test_leaderboard().
  const { data, error } = await sb.rpc("admin_get_test_leaderboard", {
    p_test_id: currentTest.id,
  });

  const body = document.getElementById("leaderboardBody");

  if (!body) return;

  if (error) {
    console.error("Leaderboard RPC error:", error);

    body.innerHTML = `
      <tr>
        <td colspan="5" class="text-muted">
          ${escapeHtml(friendlyError(error))}
        </td>
      </tr>
    `;

    return;
  }

  if (!data || data.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="text-muted">
          No submissions yet.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = data
    .map((r) => {
      const student = r.full_name || "Student";
      const attemptId = r.attempt_id || "";

      if (r.disqualified) {
        return `
        <tr class="disqualified-row">
          <td>—</td>
          <td>${escapeHtml(student)} <span class="status-tag" style="background:var(--danger-tint);color:var(--danger);">DQ</span></td>
          <td>${r.total_score}</td>
          <td>—</td>
          <td class="text-muted">Disqualified</td>
        </tr>
      `;
      }

      return `
        <tr>
          <td>#${r.rnk}</td>
          <td>${escapeHtml(student)}</td>
          <td>${r.total_score}</td>
          <td>${Number(r.percentile ?? 0).toFixed(3)}%</td>
          <td>
            <button
              type="button"
              class="btn btn-sm btn-warning js-remove-attempt"
              data-id="${attemptId}"
              ${attemptId ? "" : "disabled"}
            >
              Remove
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  body.querySelectorAll(".js-remove-attempt").forEach((btn) => {
    btn.addEventListener("click", function () {
      const attemptId = this.dataset.id;

      removeAttempt(attemptId, this);
    });
  });
}
async function removeAttempt(id, button) {
  if (!id) {
    toast(
      "Could not identify this attempt. Refresh the leaderboard and try again.",
      "error",
    );

    return;
  }

  const confirmed = confirm(
    "Remove this student from the leaderboard for suspected cheating? Their attempt will be disqualified.",
  );

  if (!confirmed) {
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Removing...";
  }

  try {
    const { data, error } = await sb.rpc("admin_disqualify_attempt", {
      p_attempt_id: id,
    });

    if (error) {
      console.error("admin_disqualify_attempt error:", error);

      if (button) {
        button.disabled = false;
        button.textContent = "Remove";
      }

      toast(friendlyError(error), "error");

      return;
    }

    console.log("Attempt successfully disqualified:", data);

    toast("Student removed from this leaderboard", "success");

    await loadLeaderboard();
  } catch (err) {
    console.error("Unexpected remove attempt error:", err);

    if (button) {
      button.disabled = false;
      button.textContent = "Remove";
    }

    toast("Something went wrong while removing the student.", "error");
  }
}

async function loadReports() {
  const list = document.getElementById("reportsList");
  if (!currentTest) return;
  const { data, error } = await sb
    .from("question_reports")
    .select(
      "id, reason, details, created_at, questions(question_text), profiles(full_name)",
    )
    .eq("test_id", currentTest.id)
    .order("created_at", { ascending: false });
  if (error) {
    list.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error))}</div>`;
    return;
  }
  list.innerHTML = !data?.length
    ? `<div class="empty-state">No question reports yet.</div>`
    : data
        .map(
          (r) => `
    <div class="list-row"><div class="list-row-main"><div class="list-row-title">${escapeHtml(r.reason)}</div>
    <div class="list-row-meta">${escapeHtml(r.profiles?.full_name || "Student")} · ${formatDateTime(r.created_at)}${r.details ? " · " + escapeHtml(r.details) : ""}</div>
    <div class="question-text" style="font-size:13px;">${escapeHtml(r.questions?.question_text || "Question unavailable")}</div></div></div>`,
        )
        .join("");
  renderMath(list);
}

/* =========================================================================
   6. EXAM VIEW
   ========================================================================= */
let attemptId,
  testId,
  testTitle,
  testCategory,
  durationMinutes,
  startedAt,
  totalMarks,
  warningCount;
let candidateName = "";
// The test code being entered, resolved once in enterExamView and used by
// onBegin — the actual attempt (and its clock) is only created once the
// student clicks Begin Test, not the moment this page loads.
let pendingTestId = null;
let questions = [];
let bySubject = {};
let subjects = [];
let currentSubject = null;
let currentLocalIndex = 0;
let timerInterval = null;
let answerSaveQueue = Promise.resolve();
let examStarted = false;
let submitted = false;
let violationModalOpen = false;
let intentionalFullscreenExit = false;
let activeTimingQuestion = null;
let activeTimingStart = null;

/* -------------------------------------------------------------------------
   Time-spent tracking: batched instead of one API call per question.

   Every navigation away from a question used to fire its own
   `add_time_spent` RPC immediately. On a 90-question test that's ~90+
   network calls from navigation alone. Instead, elapsed time is now kept
   locally in `pendingTimeDeltas` (question_id -> accumulated seconds,
   merging repeat visits from "mark for review" automatically) and only
   sent on a periodic timer, plus a handful of safety points — never on
   plain navigation.
   ------------------------------------------------------------------------- */
let pendingTimeDeltas = new Map();
let timeSyncInterval = null;
// Optimistic: if a batched `add_time_spent_batch` RPC exists in this
// Supabase project (see the optional SQL in the accompanying notes), it's
// used automatically — a single request per flush covering every pending
// question, regardless of how many. If it isn't deployed, this flips to
// false on the first failed attempt and every flush falls back to one
// `add_time_spent` call per distinct pending question (still merged
// across revisits, still far fewer calls than before) for the rest of
// this attempt — no broken behaviour either way.
let timeSpentBatchAvailable = true;

// Record elapsed time on the question being navigated away from — purely
// local, no network call here anymore.
function commitActiveTime() {
  if (!activeTimingQuestion || !activeTimingStart) return;
  const q = activeTimingQuestion;
  const elapsed = (Date.now() - activeTimingStart) / 1000;
  activeTimingStart = null;
  if (elapsed < 0.3) return;
  q.time_spent = (q.time_spent || 0) + elapsed;
  pendingTimeDeltas.set(q.id, (pendingTimeDeltas.get(q.id) || 0) + elapsed);
}
function startTimingQuestion(q) {
  activeTimingQuestion = q;
  activeTimingStart = q ? Date.now() : null;
}

// Sends whatever time has accumulated locally. Called periodically (every
// 45s) while a test is running, as a best-effort safety net when the tab
// is hidden or the page is being unloaded, and — awaited — right before
// submission so no meaningful time data is ever lost.
async function flushTimeDeltas({ awaitCompletion = false } = {}) {
  if (!attemptId || pendingTimeDeltas.size === 0) return;
  const entries = Array.from(pendingTimeDeltas.entries()).filter(
    ([, seconds]) => seconds > 0,
  );
  pendingTimeDeltas.clear();
  if (entries.length === 0) return;

  const requeue = () => {
    entries.forEach(([qid, secs]) => {
      pendingTimeDeltas.set(qid, (pendingTimeDeltas.get(qid) || 0) + secs);
    });
  };

  const send = async () => {
    if (timeSpentBatchAvailable) {
      const { error } = await sb.rpc("add_time_spent_batch", {
        p_attempt_id: attemptId,
        p_deltas: entries.map(([question_id, seconds]) => ({
          question_id,
          seconds,
        })),
      });
      if (!error) return;
      const notDeployed =
        error.code === "PGRST202" ||
        /schema cache|does not exist|not found/i.test(error.message || "");
      if (notDeployed) {
        // No batch function in this project — fall back permanently for
        // the rest of this attempt instead of re-failing every 45s.
        timeSpentBatchAvailable = false;
      } else {
        console.error(error);
        requeue();
        return;
      }
    }
    const results = await Promise.allSettled(
      entries.map(([question_id, seconds]) =>
        sb
          .rpc("add_time_spent", {
            p_attempt_id: attemptId,
            p_question_id: question_id,
            p_seconds: seconds,
          })
          .then(({ error }) => {
            if (error) throw error;
          }),
      ),
    );
    // Only requeue the ones that actually failed, so a single flaky
    // request doesn't cost you every other question's progress too.
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const [qid, secs] = entries[i];
        pendingTimeDeltas.set(qid, (pendingTimeDeltas.get(qid) || 0) + secs);
      }
    });
  };

  if (awaitCompletion) {
    await send();
  } else {
    send().catch((e) => console.error(e));
  }
}

function setupExamStaticListeners() {
  document.getElementById("beginBtn").addEventListener("click", onBegin);
  document
    .getElementById("submitTestBtn")
    .addEventListener("click", openSubmitModal);
  document
    .getElementById("cancelSubmitBtn")
    .addEventListener("click", () => closeModal("submitModal"));
  document
    .getElementById("confirmSubmitBtn")
    .addEventListener("click", () => doSubmit("manual"));
  document
    .getElementById("violationOkBtn")
    .addEventListener("click", onViolationAck);
  document
    .getElementById("paletteToggleBtn")
    .addEventListener("click", togglePaletteDrawer);

  document
    .getElementById("paletteBackdrop")
    .addEventListener("click", togglePaletteDrawer);

  document
    .getElementById("paletteCloseBtn")
    .addEventListener("click", togglePaletteDrawer);
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}
function openModal(id) {
  document.getElementById(id).classList.add("open");
}

function showTerminal(title, text, href, label) {
  // Terminal states are also used before the exam shell has finished loading.
  // Reveal it here so an error/previous-attempt message never becomes a blank screen.
  document.getElementById("loadingScreen").style.display = "none";
  document.getElementById("examShell").style.display = "block";
  document.getElementById("terminalTitle").textContent = title;
  document.getElementById("terminalText").textContent = text;
  const btn = document.getElementById("terminalActionBtn");
  btn.href = href;
  btn.textContent = label;
  openModal("terminalModal");
}

// Builds the formal, CBT-style instructions shown before a test starts —
// general rules, navigation, the palette legend, marking scheme, and the
// full-screen / fair-use policy — ending in a declaration checkbox that
// must be ticked before Begin Test can be clicked.
function renderBeginInstructions() {
  const beginText =
    warningCount > 0
      ? "You already have a warning on this attempt from a previous session. One more violation will submit your test automatically."
      : "Please read every section below carefully before you begin.";

  document.getElementById("beginInstructions").innerHTML = `
    <div class="instruction-text"><strong>${escapeHtml(testTitle)}</strong> &nbsp;·&nbsp; ${escapeHtml(testCategory)} &nbsp;·&nbsp; Duration: ${durationMinutes} minutes</div>

    <div class="instruction-section">
      <strong>1. General Instructions</strong>
      <ul>
        <li>The countdown timer in the top bar shows the time remaining to complete the test. When it reaches zero, the test is submitted automatically.</li>
        <li>The timer starts only once you click <strong>Begin Test</strong> below — it does not run while you are reading these instructions.</li>
        <li>The test must be attempted in one continuous sitting. Do not close or refresh this page once you begin.</li>
      </ul>
    </div>

    <div class="instruction-section">
      <strong>2. Navigating a Question</strong>
      <ul>
        <li>Select an option (MCQ) or enter a value (numerical), then click <strong>Save &amp; next</strong> to save your response and move on.</li>
        <li><strong>Mark for review &amp; next</strong> flags a question to revisit, without discarding any answer already saved.</li>
        <li><strong>Clear response</strong> removes your saved answer for the current question.</li>
        <li>Use the question palette on the side to jump to any question, in any order, at any time before submitting.</li>
      </ul>
    </div>

    <div class="instruction-section">
      <strong>3. Question Palette — Legend</strong>
      <div class="palette-legend">
        <div class="legend-item"><span class="legend-swatch" style="background:var(--not-visited-tint);border:1px solid var(--border-strong);"></span>Not visited</div>
        <div class="legend-item"><span class="legend-swatch" style="background:var(--danger);"></span>Not answered</div>
        <div class="legend-item"><span class="legend-swatch" style="background:var(--success);"></span>Answered</div>
        <div class="legend-item"><span class="legend-swatch" style="background:var(--review);"></span>Marked for review</div>
      </div>
    </div>

    <div class="instruction-section">
      <strong>4. Marking Scheme</strong>
      <ul>
        <li>Each question carries its own positive and negative marks, shown alongside it — marks are awarded only for the correct option or value.</li>
        <li>Unattempted questions receive zero marks and no negative marking.</li>
      </ul>
    </div>

    <div class="instruction-warning">
      <strong>5. Full-Screen &amp; Fair-Use Policy</strong>
      <p>This test runs in full-screen mode. Exiting full-screen, switching tabs or apps, or minimising the browser after you begin is recorded as a violation. A second violation submits your test automatically. If you're warned, use <strong>Return to test</strong> to re-enter full-screen and continue.</p>
      <p>${escapeHtml(beginText)}</p>
    </div>

    <label class="declaration-row">
      <input type="checkbox" id="declarationCheckbox">
      <span>I have read and understood the instructions above, and I agree to abide by them.</span>
    </label>
  `;

  const beginBtn = document.getElementById("beginBtn");
  const declarationCheckbox = document.getElementById("declarationCheckbox");
  beginBtn.disabled = true;
  beginBtn.textContent = previousAttemptInProgress
    ? "Resume Test"
    : "Begin Test";
  declarationCheckbox.addEventListener("change", () => {
    beginBtn.disabled = !declarationCheckbox.checked;
  });
}

let previousAttemptInProgress = false;

async function enterExamView() {
  // Reset everything to a clean slate — this view can be entered more than
  // once per page session (e.g. one test after another).
  clearInterval(timerInterval);
  clearInterval(timeSyncInterval);
  pendingTimeDeltas.clear();
  removeAntiCheatListeners();
  ["beginModal", "violationModal", "submitModal", "terminalModal"].forEach(
    closeModal,
  );
  examLocked = false;
  examStarted = false;
  submitted = false;
  violationModalOpen = false;
  intentionalFullscreenExit = false;
  activeTimingQuestion = null;
  activeTimingStart = null;
  questions = [];
  bySubject = {};
  subjects = [];
  currentSubject = null;
  currentLocalIndex = 0;

  document.getElementById("examShell").style.display = "none";
  document.getElementById("loadingScreen").style.display = "flex";

  const {
    data: { session },
  } = await sb.auth.getSession();
  const profile = myProfile || (await getMyProfile());
  candidateName = profile?.full_name || session.user.email;

  const selectedTestId = qs("test");
  if (!selectedTestId) {
    showTerminal(
      "No test selected",
      "Choose a test from your dashboard before starting an exam.",
      "#/dashboard",
      "Back to dashboard",
    );
    document.getElementById("loadingScreen").style.display = "none";
    return;
  }
  pendingTestId = selectedTestId;

  // Look up the test and any existing attempt WITHOUT starting the exam —
  // start_attempt_by_test (which stamps the server-side started_at the countdown
  // is based on) only runs once the student clicks Begin Test, so reading
  // the instructions never eats into the exam clock.
  const [{ data: testMeta, error: testMetaError }, { data: previousAttempt }] =
    await Promise.all([
      sb
        .from("tests")
        .select(
          "id, title, category, duration_minutes, available_from, available_until, is_published",
        )
        .eq("id", selectedTestId)
        .maybeSingle(),
      sb
        .from("test_attempts")
        .select("id, status, disqualified_at, warning_count")
        .eq("user_id", session.user.id)
        .eq("test_id", selectedTestId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (
    testMetaError ||
    !testMeta ||
    !testMeta.is_published ||
    Date.now() < new Date(testMeta.available_from).getTime() ||
    Date.now() >= new Date(testMeta.available_until).getTime()
  ) {
    showTerminal(
      "Test is not live",
      "This test is locked or closed. Return to your dashboard to see the current status.",
      "#/dashboard",
      "Back to dashboard",
    );
    document.getElementById("loadingScreen").style.display = "none";
    return;
  }

  if (previousAttempt?.disqualified_at) {
    showTerminal(
      "Test access removed",
      "An administrator has removed you from this test. Contact your admin if you believe this is a mistake.",
      "#/tests",
      "Back to Tests",
    );
    return;
  }
  if (["submitted", "auto_submitted"].includes(previousAttempt?.status)) {
    showTerminal(
      "Test already attempted",
      "You have already submitted this test. You cannot start it again, but you can view your report.",
      `#/result?attempt=${previousAttempt.id}`,
      "View your report",
    );
    return;
  }

  testTitle = testMeta.title;
  testCategory = testMeta.category;
  durationMinutes = testMeta.duration_minutes;
  warningCount = previousAttempt?.warning_count || 0;
  previousAttemptInProgress = previousAttempt?.status === "in_progress";

  document.getElementById("examTitle").innerHTML =
    `${escapeHtml(testTitle)} ${categoryBadge(testCategory)}`;
  document.getElementById("examCandidate").textContent = candidateName;

  document.getElementById("loadingScreen").style.display = "none";
  document.getElementById("examShell").style.display = "block";

  renderBeginInstructions();
  openModal("beginModal");

  // Timer does NOT start here, and questions are not loaded yet either —
  // both happen only once Begin Test is clicked, in onBegin().
}

async function loadQuestionsAndAnswers() {
  const [{ data: qData, error: qErr }, { data: aData }] = await Promise.all([
    sb.rpc("get_test_questions", { p_attempt_id: attemptId }),
    sb.from("attempt_answers").select("*").eq("attempt_id", attemptId),
  ]);

  if (qErr) {
    showTerminal(
      "Couldn't load questions",
      friendlyError(qErr),
      "#/tests",
      "Back to Tests",
    );
    return;
  }

  const answerMap = {};
  (aData || []).forEach((a) => {
    answerMap[a.question_id] = a;
  });

  questions = (qData || []).map((q) => {
    const existing = answerMap[q.id];
    return {
      ...q,
      status: existing ? existing.status : "not_visited",
      selected_option: existing ? existing.selected_option : null,
      integer_answer: existing ? existing.integer_answer : null,
      time_spent: existing ? Number(existing.time_spent_seconds) || 0 : 0,
    };
  });
}

function buildSubjectStructure() {
  bySubject = {};
  subjects = [];
  questions.forEach((q) => {
    if (!bySubject[q.subject]) {
      bySubject[q.subject] = [];
      subjects.push(q.subject);
    }
    bySubject[q.subject].push(q);
  });
  currentSubject = subjects[0] || null;
  currentLocalIndex = 0;
}

function startTimer() {
  const endTime = new Date(startedAt).getTime() + durationMinutes * 60000;
  const timerEl = document.getElementById("examTimer");

  function tick() {
    const remainingMs = endTime - Date.now();
    const remainingSec = Math.floor(remainingMs / 1000);
    timerEl.textContent = formatCountdown(remainingSec);
    timerEl.classList.toggle("low", remainingSec <= 300);
    if (remainingMs <= 0) {
      clearInterval(timerInterval);
      if (!submitted) doSubmit("time");
    }
  }
  tick();
  timerInterval = setInterval(tick, 1000);
}

function renderSubjectTabs() {
  const wrap = document.getElementById("subjectTabs");
  wrap.innerHTML = subjects
    .map(
      (s) =>
        `<button type="button" data-subject="${escapeHtml(s)}" class="${s === currentSubject ? "active" : ""}">${subjectDot(s)}${escapeHtml(s)}</button>`,
    )
    .join("");
  wrap.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.subject === currentSubject) return;
      commitActiveTime();
      currentSubject = btn.dataset.subject;
      currentLocalIndex = 0;
      renderSubjectTabs();
      renderPalette();
      startTimingQuestion(currentQuestion());
      renderQuestion();
    });
  });
}

function renderPalette() {
  const grid = document.getElementById("paletteGrid");
  const list = bySubject[currentSubject] || [];
  grid.innerHTML = list
    .map(
      (q, i) =>
        `<button type="button" class="palette-btn ${q.status} ${i === currentLocalIndex ? "current" : ""}" data-i="${i}">${i + 1}</button>`,
    )
    .join("");
  grid.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const newIndex = parseInt(btn.dataset.i, 10);
      if (newIndex !== currentLocalIndex) {
        commitActiveTime();
        currentLocalIndex = newIndex;
        startTimingQuestion(currentQuestion());
      }
      renderPalette();
      renderQuestion();
      document.getElementById("palettePanel").classList.remove("open");
      document.getElementById("paletteBackdrop").classList.remove("open");
    });
  });
}

function togglePaletteDrawer() {
  document.getElementById("palettePanel").classList.toggle("open");
  document.getElementById("paletteBackdrop").classList.toggle("open");
}

function currentQuestion() {
  return (bySubject[currentSubject] || [])[currentLocalIndex];
}

function renderQuestion() {
  const q = currentQuestion();
  const card = document.getElementById("questionCard");
  if (!q) {
    card.innerHTML = `<div class="empty-state">No questions in this subject.</div>`;
    return;
  }

  if (q.status === "not_visited") q.status = "not_answered";
  card.style.borderLeft = `4px solid ${subjectColor(q.subject)}`;

  let bodyHtml = "";
  if (q.question_type === "mcq") {
    bodyHtml =
      `<div class="option-list">` +
      q.options
        .map(
          (o) => `
      <div class="option-item ${q.selected_option === o.id ? "selected" : ""}" data-opt="${o.id}">
        <span class="option-letter">${o.id}</span>
        <span class="option-text">${escapeHtml(o.text)}</span>
      </div>
    `,
        )
        .join("") +
      `</div>`;
  } else {
    bodyHtml = `
      <div class="integer-input-wrap">
        <input type="number" step="any" id="integerAnswerInput" value="${q.integer_answer ?? ""}" placeholder="Enter value">
      </div>
    `;
  }

  card.innerHTML = `
    <div class="question-meta">
      <span class="question-number-badge">${subjectDot(q.subject)}${escapeHtml(q.subject)} · Question ${currentLocalIndex + 1}</span>
      <span class="question-marks">+${q.positive_marks} / -${q.negative_marks}</span>
    </div>
    ${questionImageHtml(q.image_url)}
    <div class="question-text">${escapeHtml(q.question_text)}</div>
    <div class="question-tools"><button type="button" class="report-question-icon" id="reportQuestionBtn" aria-label="Report this question" title="Report this question">⚠</button></div>
    ${bodyHtml}
    <div class="exam-actions">
      <div class="exam-actions-left">
        <button class="btn" id="markReviewBtn">Mark for review &amp; next</button>
      </div>
      <div class="exam-actions-right">
        <button class="btn" id="clearResponseBtn">Clear response</button>
        <button class="btn btn-success" id="saveNextBtn">Save &amp; next</button>
      </div>
    </div>
  `;

  if (q.question_type === "mcq") {
    card.querySelectorAll(".option-item").forEach((el) => {
      el.addEventListener("click", () => {
        q.selected_option = el.dataset.opt;
        q.status =
          q.status === "marked" || q.status === "answered_marked"
            ? "answered_marked"
            : "answered";
        card
          .querySelectorAll(".option-item")
          .forEach((o) => o.classList.remove("selected"));
        el.classList.add("selected");
        persistAnswer(q);
        renderPalette();
      });
    });
  } else {
    document
      .getElementById("integerAnswerInput")
      .addEventListener("input", (e) => {
        q.integer_answer =
          e.target.value === "" ? null : parseFloat(e.target.value);
      });
  }

  document
    .getElementById("saveNextBtn")
    .addEventListener("click", () => goSaveNext(q));
  document
    .getElementById("markReviewBtn")
    .addEventListener("click", () => goMarkReview(q));
  document
    .getElementById("clearResponseBtn")
    .addEventListener("click", () => goClear(q));
  document
    .getElementById("reportQuestionBtn")
    .addEventListener("click", () => reportQuestion(q));

  renderMath(card);
  renderPalette();
}

let reportingQuestion = null;
function reportQuestion(q) {
  reportingQuestion = q;
  document.getElementById("reportReason").value = "image not visible";
  document.getElementById("reportDetails").value = "";
  openModal("reportQuestionModal");
}

function hasAnswer(q) {
  return q.question_type === "mcq"
    ? !!q.selected_option
    : q.integer_answer !== null &&
        q.integer_answer !== undefined &&
        q.integer_answer !== "";
}

function persistAnswer(q) {
  // Snapshot the current state and serialize writes. Fast option taps followed
  // by Mark for review can otherwise reach Supabase in the wrong order.
  const payload = {
    p_attempt_id: attemptId,
    p_question_id: q.id,
    p_selected_option: q.question_type === "mcq" ? q.selected_option : null,
    p_integer_answer: q.question_type === "integer" ? q.integer_answer : null,
    p_status: q.status,
  };
  answerSaveQueue = answerSaveQueue
    .catch(() => {})
    .then(async () => {
      const { error } = await sb.rpc("save_answer", payload);
      if (error) throw error;
    });
  return answerSaveQueue
    .then(() => true)
    .catch((error) => {
      toast(friendlyError(error), "error");
      return false;
    });
}

function moveToNext() {
  commitActiveTime();
  const list = bySubject[currentSubject];
  if (currentLocalIndex < list.length - 1) {
    currentLocalIndex++;
  } else {
    const subjIdx = subjects.indexOf(currentSubject);
    if (subjIdx < subjects.length - 1) {
      currentSubject = subjects[subjIdx + 1];
      currentLocalIndex = 0;
      renderSubjectTabs();
    }
  }
  startTimingQuestion(currentQuestion());
  renderQuestion();
}

async function goSaveNext(q) {
  q.status = hasAnswer(q) ? "answered" : "not_answered";
  if (!(await persistAnswer(q))) return;
  moveToNext();
}

async function goMarkReview(q) {
  q.status = hasAnswer(q) ? "answered_marked" : "marked";
  if (!(await persistAnswer(q))) return;
  moveToNext();
}

async function goClear(q) {
  q.selected_option = null;
  q.integer_answer = null;
  q.status = "not_answered";
  if (!(await persistAnswer(q))) return;
  renderQuestion();
}

function openSubmitModal() {
  const counts = {
    not_visited: 0,
    not_answered: 0,
    answered: 0,
    marked: 0,
    answered_marked: 0,
  };
  questions.forEach((q) => {
    counts[q.status] = (counts[q.status] || 0) + 1;
  });
  const grid = document.getElementById("submitSummaryGrid");
  grid.innerHTML = `
    <div class="modal-summary-item"><div class="num">${counts.answered + counts.answered_marked}</div><div class="lbl">Answered</div></div>
    <div class="modal-summary-item"><div class="num">${counts.not_answered}</div><div class="lbl">Not answered</div></div>
    <div class="modal-summary-item"><div class="num">${counts.marked + counts.answered_marked}</div><div class="lbl">Marked for review</div></div>
    <div class="modal-summary-item"><div class="num">${counts.not_visited}</div><div class="lbl">Not visited</div></div>
  `;
  openModal("submitModal");
}

async function doSubmit(reason) {
  if (submitted) return;
  // Save the answer visible on screen before scoring. This makes a direct
  // Submit after selecting an option count without needing Save & next.
  const activeQuestion = currentQuestion();
  if (activeQuestion) {
    if (
      hasAnswer(activeQuestion) &&
      activeQuestion.status !== "marked" &&
      activeQuestion.status !== "answered_marked"
    )
      activeQuestion.status = "answered";
    if (!(await persistAnswer(activeQuestion))) return;
  }
  commitActiveTime();
  submitted = true;
  examLocked = false;
  clearInterval(timerInterval);
  clearInterval(timeSyncInterval);
  closeModal("submitModal");
  removeAntiCheatListeners();

  // Final time sync — awaited, so no time data from the last stretch of
  // the test (since the previous ~45s tick) is lost before scoring.
  await flushTimeDeltas({ awaitCompletion: true });

  const { data, error } = await sb.rpc("submit_attempt", {
    p_attempt_id: attemptId,
    p_auto: reason !== "manual",
  });

  intentionalFullscreenExit = true;
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch (e) {}
  }

  if (error) {
    showTerminal(
      "Couldn't submit",
      friendlyError(error),
      "#/tests",
      "Back to Tests",
    );
    return;
  }

  const reasonText =
    {
      manual: "Your test has been submitted successfully.",
      time: "Time's up — your test was submitted automatically.",
      violation:
        "Your test was submitted automatically after repeated warnings about leaving the exam window.",
    }[reason] || "Your test has been submitted.";

  showFeedbackThenResult(data, reasonText);
}

async function onBegin() {
  myProfile = myProfile || (await getMyProfile());
  const missingProfileFields = [];
  if (!myProfile?.full_name?.trim()) missingProfileFields.push("Full name");
  if (!myProfile?.email?.trim()) missingProfileFields.push("Email");
  if (!myProfile?.class_grade?.trim())
    missingProfileFields.push("Class / grade");
  if (missingProfileFields.length) {
    closeModal("beginModal");
    toast(
      `Complete your profile first: ${missingProfileFields.join(", ")}.`,
      "error",
    );
    navigate("/profile?complete=1");
    return;
  }

  const beginBtn = document.getElementById("beginBtn");
  const originalBtnText = beginBtn.textContent;
  beginBtn.disabled = true;
  beginBtn.textContent = "Starting…";

  // Enter full-screen mode FIRST, synchronously with the click — this has
  // to happen before any await to a server, or the browser no longer
  // considers it part of the user gesture and silently refuses it.
  try {
    if (
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    ) {
      try {
        await document.documentElement.requestFullscreen({
          navigationUI: "hide",
        });
      } catch (_) {
        await document.documentElement.requestFullscreen();
      }
    }
  } catch (_) {
    toast(
      "Full-screen mode was not allowed by this browser. Continue in the largest available window.",
      "error",
    );
  }

  // This is the moment the exam clock actually starts — start_attempt
  // stamps started_at server-side right now, not back when the page loaded.
  const { data, error } = await sb.rpc("start_attempt_by_test", {
    p_test_id: pendingTestId,
  });

  if (error) {
    closeModal("beginModal");
    showTerminal(
      "Can't start this test",
      friendlyError(error),
      "#/tests",
      "Back to Tests",
    );
    return;
  }
  if (!data?.attempt_id) {
    closeModal("beginModal");
    showTerminal(
      "Can't start this test",
      "This test has already been attempted or is no longer available.",
      "#/tests",
      "Back to Tests",
    );
    return;
  }
  if (data.expired) {
    closeModal("beginModal");
    showTerminal(
      "Time's up",
      "Your time for this test had already run out, so it was submitted automatically.",
      `#/result?attempt=${data.attempt_id}`,
      "View your report",
    );
    return;
  }

  attemptId = data.attempt_id;
  testId = data.test_id;
  testTitle = data.title;
  testCategory = data.category;
  durationMinutes = data.duration_minutes;
  startedAt = data.started_at;
  totalMarks = data.total_marks;
  warningCount = data.warning_count || 0;

  const { data: moderation } = await sb
    .from("test_attempts")
    .select("disqualified_at")
    .eq("id", attemptId)
    .maybeSingle();
  if (moderation?.disqualified_at) {
    closeModal("beginModal");
    showTerminal(
      "Test access removed",
      "An administrator has removed you from this test. Contact your admin if you believe this is a mistake.",
      "#/tests",
      "Back to Tests",
    );
    return;
  }

  await loadQuestionsAndAnswers();
  buildSubjectStructure();

  document.getElementById("examCandidate").textContent =
    `${candidateName} · Max marks: ${totalMarks}`;

  beginBtn.disabled = false;
  beginBtn.textContent = originalBtnText;
  closeModal("beginModal");

  examStarted = true;
  examLocked = true;

  // Start timer ONLY after clicking Begin Test
  startTimer();

  // Batched time-sync: accumulates locally, sent roughly every 45s instead
  // of on every question navigation (see flushTimeDeltas above).
  clearInterval(timeSyncInterval);
  timeSyncInterval = setInterval(() => flushTimeDeltas(), 45000);

  addAntiCheatListeners();
  renderSubjectTabs();
  renderPalette();
  renderQuestion();
  startTimingQuestion(currentQuestion());
}

function onVisibilityChange() {
  if (document.hidden && examStarted && !submitted) {
    // Safety net: send whatever time has accumulated so far rather than
    // waiting for the next ~45s tick, in case the tab never comes back.
    flushTimeDeltas();
    triggerViolation();
  }
}
function onFullscreenChange() {
  if (!document.fullscreenElement && examStarted && !submitted) {
    if (intentionalFullscreenExit) {
      intentionalFullscreenExit = false;
      return;
    }
    triggerViolation();
  }
}
function onContextMenu(e) {
  if (examStarted) e.preventDefault();
}
function onCopyCut(e) {
  if (examStarted) e.preventDefault();
}
function onKeyDown(e) {
  if (!examStarted) return;
  const blocked =
    e.key === "F12" ||
    (e.ctrlKey &&
      e.shiftKey &&
      ["I", "J", "C"].includes(e.key.toUpperCase())) ||
    (e.ctrlKey && e.key.toUpperCase() === "U");
  if (blocked) e.preventDefault();
}
function onBeforeUnload(e) {
  if (examStarted && !submitted) {
    flushTimeDeltas();
    e.preventDefault();
    e.returnValue = "";
  }
}
// Fires reliably on mobile when the app is backgrounded or the tab is
// closed, even in cases beforeunload doesn't — another best-effort point
// to get accumulated time off the device before it's potentially lost.
function onPageHide() {
  if (examStarted && !submitted) flushTimeDeltas();
}

function addAntiCheatListeners() {
  document.addEventListener("visibilitychange", onVisibilityChange);
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("copy", onCopyCut);
  document.addEventListener("cut", onCopyCut);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("beforeunload", onBeforeUnload);
  window.addEventListener("pagehide", onPageHide);
}
function removeAntiCheatListeners() {
  document.removeEventListener("visibilitychange", onVisibilityChange);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  document.removeEventListener("contextmenu", onContextMenu);
  document.removeEventListener("copy", onCopyCut);
  document.removeEventListener("cut", onCopyCut);
  document.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("beforeunload", onBeforeUnload);
  window.removeEventListener("pagehide", onPageHide);
}

async function triggerViolation() {
  if (violationModalOpen || submitted) return;
  violationModalOpen = true;

  const { data, error } = await sb.rpc("register_violation", {
    p_attempt_id: attemptId,
  });
  if (error) {
    violationModalOpen = false;
    return;
  }

  if (data.status === "auto_submitted") {
    commitActiveTime();
    submitted = true;
    examLocked = false;
    clearInterval(timerInterval);
    clearInterval(timeSyncInterval);
    removeAntiCheatListeners();
    // Final time sync here too — this path bypasses doSubmit() entirely
    // since the server already auto-submitted as part of register_violation.
    await flushTimeDeltas({ awaitCompletion: true });
    intentionalFullscreenExit = true;
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (e) {}
    }
    showTerminal(
      "Test auto-submitted",
      "Your test was submitted automatically after repeated warnings about leaving the exam window.",
      `#/result?attempt=${attemptId}`,
      "View your report",
    );
    return;
  }

  document.getElementById("violationText").textContent =
    `This is warning ${data.warning_count} of 2. Leaving the test window, exiting full-screen, or switching tabs again will automatically submit your test.`;
  openModal("violationModal");
}

async function onViolationAck() {
  closeModal("violationModal");
  violationModalOpen = false;

  // Re-enter full-screen before   continuing
  try {
    if (
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    ) {
      try {
        await document.documentElement.requestFullscreen({
          navigationUI: "hide",
        });
      } catch (_) {
        await document.documentElement.requestFullscreen();
      }
    }
  } catch (_) {
    toast("Please enter full-screen mode to continue the test.", "error");
  }
}
/* =========================================================================
   7. RESULT VIEW
   ========================================================================= */
function renderReviewQuestion(r) {
  let bodyHtml = "";
  if (r.question_type === "mcq") {
    bodyHtml =
      `<div class="option-list">` +
      (r.options || [])
        .map((o) => {
          const isCorrect = o.id === r.correct_option;
          const isPicked = o.id === r.selected_option;
          const cls = isCorrect
            ? "review-correct"
            : isPicked
              ? "review-wrong"
              : "";
          const tag =
            isCorrect && isPicked
              ? `<span class="status-tag published" style="margin-left:auto;">Your answer · Correct</span>`
              : isCorrect
                ? `<span class="status-tag published" style="margin-left:auto;">Correct answer</span>`
                : isPicked
                  ? `<span class="status-tag" style="margin-left:auto;background:var(--danger-tint);color:var(--danger);">Your answer · Wrong</span>`
                  : "";
          return `
        <div class="option-item ${cls}">
          <span class="option-letter">${o.id}</span>
          <span class="option-text">${escapeHtml(o.text)}</span>
          ${tag}
        </div>
      `;
        })
        .join("") +
      `</div>`;
  } else {
    bodyHtml = `
      <p style="font-size:14px;">
        <span style="color:${r.is_correct ? "var(--success)" : "var(--danger)"};font-weight:650;">Your answer: ${r.integer_answer ?? "—"}</span>
        &nbsp;·&nbsp;
        <span style="color:var(--success);font-weight:650;">Correct answer: ${r.correct_integer_value}</span>
      </p>
    `;
  }
  return `
    <div class="card" style="box-shadow:none;">
      <div class="review-question-heading"><div class="list-row-meta">${subjectDot(r.subject)}${escapeHtml(r.subject)} · Question ${r.question_order || ""}</div><span class="review-result-pill ${r.is_correct === true ? "review-result-correct" : r.is_correct === false ? "review-result-wrong" : "review-result-skipped"}">${r.is_correct === true ? "Correct" : r.is_correct === false ? "Wrong" : "Unattempted"} · ${r.marks_obtained} marks</span></div>
      ${questionImageHtml(r.image_url)}
      <div class="question-text" style="font-size:14.5px;margin-bottom:12px;">${escapeHtml(r.question_text)}</div>
      ${bodyHtml}
      ${r.explanation ? `<div class="explanation-box mt-8">${escapeHtml(r.explanation)}</div>` : ""}
    </div>
  `;
}

function renderReportAnalysis(report, subjectRows, review) {
  const totalMax = subjectRows.reduce(
    (sum, row) => sum + Number(row.total || 0),
    0,
  );
  const scorePct =
    totalMax > 0
      ? Math.max(
          0,
          Math.min(100, (Number(report.total_score || 0) / totalMax) * 100),
        )
      : 0;
  const attempted = review.filter(
    (row) => row.is_correct !== null && row.is_correct !== undefined,
  ).length;
  const correct = review.filter((row) => row.is_correct === true).length;
  const accuracy = attempted ? (correct / attempted) * 100 : 0;
  return `<section class="report-analysis-grid"><div class="card report-chart-card"><div class="section-title"><h2>Test performance</h2><span class="text-muted">Score and accuracy</span></div><div class="report-radials">${renderRadialProgress(scorePct, { size: 132, stroke: 10, color: "var(--brand)", subLabel: "Score" })}${renderRadialProgress(accuracy, { size: 132, stroke: 10, color: "var(--success)", subLabel: "Accuracy" })}</div></div><div class="card report-chart-card"><div class="section-title"><h2>Subject breakdown</h2><span class="text-muted">Marks earned</span></div><div class="subject-performance-list">${subjectRows.map((row) => `<div class="subject-performance-row"><div class="subject-performance-label"><span>${subjectDot(row.subject)}${escapeHtml(row.subject)}</span><strong>${row.obtained} / ${row.total}</strong></div>${analyticsBar(Number(row.obtained), Number(row.total), subjectColor(row.subject))}</div>`).join("")}</div></div></section>`;
}

let reviewQuestions = [];
let reviewBySubject = {};
let reviewSubjects = [];
let reviewSubject = null;
let reviewIndex = 0;

function reviewState(question) {
  if (question.is_correct === true) return "correct";
  if (question.is_correct === false) return "wrong";
  return "unattempted";
}

function renderReviewPalette() {
  const grid = document.getElementById("reviewPaletteGrid");
  const list = reviewBySubject[reviewSubject] || [];
  grid.innerHTML = list
    .map(
      (question, index) =>
        `<button type="button" class="palette-btn review-palette-btn ${reviewState(question)} ${index === reviewIndex ? "current" : ""}" data-review-index="${index}">${index + 1}</button>`,
    )
    .join("");
  grid.querySelectorAll("button").forEach((button) =>
    button.addEventListener("click", () => {
      reviewIndex = Number(button.dataset.reviewIndex);
      renderReviewQuestionCard();
    }),
  );
}

function renderReviewQuestionCard() {
  const question = (reviewBySubject[reviewSubject] || [])[reviewIndex];
  const card = document.getElementById("reviewQuestionCard");
  if (!question) {
    card.innerHTML = `<div class="empty-state">No question selected.</div>`;
    return;
  }
  const options = (question.options || [])
    .map((option) => {
      const correct = option.id === question.correct_option;
      const selected = option.id === question.selected_option;
      const stateClass = correct
        ? "review-correct"
        : selected
          ? "review-wrong"
          : "";
      const label =
        correct && selected
          ? "Your answer · Correct"
          : correct
            ? "Correct answer"
            : selected
              ? "Your answer · Wrong"
              : "";
      return `<div class="option-item ${stateClass}"><span class="option-letter">${escapeHtml(option.id)}</span><span class="option-text">${escapeHtml(option.text)}</span>${label ? `<span class="review-option-label">${label}</span>` : ""}</div>`;
    })
    .join("");
  const integerAnswer =
    question.integer_answer == null ? "—" : question.integer_answer;
  const correctInteger =
    question.correct_integer_value == null
      ? "—"
      : question.correct_integer_value;
  card.innerHTML = `<div class="review-question-heading"><div class="question-number-badge">${subjectDot(question.subject)}${escapeHtml(question.subject)} · Question ${reviewQuestions.indexOf(question) + 1}</div><span class="review-result-pill ${reviewState(question) === "correct" ? "review-result-correct" : reviewState(question) === "wrong" ? "review-result-wrong" : "review-result-skipped"}">${reviewState(question)} · ${question.marks_obtained || 0} marks</span></div>${questionImageHtml(question.image_url)}<div class="question-text">${escapeHtml(question.question_text)}</div>${question.question_type === "mcq" ? `<div class="option-list">${options}</div>` : `<div class="review-integer-answer"><span class="${question.is_correct ? "answer-good" : "answer-bad"}">Your answer: ${escapeHtml(String(integerAnswer))}</span><span class="answer-good">Correct answer: ${escapeHtml(String(correctInteger))}</span></div>`}${question.explanation ? `<div class="explanation-box mt-8">${escapeHtml(question.explanation)}</div>` : ""}`;
  document.getElementById("reviewProgressLabel").textContent =
    `${reviewQuestions.indexOf(question) + 1} of ${reviewQuestions.length}`;
  document.getElementById("reviewPreviousBtn").disabled = reviewIndex === 0;
  document.getElementById("reviewNextBtn").disabled =
    reviewIndex === (reviewBySubject[reviewSubject] || []).length - 1 &&
    reviewSubjects.indexOf(reviewSubject) === reviewSubjects.length - 1;
  renderReviewPalette();
  renderMath(card);
}

async function enterReviewView() {
  const attemptId = qs("attempt");
  const card = document.getElementById("reviewQuestionCard");
  if (!attemptId) {
    card.innerHTML = `<div class="error-box">No attempt was selected.</div>`;
    return;
  }
  card.innerHTML = `<div class="empty-state">Loading answer review…</div>`;
  const { data: report, error } = await sb.rpc("get_full_report", {
    p_attempt_id: attemptId,
  });
  if (error || !report) {
    card.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error))}</div>`;
    return;
  }
  reviewQuestions = report.review || [];
  reviewBySubject = {};
  reviewSubjects = [];
  reviewQuestions.forEach((question) => {
    if (!reviewBySubject[question.subject]) {
      reviewBySubject[question.subject] = [];
      reviewSubjects.push(question.subject);
    }
    reviewBySubject[question.subject].push(question);
  });
  reviewSubject = reviewSubjects[0] || null;
  reviewIndex = 0;
  document.getElementById("reviewTitle").textContent = report.test_title;
  document.getElementById("reviewCandidate").textContent =
    `${report.full_name || "Student"} · Read-only answer review`;
  document.getElementById("reviewBackBtn").href =
    `#/result?attempt=${encodeURIComponent(attemptId)}`;
  const tabs = document.getElementById("reviewSubjectTabs");
  tabs.innerHTML = reviewSubjects
    .map(
      (subject) =>
        `<button type="button" class="${subject === reviewSubject ? "active" : ""}" data-review-subject="${escapeHtml(subject)}">${subjectDot(subject)}${escapeHtml(subject)}</button>`,
    )
    .join("");
  tabs.querySelectorAll("button").forEach((button) =>
    button.addEventListener("click", () => {
      reviewSubject = button.dataset.reviewSubject;
      reviewIndex = 0;
      tabs
        .querySelectorAll("button")
        .forEach((item) => item.classList.toggle("active", item === button));
      renderReviewQuestionCard();
    }),
  );
  document.getElementById("reviewPreviousBtn").onclick = () => {
    if (reviewIndex > 0) reviewIndex -= 1;
    else if (reviewSubjects.indexOf(reviewSubject) > 0) {
      reviewSubject = reviewSubjects[reviewSubjects.indexOf(reviewSubject) - 1];
      reviewIndex = (reviewBySubject[reviewSubject] || []).length - 1;
      tabs
        .querySelectorAll("button")
        .forEach((item) =>
          item.classList.toggle(
            "active",
            item.dataset.reviewSubject === reviewSubject,
          ),
        );
    }
    renderReviewQuestionCard();
  };
  document.getElementById("reviewNextBtn").onclick = () => {
    const currentList = reviewBySubject[reviewSubject] || [];
    if (reviewIndex < currentList.length - 1) reviewIndex += 1;
    else if (
      reviewSubjects.indexOf(reviewSubject) <
      reviewSubjects.length - 1
    ) {
      reviewSubject = reviewSubjects[reviewSubjects.indexOf(reviewSubject) + 1];
      reviewIndex = 0;
      tabs
        .querySelectorAll("button")
        .forEach((item) =>
          item.classList.toggle(
            "active",
            item.dataset.reviewSubject === reviewSubject,
          ),
        );
    }
    renderReviewQuestionCard();
  };
  renderReviewQuestionCard();
}

async function enterResultView() {
  const content = document.getElementById("resultContent");
  content.innerHTML = `<div class="empty-state">Loading your report…</div>`;

  const attemptIdParam = qs("attempt");
  if (!attemptIdParam) {
    content.innerHTML = `<div class="error-box">No test attempt was specified.</div>`;
    return;
  }

  const { data: report, error } = await sb.rpc("get_full_report", {
    p_attempt_id: attemptIdParam,
  });

  if (error || !report) {
    content.innerHTML = `<div class="error-box">Couldn't load this report. ${escapeHtml(friendlyError(error))}</div>`;
    return;
  }

  if (report.status === "in_progress") {
    content.innerHTML = `
      <div class="card">
        <h2 style="font-size:16px;">Still in progress</h2>
        <p class="text-muted">This test hasn't been submitted yet.</p>
        <a class="btn btn-primary" href="#/exam?test=${report.test_id}">Resume test</a>
      </div>
    `;
    return;
  }

  // Score is always available immediately after submission. Rank,
  // percentile and the leaderboard stay locked until the admin declares
  // results — get_full_report simply returns null/empty for those until
  // then, rather than erroring, so `declared` is derived from that.
  const declared = report.rank !== null && report.rank !== undefined;
  const subjectRows = report.subject_rows || [];
  const review = report.review || [];
  const board = report.board || [];
  const allAnswers = review;
  const totalMax = subjectRows.reduce((s, r) => s + Number(r.total), 0);
  const timeTakenSec = report.submitted_at
    ? (new Date(report.submitted_at) - new Date(report.started_at)) / 1000
    : null;

  const viewingSomeoneElse = !report.is_owner;
  const viewerInTop10 = board.some((b) => b.user_id === report.viewer_user_id);
  const showYourResult = declared && report.viewer_rank && !viewerInTop10;

  content.innerHTML = `
    <div class="card">
      <div class="section-title">
        <h2 style="font-size:17px;">${escapeHtml(report.test_title)} ${categoryBadge(report.category)}</h2>
        <span class="status-tag ${report.status}">${report.status.replace("_", " ")}</span>
      </div>
      <p class="text-muted" style="font-size:13px;">
        ${viewingSomeoneElse ? `Top-3 public report · ${escapeHtml(report.full_name || "Student")} · ` : ""}Submitted ${formatDateTime(report.submitted_at)}
      </p>
    </div>

    ${
      !declared
        ? `<div class="locked-banner">Your score is available. Rank and percentile will be announced when the admin declares the results.</div>`
        : ""
    }

    <div class="stat-grid">
      <div class="stat-card"><div class="val">${report.total_score} / ${totalMax}</div><div class="lbl">Score</div></div>
      <div class="stat-card"><div class="val">${declared ? `${medalFor(report.rank)}#${report.rank}` : "🔒"}</div><div class="lbl">Rank${declared ? " of " + report.total_participants : ""}</div></div>
      <div class="stat-card"><div class="val">${declared ? report.percentile + "%" : "🔒"}</div><div class="lbl">Percentile</div></div>
      <div class="stat-card"><div class="val">${formatDurationPrecise(timeTakenSec)}</div><div class="lbl">Time taken</div></div>
    </div>

    ${report.is_owner || report.is_public_top3 ? renderReportAnalysis(report, subjectRows, review) : ""}

    <div class="card">
      <h2 style="font-size:16px;">Subject-wise performance</h2>
      <div class="table-scroll">
        <table class="report-table">
          <thead><tr><th>Subject</th><th>Correct</th><th>Wrong</th><th>Unattempted</th><th>Accuracy</th><th>Time taken</th><th>Marks</th><th></th></tr></thead>
          <tbody>
            ${subjectRows
              .map((r) => {
                const attempted =
                  Number(r.correct_count) + Number(r.wrong_count);
                const accuracy =
                  attempted > 0
                    ? Math.round((Number(r.correct_count) / attempted) * 100) +
                      "%"
                    : "—";
                return `
              <tr>
                <td>${subjectDot(r.subject)}${escapeHtml(r.subject)}</td>
                <td>${r.correct_count}</td>
                <td>${r.wrong_count}</td>
                <td>${r.unattempted}</td>
                <td>${accuracy}</td>
                <td>${formatDurationPrecise(r.time_spent_seconds)}</td>
                <td>${r.obtained} / ${r.total}</td>
                <td><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, (r.obtained / r.total) * 100))}%"></div></div></td>
              </tr>
            `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    ${report.is_owner || report.is_public_top3 ? `<div class="card report-review-cta"><div><span class="eyebrow-label">Detailed review</span><h2>Review every answer</h2><p class="text-muted">Open the exam-style review to see selected answers, correct answers, explanations, and question status.</p></div><a class="btn btn-primary" href="#/review?attempt=${encodeURIComponent(attemptIdParam)}">Review answers</a></div>` : ""}

    <div class="card">
      <h2 style="font-size:16px;">Leaderboard</h2>
      ${
        !declared
          ? `<div class="empty-state">Rank and percentile will be announced when the admin declares the results.</div>`
          : board.length === 0
            ? `<div class="empty-state">No submissions yet.</div>`
            : `
      <div class="table-scroll">
        <table class="report-table">
          <thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Percentile</th></tr></thead>
          <tbody>
            ${board
              .map(
                (r) => `
              <tr class="${rankRowClass(r.rnk)} ${r.user_id === report.viewer_user_id ? "me" : ""}">
                <td>${medalFor(r.rnk)}#${r.rnk}</td><td>${escapeHtml(r.full_name || "Student")}${r.user_id === report.viewer_user_id ? ' <span class="you-badge">YOU</span>' : ""}</td>
                <td>${r.total_score}</td><td>${r.percentile}%</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${
        showYourResult
          ? `
      <div class="card your-rank-card" style="margin-top:12px;">
        <h2 style="font-size:14px;">Your Result</h2>
        <p style="font-size:14px;">Rank: #${report.viewer_rank} &nbsp;·&nbsp; Score: ${report.viewer_score} &nbsp;·&nbsp; Percentile: ${report.viewer_percentile}%</p>
        <a class="btn btn-sm btn-primary" href="#/result?attempt=${report.viewer_attempt_id}">View My Report</a>
      </div>`
          : ""
      }
      `
      }
    </div>
  `;
  renderMath(content);
  animateRadialProgress(content);
}

/* =========================================================================
   BULK QUESTION IMPORT
   The format is deliberately line-oriented: field values continue until the
   next known label, so pasted paragraphs and displayed LaTeX stay intact.
   ========================================================================= */
const BULK_IMPORT_FIELDS = [
  "QUESTION",
  "OPTION_A",
  "OPTION_B",
  "OPTION_C",
  "OPTION_D",
  "ANSWER",
  "EXPLANATION",
  "TYPE",
  "SUBJECT",
  "CHAPTER",
];
let bulkQuestions = [];

function parseBulkQuestions(source) {
  const text = String(source || "").replace(/\r\n?/g, "\n");
  const headers = [...text.matchAll(/^\s*\[QUESTION(?:\s+(\d+))?\]\s*$/gim)];
  if (!headers.length) {
    throw new Error(
      "No [QUESTION 1] sections were found. Check the required format.",
    );
  }

  return headers.map((header, index) => {
    const section = text
      .slice(
        header.index + header[0].length,
        headers[index + 1]?.index ?? text.length,
      )
      .trim();
    const matches = [
      ...section.matchAll(
        new RegExp(
          `^\\s*(${BULK_IMPORT_FIELDS.join("|")})\\s*:\\s*(.*)$`,
          "gim",
        ),
      ),
    ];
    const values = {};
    matches.forEach((match, fieldIndex) => {
      const end = matches[fieldIndex + 1]?.index ?? section.length;
      const continuation = section.slice(match.index + match[0].length, end);
      values[match[1].toUpperCase()] = [match[2], continuation].join("").trim();
    });
    return {
      sourceNumber: header[1] || String(index + 1),
      question: values.QUESTION || "",
      optionA: values.OPTION_A || "",
      optionB: values.OPTION_B || "",
      optionC: values.OPTION_C || "",
      optionD: values.OPTION_D || "",
      answer: values.ANSWER || "",
      explanation: values.EXPLANATION || "",
      type: values.TYPE || "MCQ",
      subject: values.SUBJECT || "",
      chapter: values.CHAPTER || "",
      errors: [],
      removed: false,
    };
  });
}

function validateBulkQuestion(question) {
  const errors = [];
  const type = String(question.type)
    .trim()
    .toLowerCase()
    .replace(/[\s/_-]+/g, "");
  if (!question.question.trim()) errors.push("Question text is missing.");
  if (!question.subject.trim()) errors.push("Subject is missing.");
  if (!["mcq", "integer", "numerical"].includes(type)) {
    errors.push("TYPE must be MCQ or Integer/Numerical.");
  }
  if (type === "mcq") {
    const answer = question.answer.trim().toUpperCase();
    ["A", "B", "C", "D"].forEach((letter) => {
      if (!question[`option${letter}`].trim())
        errors.push(`OPTION_${letter} is missing.`);
    });
    if (!["A", "B", "C", "D"].includes(answer))
      errors.push("ANSWER must be A, B, C, or D for MCQ.");
  } else if (type === "integer" || type === "numerical") {
    if (
      !question.answer.trim() ||
      !Number.isFinite(Number(question.answer.trim()))
    ) {
      errors.push("ANSWER must be a number for Integer/Numerical questions.");
    }
  }
  question.errors = errors;
  return errors;
}

function bulkQuestionField(question, field, label, multiline = true) {
  const value = question[field] || "";
  const invalid = question.errors.some((error) =>
    error.toLowerCase().includes(label.toLowerCase().replace("_", " ")),
  );
  const tag = multiline ? "textarea" : "input";
  const extra = multiline ? " rows=3" : "";
  const valueAttribute = multiline ? "" : ` value="${escapeHtml(value)}"`;
  const inputHtml = multiline
    ? `<textarea data-bulk-index="${bulkQuestions.indexOf(question)}" data-bulk-field="${field}"${extra}>${escapeHtml(value)}</textarea>`
    : `<input data-bulk-index="${bulkQuestions.indexOf(question)}" data-bulk-field="${field}"${valueAttribute}>`;
  return `<label class="bulk-field ${invalid ? "bulk-field-invalid" : ""}">${label}${invalid ? `<span class="bulk-field-error">Check this field</span>` : ""}${inputHtml}</label>`;
}

function renderBulkQuestionPreview(question, index) {
  validateBulkQuestion(question);
  const type = question.type
    .trim()
    .toLowerCase()
    .replace(/[\s/_-]+/g, "");
  const renderedOptions =
    type === "mcq"
      ? ["A", "B", "C", "D"]
          .map(
            (letter) =>
              `<div class="bulk-render-option"><strong>${letter}</strong><span>${escapeHtml(question[`option${letter}`])}</span></div>`,
          )
          .join("")
      : `<div class="bulk-render-answer">Correct numerical answer: <strong>${escapeHtml(question.answer)}</strong></div>`;
  return `
    <article class="bulk-question-card ${question.errors.length ? "has-errors" : "is-valid"}" data-bulk-card="${index}">
      <div class="bulk-question-heading">
        <div><span class="badge ${question.errors.length ? "badge-live" : "badge-brand"}">${question.errors.length ? `${question.errors.length} error${question.errors.length === 1 ? "" : "s"}` : "Valid"}</span><strong>Question ${escapeHtml(question.sourceNumber || String(index + 1))}</strong></div>
        <button type="button" class="btn btn-sm btn-danger js-remove-bulk-question" data-bulk-remove="${index}">Remove</button>
      </div>
      ${
        question.errors.length
          ? `<div class="bulk-question-error-list">${question.errors
              .map(escapeHtml)
              .map((error) => `<div>${error}</div>`)
              .join("")}</div>`
          : ""
      }
      <div class="bulk-question-fields">
        ${bulkQuestionField(question, "question", "Question")}
        ${bulkQuestionField(question, "optionA", "Option A")}
        ${bulkQuestionField(question, "optionB", "Option B")}
        ${bulkQuestionField(question, "optionC", "Option C")}
        ${bulkQuestionField(question, "optionD", "Option D")}
        ${bulkQuestionField(question, "answer", "Answer", false)}
        ${bulkQuestionField(question, "explanation", "Explanation")}
        ${bulkQuestionField(question, "subject", "Subject", false)}
        ${bulkQuestionField(question, "chapter", "Chapter", false)}
        <label class="bulk-field">Type<select data-bulk-index="${index}" data-bulk-field="type"><option value="MCQ" ${type === "mcq" ? "selected" : ""}>MCQ</option><option value="INTEGER" ${["integer", "numerical"].includes(type) ? "selected" : ""}>Integer / Numerical</option></select></label>
      </div>
      <div class="bulk-rendered-preview"><div class="preview-field-label">Rendered preview</div><div class="question-text">${escapeHtml(question.question)}</div>${renderedOptions}${question.explanation ? `<div class="explanation-box">${escapeHtml(question.explanation)}</div>` : ""}</div>
    </article>`;
}

function renderBulkImportPreview() {
  const preview = document.getElementById("bulkImportPreview");
  const active = bulkQuestions.filter((question) => !question.removed);
  active.forEach(validateBulkQuestion);
  const validCount = active.filter(
    (question) => !question.errors.length,
  ).length;
  document.getElementById("bulkImportSummary").textContent =
    `${validCount} valid / ${active.length} questions`;
  document.getElementById("importAllValidQuestionsBtn").disabled =
    validCount === 0;
  preview.innerHTML = active.length
    ? active
        .map((question) =>
          renderBulkQuestionPreview(question, bulkQuestions.indexOf(question)),
        )
        .join("")
    : `<div class="empty-state">All parsed questions were removed.</div>`;
  const errors = document.getElementById("bulkImportErrors");
  errors.style.display = active.some((question) => question.errors.length)
    ? "block"
    : "none";
  errors.textContent = active.some((question) => question.errors.length)
    ? "Fix the highlighted questions before importing. Invalid questions will be skipped."
    : "";
  preview.querySelectorAll("[data-bulk-field]").forEach((field) => {
    field.addEventListener("input", updateBulkQuestionFromField);
    field.addEventListener("change", updateBulkQuestionFromField);
  });
  preview.querySelectorAll("[data-bulk-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      bulkQuestions[Number(button.dataset.bulkRemove)].removed = true;
      renderBulkImportPreview();
    });
  });
  renderMath(preview);
}

function updateBulkQuestionFromField(event) {
  const field = event.currentTarget;
  const question = bulkQuestions[Number(field.dataset.bulkIndex)];
  if (!question) return;
  question[field.dataset.bulkField] = field.value;
  renderBulkImportPreview();
}

async function loadBulkImportTests() {
  const select = document.getElementById("bulkTestSelect");
  const { data, error } = await sb
    .from("tests")
    .select("id,title,test_code,is_published")
    .order("created_at", { ascending: false });
  if (error) {
    select.innerHTML = `<option value="">${escapeHtml(friendlyError(error))}</option>`;
    return;
  }
  select.innerHTML =
    `<option value="">Select an existing test…</option>` +
    (data || [])
      .map(
        (test) =>
          `<option value="${test.id}">${escapeHtml(test.title)} (${escapeHtml(test.test_code)})${test.is_published ? "" : " — draft"}</option>`,
      )
      .join("");
}

async function importBulkQuestions() {
  const testId = document.getElementById("bulkTestSelect").value;
  const result = document.getElementById("bulkImportResult");
  const valid = bulkQuestions.filter(
    (question) =>
      !question.removed && validateBulkQuestion(question).length === 0,
  );
  if (!testId) {
    toast("Select a test first.", "error");
    return;
  }
  if (!valid.length) {
    toast("There are no valid questions to import.", "error");
    return;
  }
  const button = document.getElementById("importAllValidQuestionsBtn");
  button.disabled = true;
  result.textContent = "Importing…";
  const { data: existing, error: existingError } = await sb
    .from("questions")
    .select("question_order")
    .eq("test_id", testId)
    .order("question_order", { ascending: false })
    .limit(1);
  if (existingError) {
    button.disabled = false;
    result.textContent = "";
    toast(friendlyError(existingError), "error");
    return;
  }
  const nextOrder =
    existing?.[0]?.question_order == null
      ? 0
      : Number(existing[0].question_order) + 1;
  const rows = valid.map((question, index) => {
    const type = question.type
      .trim()
      .toLowerCase()
      .replace(/[\s/_-]+/g, "");
    const isMcq = type === "mcq";
    const row = {
      test_id: testId,
      question_order: nextOrder + index,
      subject: question.subject.trim(),
      question_type: isMcq ? "mcq" : "integer",
      question_text: question.question.trim(),
      options: isMcq
        ? ["A", "B", "C", "D"].map((id) => ({
            id,
            text: question[`option${id}`].trim(),
          }))
        : null,
      correct_option: isMcq ? question.answer.trim().toUpperCase() : null,
      correct_integer_value: isMcq ? null : Number(question.answer.trim()),
      explanation: question.explanation.trim() || null,
      positive_marks: 4,
      negative_marks: 1,
      chapter: question.chapter.trim() || null,
    };
    return row;
  });
  let response = await sb.from("questions").insert(rows);
  if (response.error && /chapter|column/i.test(response.error.message || "")) {
    response = await sb
      .from("questions")
      .insert(rows.map(({ chapter, ...row }) => row));
  }
  button.disabled = false;
  if (response.error) {
    result.textContent = "";
    toast(friendlyError(response.error), "error");
    return;
  }
  result.textContent = `${valid.length} question${valid.length === 1 ? "" : "s"} imported successfully.`;
  toast(`${valid.length} questions imported`, "success");
  bulkQuestions = [];
  document.getElementById("bulkImportPreviewCard").style.display = "none";
}

async function enterBulkImportView() {
  myProfile = myProfile || (await getMyProfile());
  const allowed = myProfile?.role === "admin";
  document.getElementById("bulkImportNotAdmin").style.display = allowed
    ? "none"
    : "block";
  document.getElementById("bulkImportContent").style.display = allowed
    ? "block"
    : "none";
  if (allowed) await loadBulkImportTests();
}

function setupBulkImportListeners() {
  document
    .getElementById("parseBulkQuestionsBtn")
    .addEventListener("click", () => {
      try {
        bulkQuestions = parseBulkQuestions(
          document.getElementById("bulkImportText").value,
        );
        document.getElementById("bulkImportPreviewCard").style.display =
          "block";
        document.getElementById("bulkImportParseStatus").textContent =
          `${bulkQuestions.length} question${bulkQuestions.length === 1 ? "" : "s"} detected.`;
        renderBulkImportPreview();
      } catch (error) {
        document.getElementById("bulkImportPreviewCard").style.display = "none";
        document.getElementById("bulkImportParseStatus").textContent = "";
        toast(error.message, "error");
      }
    });
  document
    .getElementById("clearBulkQuestionsBtn")
    .addEventListener("click", () => {
      bulkQuestions = [];
      document.getElementById("bulkImportText").value = "";
      document.getElementById("bulkImportPreviewCard").style.display = "none";
      document.getElementById("bulkImportParseStatus").textContent = "";
    });
  document
    .getElementById("bulkImportFile")
    .addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (file)
        document.getElementById("bulkImportText").value = await file.text();
    });
  document
    .getElementById("importAllValidQuestionsBtn")
    .addEventListener("click", importBulkQuestions);
}

/* =========================================================================
   APP SHELL — desktop sidebar + mobile bottom nav (Part 1 of the redesign)
   ========================================================================= */

// Builds an SVG ring for any "percent complete" style stat (score, accuracy,
// time-left, etc). Returns an HTML string; callers set it via innerHTML.
// value: 0-100. size/stroke in px. color: any CSS color or var(--token).
function renderRadialProgress(
  value,
  {
    size = 120,
    stroke = 10,
    color = "var(--brand)",
    numLabel = null,
    subLabel = "",
  } = {},
) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const label = numLabel === null ? `${Math.round(pct)}%` : numLabel;
  return `
    <div class="radial-progress" style="--rp-size:${size}px;--rp-color:${color};">
      <svg viewBox="0 0 ${size} ${size}">
        <circle class="radial-progress-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"></circle>
        <circle class="radial-progress-value" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
          stroke-dasharray="${c}" stroke-dashoffset="${c}"
          data-target-offset="${offset}"></circle>
      </svg>
      <div class="radial-progress-label">
        <span class="radial-progress-num">${label}</span>
        ${subLabel ? `<span class="radial-progress-sub">${subLabel}</span>` : ""}
      </div>
    </div>
  `;
}

// Animates a just-inserted radial-progress ring from empty to its target.
function animateRadialProgress(container) {
  container.querySelectorAll(".radial-progress-value").forEach((circle) => {
    const target = circle.getAttribute("data-target-offset");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        circle.style.strokeDashoffset = target;
      });
    });
  });
}

// Analytics view is a scaffold in Part 1 — this just proves the radial
// progress component works. Explicitly labelled as a design preview, not
// real user data.
function renderAnalyticsDemo() {
  const row = document.getElementById("analyticsDemoRow");
  if (!row || row.dataset.rendered) return;
  row.dataset.rendered = "1";
  row.innerHTML =
    renderRadialProgress(72, {
      size: 108,
      stroke: 9,
      color: "var(--brand)",
      subLabel: "Accuracy",
    }) +
    renderRadialProgress(88, {
      size: 108,
      stroke: 9,
      color: "var(--success)",
      subLabel: "Answered",
    }) +
    renderRadialProgress(46, {
      size: 108,
      stroke: 9,
      color: "var(--review)",
      subLabel: "Time used",
    });
  animateRadialProgress(row);
}

function analyticsBar(value, max, color) {
  const width =
    max > 0 ? Math.max(0, Math.min(100, (Number(value) / max) * 100)) : 0;
  return `<div class="analytics-bar"><span style="width:${width}%;background:${color}"></span></div>`;
}

function renderAnalyticsCharts(data) {
  const summary = data.summary || {};
  const outcomes = data.outcomes || {};
  const subjects = data.subjects || [];
  const trend = data.trend || [];
  const totalOutcome =
    Number(outcomes.correct || 0) +
    Number(outcomes.wrong || 0) +
    Number(outcomes.unattempted || 0);
  const correctPct = totalOutcome
    ? (Number(outcomes.correct || 0) / totalOutcome) * 100
    : 0;
  const wrongPct = totalOutcome
    ? (Number(outcomes.wrong || 0) / totalOutcome) * 100
    : 0;
  const trendMax = Math.max(
    ...trend.map((item) => Number(item.percentage) || 0),
    1,
  );

  return `
    <div class="analytics-stat-grid">
      <div class="analytics-stat-card"><span class="analytics-stat-icon">◔</span><strong>${summary.average_score || 0}%</strong><span>Average score</span></div>
      <div class="analytics-stat-card"><span class="analytics-stat-icon">✓</span><strong>${summary.accuracy || 0}%</strong><span>Accuracy</span></div>
      <div class="analytics-stat-card"><span class="analytics-stat-icon">▣</span><strong>${summary.completed_tests || 0}</strong><span>Tests completed</span></div>
      <div class="analytics-stat-card"><span class="analytics-stat-icon">↗</span><strong>${summary.questions_answered || 0}</strong><span>Questions answered</span></div>
    </div>
    <div class="analytics-chart-grid">
      <section class="card analytics-panel"><div class="section-title"><h2>Question outcomes</h2><span class="text-muted">${totalOutcome} answered</span></div><div class="outcome-chart-row"><div class="outcome-donut" style="--correct:${correctPct}%;--wrong:${wrongPct}%"><span>${Math.round(correctPct)}%</span></div><div class="outcome-legend"><span><i class="legend-dot correct"></i>Correct <b>${outcomes.correct || 0}</b></span><span><i class="legend-dot wrong"></i>Wrong <b>${outcomes.wrong || 0}</b></span><span><i class="legend-dot skipped"></i>Unattempted <b>${outcomes.unattempted || 0}</b></span></div></div></section>
      <section class="card analytics-panel"><div class="section-title"><h2>Score trend</h2><span class="text-muted">Last ${trend.length} tests</span></div><div class="trend-chart">${trend.length ? trend.map((item) => `<div class="trend-column"><span>${Math.round(Number(item.percentage) || 0)}%</span><i style="height:${Math.max(8, ((Number(item.percentage) || 0) / trendMax) * 100)}%"></i><small>${formatDateTime(item.submitted_at).split(",")[0]}</small></div>`).join("") : `<div class="empty-state">Submit a test to start your trend.</div>`}</div></section>
    </div>
    <section class="card analytics-panel"><div class="section-title"><h2>Subject performance</h2><span class="text-muted">Correct answers by subject</span></div><div class="subject-performance-list">${subjects.length ? subjects.map((subject) => `<div class="subject-performance-row"><div class="subject-performance-label"><span>${subjectDot(subject.subject)}${escapeHtml(subject.subject)}</span><strong>${subject.correct_count || 0}/${subject.question_count || 0}</strong></div>${analyticsBar(subject.correct_count, subject.question_count, subjectColor(subject.subject))}<small>${subject.obtained || 0} / ${subject.total || 0} marks · ${subject.wrong_count || 0} wrong</small></div>`).join("") : `<div class="empty-state">Subject analytics will appear after your first submitted test.</div>`}</div></section>`;
}

async function enterAnalyticsView() {
  const content = document.getElementById("analyticsContent");
  content.innerHTML = `<div class="empty-state">Loading analytics…</div>`;
  const { data, error } = await sb.rpc("get_student_analytics");
  if (error || !data) {
    content.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error) || "Analytics could not be loaded.")}</div>`;
    return;
  }
  content.innerHTML = renderAnalyticsCharts(data);
  await renderAnalysisHistory();
}

function renderHistoryCards(history, targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  if (!history.length) {
    target.innerHTML = `<div class="empty-state">No submitted tests yet. Your detailed reports will appear here.</div>`;
    return;
  }
  target.innerHTML = history
    .map(
      (item) => `
    <article class="history-card">
      <div class="history-card-main">
        <div class="history-card-title">${escapeHtml(item.test_title)}</div>
        <div class="history-card-meta">${categoryBadge(item.category)} · ${formatDateTime(item.submitted_at)} · ${item.status.replace("_", " ")}</div>
      </div>
      <div class="history-card-score"><strong>${item.percentage ?? 0}%</strong><span>${item.total_score} / ${item.total_marks}</span></div>
      <div class="history-card-stats"><span>${item.correct_count} correct</span><span>${item.wrong_count} wrong</span><span>${item.accuracy ?? 0}% accuracy</span></div>
      <a class="btn btn-primary btn-sm" href="#/result?attempt=${encodeURIComponent(item.attempt_id)}">View full report</a>
    </article>`,
    )
    .join("");
}

async function renderAnalysisHistory() {
  const target = document.getElementById("analysisHistory");
  if (!target) return;
  target.innerHTML = `<div class="empty-state">Loading test reports…</div>`;
  const { data, error } = await sb.rpc("get_student_test_history");
  if (error) {
    target.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error))}</div>`;
    return;
  }
  target.innerHTML = `<div class="section-title"><div><span class="eyebrow-label">Attempt history</span><h2>Every test report</h2></div><span class="text-muted">${(data || []).length} completed</span></div><div class="history-list" id="analysisHistoryList"></div>`;
  renderHistoryCards(data || [], "analysisHistoryList");
}

async function enterGlobalLeaderboardView() {
  const content = document.getElementById("leaderboardContent");
  content.innerHTML = `<div class="empty-state">Loading leaderboard…</div>`;
  const { data, error } = await sb.rpc("get_global_leaderboard");
  if (error) {
    content.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error))}</div>`;
    return;
  }
  if (!data?.length) {
    content.innerHTML = `<div class="empty-state">The global leaderboard will appear after declared results are available.</div>`;
    return;
  }

  const myId = myProfile?.id;
  const top10 = data.slice(0, 10);
  const top3 = data.slice(0, 3);
  const myRow = data.find((row) => row.user_id === myId);
  const iAmInTop10 = top10.some((row) => row.user_id === myId);

  const podiumHtml = `<div class="leaderboard-podium">${top3
    .map(
      (row, index) =>
        `<div class="podium-card podium-${index + 1}"><span>${medalFor(index + 1)}</span><strong>${escapeHtml(row.full_name || "Student")}</strong><b>#${row.rnk}</b><small>${row.average_score}% average · ${row.tests_completed} tests</small></div>`,
    )
    .join("")}</div>`;

  const rowsHtml = top10
    .map(
      (row) => `
      <tr class="${row.user_id === myId ? "me" : ""}">
        <td>#${row.rnk}</td>
        <td>${escapeHtml(row.full_name || "Student")}${row.user_id === myId ? ' <span class="you-badge">YOU</span>' : ""}</td>
        <td>${row.tests_completed}</td>
        <td>${row.average_score}%</td>
        <td>${row.average_accuracy}%</td>
        <td>${row.best_score}%</td>
        <td>${formatDurationPrecise(row.total_time_seconds)}</td>
      </tr>`,
    )
    .join("");

  const yourRankCardHtml =
    !iAmInTop10 && myRow
      ? `
    <div class="card your-rank-card" style="margin-top:12px;">
      <h2 style="font-size:14px;">Your Rank</h2>
      <p style="font-size:14px;">
        Rank: #${myRow.rnk} &nbsp;·&nbsp; Tests: ${myRow.tests_completed} &nbsp;·&nbsp;
        Average score: ${myRow.average_score}% &nbsp;·&nbsp; Accuracy: ${myRow.average_accuracy}% &nbsp;·&nbsp;
        Best score: ${myRow.best_score}% &nbsp;·&nbsp; Total time: ${formatDurationPrecise(myRow.total_time_seconds)}
      </p>
    </div>`
      : "";

  content.innerHTML = `
    ${podiumHtml}
    <div class="card leaderboard-table-card">
      <div class="table-scroll">
        <table class="report-table">
          <thead>
            <tr><th>Rank</th><th>Student</th><th>Tests</th><th>Average score</th><th>Accuracy</th><th>Best score</th><th>Total time</th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
    ${yourRankCardHtml}
  `;
}

async function enterProfilePlaceholder() {
  myProfile = myProfile || (await getMyProfile());
  const name = myProfile?.full_name || "Student";
  const roleLine = myProfile?.role === "admin" ? "Admin" : "JEE Aspirant";
  const content = document.getElementById("profileContent");
  const options = (values) =>
    values
      .map(
        (value) =>
          `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`,
      )
      .join("");
  content.innerHTML = `<div class="profile-hero"><div class="profile-avatar-large">${escapeHtml(name.trim().charAt(0).toUpperCase() || "S")}</div><div><span class="eyebrow-label">Your account</span><h1>${escapeHtml(name)}</h1><p>${roleLine} · ${escapeHtml(myProfile?.email || "")}</p></div><a class="btn btn-sm" href="#/analytics">Open analytics</a></div><section class="card profile-edit-card"><div class="section-title"><div><span class="eyebrow-label">Required before your first test</span><h2>Student profile</h2></div><span id="profileSaveStatus" class="text-muted"></span></div><form id="profileEditForm" class="profile-edit-form profile-details-form"><label>Full name *<input type="text" id="profileNameInput" value="${escapeHtml(myProfile?.full_name || "")}" maxlength="120" required></label><label>Email *<input type="email" id="profileEmailInput" value="${escapeHtml(myProfile?.email || "")}" required></label><label>Mobile number<input type="tel" id="profileMobileInput" value="${escapeHtml(myProfile?.mobile_number || "")}" maxlength="20"></label><label>Date of birth / age<input type="date" id="profileDobInput" value="${escapeHtml(myProfile?.date_of_birth || "")}"></label><label>Gender (optional)<select id="profileGenderInput"><option value="">Prefer not to say</option>${options(["Female", "Male", "Non-binary", "Other"])}</select></label><label>Class / grade *<input type="text" id="profileClassInput" value="${escapeHtml(myProfile?.class_grade || "")}" maxlength="40" required></label><label>Target exam<select id="profileTargetInput"><option value="">Select target exam</option>${options(["JEE Main", "JEE Advanced", "NEET", "Olympiads", "Other"])}</select></label><label>Board<select id="profileBoardInput"><option value="">Select board</option>${options(["CBSE", "ICSE", "State Board", "Other"])}</select></label><button type="submit" class="btn btn-primary">Save profile</button></form></section><div class="section-title profile-history-heading"><div><span class="eyebrow-label">Your activity</span><h2>Test history</h2></div></div><div id="profileHistory" class="history-list"><div class="empty-state">Loading test history…</div></div>`;
  if (qs("complete")) {
    const notice = document.createElement("div");
    notice.className = "locked-banner profile-required-notice";
    notice.textContent =
      "Complete the required fields below before starting your test.";
    content.insertBefore(notice, content.firstChild);
  }
  document.getElementById("profileGenderInput").value = myProfile?.gender || "";
  document.getElementById("profileTargetInput").value =
    myProfile?.target_exam || "";
  document.getElementById("profileBoardInput").value = myProfile?.board || "";
  document
    .getElementById("profileEditForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button");
      const nextName = document.getElementById("profileNameInput").value.trim();
      const nextEmail = document
        .getElementById("profileEmailInput")
        .value.trim();
      const nextClass = document
        .getElementById("profileClassInput")
        .value.trim();
      if (!nextName || !nextEmail || !nextClass) return;
      button.disabled = true;
      const { data, error } = await sb
        .from("profiles")
        .update({
          full_name: nextName,
          email: nextEmail,
          mobile_number:
            document.getElementById("profileMobileInput").value.trim() || null,
          date_of_birth:
            document.getElementById("profileDobInput").value || null,
          gender: document.getElementById("profileGenderInput").value || null,
          class_grade: nextClass,
          target_exam:
            document.getElementById("profileTargetInput").value || null,
          board: document.getElementById("profileBoardInput").value || null,
        })
        .eq("id", myProfile.id)
        .select()
        .single();
      button.disabled = false;
      if (error) {
        toast(friendlyError(error), "error");
        return;
      }
      myProfile = data;
      document.getElementById("profileSaveStatus").textContent = "Saved";
      toast("Profile updated", "success");
      await syncAppShell(currentRoute.path.slice(1), true);
    });
  const { data, error } = await sb.rpc("get_student_test_history");
  if (error) {
    document.getElementById("profileHistory").innerHTML =
      `<div class="error-box">${escapeHtml(friendlyError(error))}</div>`;
    return;
  }
  renderHistoryCards(data || [], "profileHistory");
}

// Shows/hides the signed-in app shell (sidebar on desktop, bottom nav on
// mobile) and keeps it in sync with the active view + signed-in user.
// viewName is one of VIEWS (e.g. "dashboard"), or null when signed out.
async function syncAppShell(viewName, signedIn) {
  const show = signedIn && APP_SHELL_VIEWS.has(viewName);
  document.body.classList.toggle("app-shell-on", show);
  if (!show) return;

  document.querySelectorAll(".app-nav-item, .app-bottom-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.nav === viewName);
  });

  myProfile = myProfile || (await getMyProfile());
  const name = myProfile?.full_name || "Student";
  const isAdmin = myProfile?.role === "admin";

  const avatarEl = document.getElementById("appSidebarAvatar");
  const nameEl = document.getElementById("appSidebarUserName");
  const roleEl = document.getElementById("appSidebarUserRole");
  const adminLink = document.getElementById("appNavAdmin");
  const bulkImportLink = document.getElementById("appNavBulkImport");
  if (avatarEl)
    avatarEl.textContent = name.trim().charAt(0).toUpperCase() || "S";
  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = isAdmin ? "Admin" : "Student";
  if (adminLink) adminLink.style.display = isAdmin ? "" : "none";
  if (bulkImportLink) bulkImportLink.style.display = isAdmin ? "" : "none";
}

/* =========================================================================
   8. BOOTSTRAP
   ========================================================================= */
function setupGlobalListeners() {
  document
    .querySelectorAll(".js-logout")
    .forEach((btn) => btn.addEventListener("click", logout));
}

setupTheme();
setupGlobalListeners();
setupLandingPage();
setupAuthListeners();
setupDashboardListeners();
setupTestsCatalogListeners();
setupAdminTestListeners();
setupBulkImportListeners();
setupExamStaticListeners();
router();

let feedbackRating = 0;
let pendingResult = null;
document.querySelectorAll("#feedbackModal [data-rating]").forEach((btn) =>
  btn.addEventListener("click", () => {
    feedbackRating = Number(btn.dataset.rating);
    document
      .querySelectorAll("#feedbackModal [data-rating]")
      .forEach((b) =>
        b.classList.toggle(
          "selected",
          Number(b.dataset.rating) === feedbackRating,
        ),
      );
  }),
);
document
  .getElementById("skipFeedbackBtn")
  .addEventListener("click", finishFeedback);
document.getElementById("cancelReportBtn").addEventListener("click", () => {
  reportingQuestion = null;
  closeModal("reportQuestionModal");
});
document
  .getElementById("submitReportBtn")
  .addEventListener("click", async () => {
    if (!reportingQuestion) return;
    const btn = document.getElementById("submitReportBtn");
    btn.disabled = true;
    const { error } = await sb.from("question_reports").insert({
      attempt_id: attemptId,
      test_id: testId,
      question_id: reportingQuestion.id,
      reason: document.getElementById("reportReason").value,
      details: document.getElementById("reportDetails").value.trim() || null,
    });
    btn.disabled = false;
    if (error) {
      toast(friendlyError(error), "error");
      return;
    }
    reportingQuestion = null;
    closeModal("reportQuestionModal");
    toast("Thanks — your report has been sent to the admins.", "success");
  });
document
  .getElementById("saveFeedbackBtn")
  .addEventListener("click", async () => {
    const btn = document.getElementById("saveFeedbackBtn");
    btn.disabled = true;
    const { error } = await sb.from("test_feedback").upsert(
      {
        attempt_id: attemptId,
        test_id: testId,
        rating: feedbackRating || null,
        comment: document.getElementById("feedbackText").value.trim() || null,
      },
      { onConflict: "attempt_id" },
    );
    btn.disabled = false;
    if (error) {
      toast(friendlyError(error), "error");
      return;
    }
    finishFeedback();
  });

function showFeedbackThenResult(data, reasonText) {
  pendingResult = {
    title: "Test submitted",
    text: `${reasonText} Your score: ${data.total_score} / ${totalMarks}.`,
    href: `#/result?attempt=${attemptId}`,
  };
  feedbackRating = 0;
  document.getElementById("feedbackText").value = "";
  document
    .querySelectorAll("#feedbackModal [data-rating]")
    .forEach((b) => b.classList.remove("selected"));
  openModal("feedbackModal");
}
function finishFeedback() {
  closeModal("feedbackModal");
  if (!pendingResult) return;
  showTerminal(
    pendingResult.title,
    pendingResult.text,
    pendingResult.href,
    "View your report",
  );
  pendingResult = null;
}

/* =========================================================
   LANDING PAGE (public front page)
   ========================================================= */
function setupLandingPage() {
  const root = document.getElementById("view-landing");
  if (!root) return;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  // Mobile hamburger menu
  const hamburger = document.getElementById("landingHamburger");
  const navLinks = document.getElementById("landingNavLinks");
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      const open = navLinks.classList.toggle("open");
      hamburger.classList.toggle("open", open);
      hamburger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navLinks.querySelectorAll("a").forEach((link) =>
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        hamburger.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
      }),
    );
  }

  // Test-series popup — shown once per browser session
  const popup = document.getElementById("landingPopup");
  const popupClose = document.getElementById("landingPopupClose");
  if (popup && popupClose) {
    popupClose.addEventListener("click", () => closeModal("landingPopup"));
    popup.addEventListener("click", (e) => {
      if (e.target === popup) closeModal("landingPopup");
    });
  }
  function maybeShowPopup() {
    if (!popup) return;
    if (sessionStorage.getItem("jee_landing_popup_shown")) return;
    sessionStorage.setItem("jee_landing_popup_shown", "1");
    setTimeout(() => openModal("landingPopup"), 600);
  }

  // Typewriter effect — cycles a few endings for the hero headline
  const typedEl = document.getElementById("landingTypedText");
  if (typedEl) {
    const phrases = ["Rank Higher.", "Score Better.", "Ace The JEE."];
    if (reduceMotion) {
      typedEl.textContent = phrases[0];
    } else {
      let phraseIndex = 0;
      let charIndex = 0;
      let deleting = false;
      let typeTimer = null;

      function tick() {
        const current = phrases[phraseIndex];

        if (!deleting) {
          charIndex++;
          typedEl.textContent = current.slice(0, charIndex);
          if (charIndex === current.length) {
            deleting = true;
            typeTimer = setTimeout(tick, 1600);
            return;
          }
          typeTimer = setTimeout(tick, 65);
        } else {
          charIndex--;
          typedEl.textContent = current.slice(0, charIndex);
          if (charIndex === 0) {
            deleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            typeTimer = setTimeout(tick, 300);
            return;
          }
          typeTimer = setTimeout(tick, 35);
        }
      }

      typeTimer = setTimeout(tick, 900);
    }
  }

  // Follower counter — animates once when the hero scrolls into view
  const counterEl = document.getElementById("followerCount");
  const TARGET_FOLLOWERS = 800;
  let counted = false;
  function runCounter() {
    if (counted || !counterEl) return;
    counted = true;
    if (reduceMotion) {
      counterEl.textContent = TARGET_FOLLOWERS;
      return;
    }
    const duration = 900;
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      counterEl.textContent = Math.round(eased * TARGET_FOLLOWERS);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Scroll-reveal for feature/how-it-works/community cards
  const revealTargets = root.querySelectorAll(
    ".landing-feature-card, .landing-how-step, .landing-community-card",
  );
  if (revealTargets.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealTargets.forEach((el) => el.classList.add("in-view"));
    } else {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in-view");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 },
      );
      revealTargets.forEach((el) => revealObserver.observe(el));
    }
  }

  if ("IntersectionObserver" in window) {
    const heroObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runCounter();
            heroObserver.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );
    const hero = document.querySelector(".landing-hero");
    if (hero) heroObserver.observe(hero);
  }

  // Show the popup the first time the landing view actually becomes active,
  // not merely on page load (so it never appears behind other views).
  const landingViewObserver = new MutationObserver(() => {
    if (root.classList.contains("active")) {
      maybeShowPopup();
      runCounter();
    }
  });
  landingViewObserver.observe(root, {
    attributes: true,
    attributeFilter: ["class"],
  });
  if (root.classList.contains("active")) {
    maybeShowPopup();
    runCounter();
  }
}

/* =========================================================
   THEME SYSTEM
   Default: LIGHT
   Remembers user's choice
   ========================================================= */

function applyTheme(theme) {
  const safeTheme = theme === "dark" ? "dark" : "light";

  document.documentElement.setAttribute("data-theme", safeTheme);

  localStorage.setItem("jee_theme", safeTheme);

  const btn = document.getElementById("themeToggle");

  if (btn) {
    btn.textContent = safeTheme === "dark" ? "☀️" : "🌙";

    btn.setAttribute(
      "aria-label",
      safeTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
    );

    btn.title =
      safeTheme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  }
}

function toggleTheme() {
  const current =
    document.documentElement.getAttribute("data-theme") || "light";

  applyTheme(current === "dark" ? "light" : "dark");
}

/* =========================================================
   THEME SYSTEM + DRAGGABLE POSITION
   ========================================================= */

function applyTheme(theme) {
  const safeTheme = theme === "dark" ? "dark" : "light";

  document.documentElement.setAttribute("data-theme", safeTheme);

  localStorage.setItem("jee_theme", safeTheme);

  const btn = document.getElementById("themeToggle");

  if (btn) {
    btn.textContent = safeTheme === "dark" ? "☀️" : "🌙";

    btn.setAttribute(
      "aria-label",
      safeTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
    );

    btn.title =
      safeTheme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  }
}

function toggleTheme() {
  const current =
    document.documentElement.getAttribute("data-theme") || "light";

  applyTheme(current === "dark" ? "light" : "dark");
}

/* =========================================================
   DRAGGABLE THEME BUTTON
   Works with:
   - Mouse
   - Touch
   - Pen
   ========================================================= */

function setupThemeDrag() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  let dragging = false;
  let moved = false;

  let startX = 0;
  let startY = 0;

  let startLeft = 0;
  let startTop = 0;

  let pointerId = null;

  const savedLeft = localStorage.getItem("jee_theme_left");
  const savedTop = localStorage.getItem("jee_theme_top");
  const savedForMobile =
    localStorage.getItem("jee_theme_position_mobile") === "true";
  const isMobileViewport = () =>
    window.matchMedia("(max-width: 879px)").matches;

  /* Restore previous position */

  if (
    savedLeft !== null &&
    savedTop !== null &&
    (!isMobileViewport() || savedForMobile)
  ) {
    const left = parseFloat(savedLeft);
    const top = parseFloat(savedTop);
    const maxLeft = window.innerWidth - btn.offsetWidth;
    const maxTop = window.innerHeight - btn.offsetHeight;

    if (
      Number.isFinite(left) &&
      Number.isFinite(top) &&
      left >= 0 &&
      left <= maxLeft &&
      top >= 0 &&
      top <= maxTop
    ) {
      btn.style.left = `${left}px`;
      btn.style.top = `${top}px`;

      btn.style.right = "auto";
      btn.style.bottom = "auto";
    }
  }

  btn.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;

    dragging = true;
    moved = false;

    btn.classList.add("dragging");

    btn.setPointerCapture(pointerId);

    const rect = btn.getBoundingClientRect();

    startX = event.clientX;
    startY = event.clientY;

    startLeft = rect.left;
    startTop = rect.top;

    event.preventDefault();
  });

  btn.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== pointerId) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      moved = true;
    }

    let newLeft = startLeft + dx;
    let newTop = startTop + dy;

    /* Keep button inside the screen */

    const maxLeft = window.innerWidth - btn.offsetWidth;
    const maxTop = window.innerHeight - btn.offsetHeight;

    newLeft = Math.max(0, Math.min(newLeft, maxLeft));

    newTop = Math.max(0, Math.min(newTop, maxTop));

    btn.style.left = `${newLeft}px`;
    btn.style.top = `${newTop}px`;

    btn.style.right = "auto";
    btn.style.bottom = "auto";

    event.preventDefault();
  });

  const finishDrag = (event) => {
    if (!dragging || event.pointerId !== pointerId) return;

    dragging = false;

    btn.classList.remove("dragging");

    /* Save position */

    if (moved) {
      const rect = btn.getBoundingClientRect();

      localStorage.setItem("jee_theme_left", String(rect.left));

      localStorage.setItem("jee_theme_top", String(rect.top));

      localStorage.setItem(
        "jee_theme_position_mobile",
        String(isMobileViewport()),
      );
    }

    pointerId = null;
  };

  btn.addEventListener("pointerup", finishDrag);
  btn.addEventListener("pointercancel", finishDrag);

  /* Prevent a drag from accidentally toggling the theme */

  btn.addEventListener("click", (event) => {
    if (moved) {
      event.preventDefault();
      event.stopImmediatePropagation();

      moved = false;
      return;
    }

    toggleTheme();
  });

  window.addEventListener("resize", () => {
    const hasMobilePosition =
      localStorage.getItem("jee_theme_position_mobile") === "true";

    if (isMobileViewport() && !hasMobilePosition) {
      btn.style.left = "";
      btn.style.top = "";
      btn.style.right = "";
      btn.style.bottom = "";
      return;
    }

    if (!btn.style.left || !btn.style.top) return;

    const maxLeft = window.innerWidth - btn.offsetWidth;
    const maxTop = window.innerHeight - btn.offsetHeight;
    const left = Math.max(0, Math.min(parseFloat(btn.style.left), maxLeft));
    const top = Math.max(0, Math.min(parseFloat(btn.style.top), maxTop));

    btn.style.left = `${left}px`;
    btn.style.top = `${top}px`;
  });
}

/* =========================================================
   THEME INITIALIZATION
   ========================================================= */

function setupTheme() {
  const savedTheme = localStorage.getItem("jee_theme") || "light";

  applyTheme(savedTheme);

  setupThemeDrag();
}
