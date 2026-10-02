/* =========================================================================
   0. CONFIG — fill these in with your own Supabase project's values.
   Find them in: Supabase Dashboard → Project Settings → API
   ========================================================================= */
const SUPABASE_URL = "https://rsxbortronrhtdwlvwao.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzeGJvcnRyb25yaHRkd2x2d2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNjY0NTcsImV4cCI6MjEwNDc0MjQ1N30.cVemoSdCmpxV22YMJQCFukAZstQnNUx4dEli9TXefZQ";

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const PRODUCTION_APP_URL = "https://jeehustlers.netlify.app";

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

function redirectToProductionApp() {
  if (window.location.origin !== PRODUCTION_APP_URL) {
    window.location.replace(`${PRODUCTION_APP_URL}${window.location.pathname}`);
  }
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
sb.auth.onAuthStateChange(async (event, session) => {
  router();

  if (
    session?.user &&
    (event === "SIGNED_IN" || event === "INITIAL_SESSION")
  ) {
    try {
      if (
        typeof OneSignal !== "undefined" &&
        Notification.permission === "default"
      ) {
        await OneSignal.Slidedown.promptPush();
      }
    } catch (error) {
      console.warn("OneSignal login prompt failed:", error);
    }
  }
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
  const loginGoogleBtn = document.getElementById("loginGoogleBtn");
  const signupGoogleBtn = document.getElementById("signupGoogleBtn");

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

  function setGoogleButtonState(button, busy) {
    button.disabled = busy;
    button.innerHTML = busy
      ? "Connecting to Google…"
      : '<img class="google-mark" src="Google_logo.webp" alt="" aria-hidden="true"> ' +
        (button === loginGoogleBtn
          ? "Continue with Google"
          : "Register with Google");
  }

  async function startGoogleSignIn() {
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${PRODUCTION_APP_URL}${window.location.pathname}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setMessage(escapeHtml(friendlyError(error)), "error");
      return false;
    }
    return true;
  }

  async function linkGoogleIdentity() {
    const { data: sessionData } = await sb.auth.getSession();
    if (!sessionData.session) {
      setMessage(
        "Please enter your email and password first. We verify the password before linking Google so no account can be merged using email alone.",
        "error",
      );
      return false;
    }

    const { data: userData, error: userError } = await sb.auth.getUser();
    if (userError) {
      setMessage(escapeHtml(friendlyError(userError)), "error");
      return false;
    }
    const googleAlreadyLinked = userData.user?.identities?.some(
      (identity) => identity.provider === "google",
    );
    if (googleAlreadyLinked) {
      await sb.auth.signOut();
      return startGoogleSignIn();
    }

    const { error } = await sb.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: `${PRODUCTION_APP_URL}${window.location.pathname}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setMessage(
        escapeHtml(
          error.message?.includes("already linked") ||
            error.message?.includes("already exists")
            ? "That Google account is already linked to a different Test Series account. Log in to that account instead; accounts are never merged automatically."
            : friendlyError(error),
        ),
        "error",
      );
      return false;
    }
    return true;
  }

  async function handleLoginGoogle() {
    await startGoogleSignIn();
  }

  async function handleSignupGoogle() {
    await startGoogleSignIn();
  }

  loginGoogleBtn.addEventListener("click", async () => {
    setGoogleButtonState(loginGoogleBtn, true);
    authMessage.innerHTML = "";
    try {
      await handleLoginGoogle();
    } finally {
      setGoogleButtonState(loginGoogleBtn, false);
    }
  });

  signupGoogleBtn.addEventListener("click", async () => {
    setGoogleButtonState(signupGoogleBtn, true);
    authMessage.innerHTML = "";
    try {
      await handleSignupGoogle();
    } finally {
      setGoogleButtonState(signupGoogleBtn, false);
    }
  });

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
    redirectToProductionApp();
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
      redirectToProductionApp();
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
  // Every catalog row already says which attempt it stands for (a real
  // attempt for the main card, one specific re-attempt for each practice
  // card). Matching on that id means "View Report" can never open a
  // practice report from the main card, or the other way round.
  const byId = new Map();
  const latestReal = new Map();
  const latestPractice = new Map();
  const newer = (x, y) => !y || new Date(x.started_at) > new Date(y.started_at);

  (attempts || []).forEach((a) => {
    byId.set(a.id, a);
    const bucket = a.is_practice ? latestPractice : latestReal;
    if (newer(a, bucket.get(a.test_id))) bucket.set(a.test_id, a);
  });

  return (catalog || []).map((t) => {
    let mine = t.attempt_id ? byId.get(t.attempt_id) || null : null;
    if (!mine && !t.attempt_id) {
      mine = (t.is_practice ? latestPractice : latestReal).get(t.id) || null;
    }
    return { ...t, myAttempt: mine, windowState: classifyTestWindow(t) };
  });
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
  if (entry.is_practice) {
    // The main (real) test card already offers "Reattempt" — this card is
    // that re-attempt, so it only ever needs to view or resume itself.
    if (a && a.status !== "in_progress") {
      return `<a class="btn btn-sm btn-practice" href="#/result?attempt=${a.id}">View practice report</a>`;
    }
    return `<a class="btn btn-sm btn-practice" href="#/exam?test=${encodeURIComponent(entry.id)}&practice=1">Resume practice</a>`;
  }
  if (a && a.status !== "in_progress") {
    return `<a class="btn btn-sm" href="#/result?attempt=${a.id}">View Report</a> <a class="btn btn-sm btn-secondary" href="#/exam?test=${encodeURIComponent(entry.id)}&practice=1">🔁 Reattempt</a> <button type="button" class="btn btn-sm btn-print" data-print-attempt="${a.id}" title="Preview the question paper with answer key and download it as a PDF">📄 Get Questions PDF</button>`;
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
  if (entry.is_practice) {
    return `${entry.duration_minutes} min · Practice only — not counted for rank`;
  }
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
  const practicePill = entry.is_practice
    ? `<span class="practice-pill">🔁 Practice re-attempt</span>`
    : "";
  return `
    <div class="test-card ${entry.is_practice ? "test-card-practice" : ""}">
      <div class="test-card-top">${entry.is_practice ? practicePill : `${liveBadge}${lifecycleBadge}`}${categoryBadge(entry.category)}${attemptTag}</div>
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

  // Re-attempts are personal practice: they never count towards totals.
  const totalTests = merged.filter((t) => !t.is_practice).length;
  const mainAttempts = attempts.filter((a) => !a.is_practice);
  const attemptedCount = new Set(mainAttempts.map((a) => a.test_id)).size;

  const submittedAttempts = mainAttempts
    .filter((a) => a.status !== "in_progress" && !a.disqualified_at)
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
    .slice(0, 25);

  // Same source as the Analytics page (main attempts only, re-attempts and
  // disqualified attempts excluded), so both screens always agree.
  let avgScoreLabel = "—";
  if (submittedAttempts.length) {
    const { data: analytics } = await sb.rpc("get_student_analytics");
    const completed = Number(analytics?.summary?.completed_tests || 0);
    const avg = Number(analytics?.summary?.average_score);
    if (completed > 0 && Number.isFinite(avg)) avgScoreLabel = `${avg.toFixed(1)}%`;
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
        .select("id, test_id, status, total_score, started_at, submitted_at, is_practice, disqualified_at")
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

let adminTestsCache = [];
const adminTestsView = { q: "", status: "all" };

// Locked = not published yet. Scheduled = published, opens later.
// Live = inside its window. Closed = window is over.
function adminTestState(t) {
  const now = Date.now();
  if (!t.is_published) return "locked";
  if (t.available_from && now < new Date(t.available_from).getTime()) return "scheduled";
  if (t.available_until && now >= new Date(t.available_until).getTime()) return "closed";
  return "live";
}
const ADMIN_STATE_LABEL = { live: "Live", scheduled: "Scheduled", locked: "Locked", closed: "Closed" };

function bindAdminTestsControls() {
  const search = document.getElementById("adminTestsSearch");
  if (!search || search.dataset.bound) return;
  search.dataset.bound = "1";
  search.addEventListener("input", (e) => {
    adminTestsView.q = e.target.value;
    renderAdminTests();
  });
  document.getElementById("adminStatusTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-filter]");
    if (!btn) return;
    adminTestsView.status = btn.dataset.filter;
    renderAdminTests();
  });
  document.getElementById("adminTestsList").addEventListener("click", (e) => {
    const del = e.target.closest(".js-delete-test");
    if (del) deleteTest(del.dataset.id);
  });
}

function renderAdminTests() {
  const list = document.getElementById("adminTestsList");
  const tabs = document.getElementById("adminStatusTabs");
  const overview = document.getElementById("adminOverview");
  if (!list) return;

  const count = (s) => adminTestsCache.filter((t) => t.state === s).length;
  const submissions = adminTestsCache.reduce((s, t) => s + t.attempts, 0);
  const tile = (label, value, sub = "") =>
    `<div class="insight-tile"><span>${label}</span><strong>${value}</strong>${sub ? `<small>${sub}</small>` : ""}</div>`;
  overview.innerHTML =
    tile("Total tests", adminTestsCache.length, `${adminTestsCache.reduce((s, t) => s + t.questions, 0)} questions`) +
    tile("Live now", count("live"), count("scheduled") ? `${count("scheduled")} scheduled` : "") +
    tile("Locked", count("locked"), "Not published yet") +
    tile("Submissions", submissions, `${count("closed")} test${count("closed") === 1 ? "" : "s"} closed`);

  const filters = [
    ["all", "All", adminTestsCache.length],
    ["live", "Live", count("live")],
    ["scheduled", "Scheduled", count("scheduled")],
    ["locked", "Locked", count("locked")],
    ["closed", "Closed", count("closed")],
  ];
  tabs.innerHTML = filters
    .map(
      ([key, label, n]) =>
        `<button type="button" data-filter="${key}" class="${adminTestsView.status === key ? "active" : ""}">${label} <span class="seg-count">${n}</span></button>`,
    )
    .join("");

  const needle = adminTestsView.q.trim().toLowerCase();
  const rows = adminTestsCache.filter(
    (t) =>
      (adminTestsView.status === "all" || t.state === adminTestsView.status) &&
      (!needle ||
        (t.title || "").toLowerCase().includes(needle) ||
        (t.category || "").toLowerCase().includes(needle)),
  );
  if (!rows.length) {
    list.innerHTML = `<div class="empty-state">${adminTestsCache.length ? "No tests match this filter." : "No tests have been created yet."}</div>`;
    return;
  }
  const when = (iso) =>
    iso
      ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
      : "—";
  list.innerHTML = rows
    .map(
      (t) => `
    <article class="admin-test-card state-${t.state}">
      <div class="atc-top">
        <span class="state-pill ${t.state}">${ADMIN_STATE_LABEL[t.state]}</span>
        ${categoryBadge(t.category)}
      </div>
      <h3 class="atc-title">${escapeHtml(t.title)}</h3>
      <div class="atc-window"><div><span>Opens</span> ${when(t.available_from)}</div><div><span>Closes</span> ${when(t.available_until)}</div></div>
      <div class="atc-stats">
        <div><strong>${t.questions}</strong><span>Questions</span></div>
        <div><strong>${t.attempts}</strong><span>Attempts</span></div>
        <div><strong>${t.duration_minutes || "—"}<small>m</small></strong><span>Duration</span></div>
      </div>
      <div class="atc-actions">
        <a class="btn btn-primary btn-sm" href="#/admin-test?test=${t.id}">Manage</a>
        <button type="button" class="btn btn-sm btn-danger js-delete-test" data-id="${t.id}">Delete</button>
      </div>
    </article>`,
    )
    .join("");
}

async function loadAdminTests() {
  const list = document.getElementById("adminTestsList");
  bindAdminTestsControls();
  const { data, error } = await sb
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error))}</div>`;
    return;
  }
  if (!data || data.length === 0) {
    adminTestsCache = [];
    renderAdminTests();
    return;
  }

  const [attemptCounts, questionCounts] = await Promise.all([
    Promise.all(
      data.map((t) =>
        sb
          .from("test_attempts")
          .select("id", { count: "exact", head: true })
          .eq("test_id", t.id)
          .eq("is_practice", false),
      ),
    ),
    Promise.all(
      data.map((t) =>
        sb
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("test_id", t.id),
      ),
    ),
  ]);

  adminTestsCache = data.map((t, i) => ({
    ...t,
    state: adminTestState(t),
    attempts: attemptCounts[i]?.count ?? 0,
    questions: questionCounts[i]?.count ?? 0,
  }));
  renderAdminTests();
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
let adminQuestionsCache = [];
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
  document.getElementById("studentResultsCard").style.display = "none";
  document.getElementById("reportsCard").style.display = "none";
  document.getElementById("adminSummary").style.display = "none";
  document.getElementById("adminJump").style.display = "none";
  adminReports = [];
  adminResultsRows = [];
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
  await loadReports();
}

function showPostCreateSections() {
  document.getElementById("shareCard").style.display = "block";
  document.getElementById("questionsCard").style.display = "block";
  document.getElementById("studentResultsCard").style.display = "block";
  document.getElementById("reportsCard").style.display = "block";
  document.getElementById("adminSummary").style.display = "grid";
  document.getElementById("adminJump").style.display = "flex";
  renderShareCard();
  renderAdminSummary();
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
  const showWhenLocked = currentTest.show_when_locked !== false;
  document.getElementById("scheduleSummary").textContent = showWhenLocked
    ? `Students see this test as Locked and it goes live automatically. Publishes ${formatDateTime(currentTest.available_from)} · closes ${formatDateTime(currentTest.available_until)}.`
    : `Hidden from students until it goes live automatically on ${formatDateTime(currentTest.available_from)} · closes ${formatDateTime(currentTest.available_until)}.`;
  renderVisibilityButton(showWhenLocked);
}

function renderVisibilityButton(showWhenLocked) {
  const btn = document.getElementById("visibilityToggleBtn");
  const hint = document.getElementById("visibilityHint");
  if (!btn) return;
  btn.classList.toggle("is-shown", showWhenLocked);
  btn.classList.toggle("is-hidden", !showWhenLocked);
  btn.setAttribute("aria-pressed", String(showWhenLocked));
  btn.querySelector(".visibility-btn-icon").textContent = showWhenLocked
    ? "👁"
    : "🚫";
  btn.querySelector(".visibility-btn-label").textContent = showWhenLocked
    ? "Shown"
    : "Hidden";
  btn.title = showWhenLocked
    ? "Click to hide this test from students until it goes live"
    : "Click to show this test to students as Locked";
  if (hint) {
    hint.textContent = showWhenLocked
      ? "Shown: students can see this test as Locked before it goes live. Click to hide it."
      : "Hidden: students cannot see this test until it goes live. Click to show it as Locked.";
  }
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("#visibilityToggleBtn");
  if (!btn || !currentTest || btn.disabled) return;
  const next = currentTest.show_when_locked === false; // flip: hidden -> shown, shown -> hidden
  btn.disabled = true;
  const { data, error } = await sb
    .from("tests")
    .update({ show_when_locked: next })
    .eq("id", currentTest.id)
    .select()
    .single();
  btn.disabled = false;
  if (error) {
    toast(
      /show_when_locked/.test(error.message || "")
        ? "Run the show_when_locked.sql migration in Supabase first."
        : friendlyError(error),
      "error",
    );
    return;
  }
  currentTest = data;
  renderShareCard();
  toast(
    next
      ? "Test is now shown to students as Locked"
      : "Test is now hidden from students until it goes live",
    "success",
  );
});

async function loadQuestions() {
  const { data, error } = await sb
    .from("questions")
    .select("*")
    .eq("test_id", currentTest.id)
    .order("question_order");
  if (error) {
    toast(friendlyError(error), "error");
    return;
  }
  questionCounter = data.length;
  adminQuestionsCache = data;
  const countTag = document.getElementById("questionCountTag");
  if (countTag) {
    const marks = data.reduce((s, q) => s + Number(q.positive_marks || 0), 0);
    const mcq = data.filter((q) => q.question_type === "mcq").length;
    countTag.textContent = data.length
      ? `${data.length} question${data.length === 1 ? "" : "s"} · ${mcq} MCQ · ${data.length - mcq} Integer · ${marks} marks`
      : "No questions yet";
  }
  renderAdminSummary();
}

// Top-of-page snapshot for the admin: what this test contains and how it is doing.
let adminReports = [];
function renderAdminSummary() {
  const el = document.getElementById("adminSummary");
  if (!el || !currentTest) return;
  const marks = adminQuestionsCache.reduce(
    (s, q) => s + Number(q.positive_marks || 0),
    0,
  );
  const tile = (label, value, sub = "") =>
    `<div class="insight-tile"><span>${label}</span><strong>${value}</strong>${sub ? `<small>${sub}</small>` : ""}</div>`;
  el.innerHTML =
    tile("Questions", adminQuestionsCache.length, `${marks} total marks`) +
    tile("Duration", `${currentTest.duration_minutes || "—"} min`, escapeHtml(currentTest.category || "")) +
    tile("Submissions", adminResultsRows.length, currentTest.result_release_at ? "Results declared" : "Results pending") +
    tile("Reports", adminReports.length, adminReports.length ? "Need a look" : "All clear");
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("#adminJump [data-jump]");
  if (!btn) return;
  document
    .getElementById(btn.dataset.jump)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
});

/* =========================================================================
   ADMIN — test preview (mirrors the real exam interface, read-only)
   ========================================================================= */
let pv = null;

function pvQuestionIssues(q) {
  const issues = [];
  if (!String(q.question_text || "").trim())
    issues.push("Question text is empty");
  if (q.question_type === "mcq") {
    const opts = q.options || [];
    if (opts.length < 2) issues.push("Fewer than 2 options");
    if (opts.some((o) => !String(o.text || "").trim()))
      issues.push("An option is empty");
    if (!q.correct_option || !opts.some((o) => o.id === q.correct_option))
      issues.push("Correct option is missing or invalid");
  } else if (
    q.correct_integer_value === null ||
    q.correct_integer_value === undefined ||
    q.correct_integer_value === ""
  ) {
    issues.push("Correct integer answer is missing");
  }
  return issues;
}

// Subjects in the usual order, and inside each subject MCQs first, then Integer type.
function pvGroupQuestions() {
  const ORDER = ["Physics", "Chemistry", "Mathematics", "Biology"];
  const rank = (s) => {
    const i = ORDER.indexOf(s);
    return i === -1 ? ORDER.length : i;
  };
  const bySubj = {};
  adminQuestionsCache.forEach((q) => {
    const key = q.subject || "Other";
    (bySubj[key] = bySubj[key] || []).push(q);
  });
  Object.keys(bySubj).forEach((k) => {
    bySubj[k] = bySubj[k]
      .map((q, idx) => ({ q, idx }))
      .sort(
        (x, y) =>
          (x.q.question_type === "mcq" ? 0 : 1) -
            (y.q.question_type === "mcq" ? 0 : 1) || x.idx - y.idx,
      )
      .map((x) => x.q);
  });
  const subjList = Object.keys(bySubj).sort(
    (x, y) => rank(x) - rank(y) || x.localeCompare(y),
  );
  return { bySubj, subjList };
}

// focusQuestionId lets a reported question open the preview right on it.
function openTestPreview(focusQuestionId = null) {
  if (!adminQuestionsCache.length) {
    toast("Add at least one question to preview the test.", "error");
    return;
  }
  document.getElementById("adminPreviewOverlay")?.remove();
  const groups = pvGroupQuestions();
  pv = { ...groups, subject: groups.subjList[0], index: 0, showAnswers: true };
  if (focusQuestionId) {
    for (const s of groups.subjList) {
      const i = groups.bySubj[s].findIndex((q) => q.id === focusQuestionId);
      if (i !== -1) {
        pv.subject = s;
        pv.index = i;
        break;
      }
    }
  }

  const el = document.createElement("div");
  el.className = "admin-preview-overlay";
  el.id = "adminPreviewOverlay";
  el.innerHTML = `
    <div class="admin-preview-banner">
      <div class="pv-banner-left">
        <span class="pv-badge">👁 Admin preview</span>
        <span class="pv-banner-note">Exactly what students see · edit or remove questions right here</span>
      </div>
      <div class="pv-banner-right">
        <label class="pv-switch" title="Show or hide correct answers and explanations">
          <input type="checkbox" id="pvShowAnswers" checked>
          <span class="pv-switch-track"><i></i></span>
          <span class="pv-switch-label">Show answers</span>
        </label>
        <button type="button" class="pv-close-btn" id="pvCloseBtn">✕ Close preview</button>
      </div>
    </div>
    <div class="exam-topbar">
      <div class="exam-topbar-inner">
        <div>
          <div class="exam-title">${escapeHtml(currentTest?.title || "Test")}</div>
          <div class="exam-candidate" id="pvCount">Admin preview · ${adminQuestionsCache.length} questions</div>
        </div>
        <div class="exam-timer">${escapeHtml(String(currentTest?.duration_minutes ?? "--"))} min</div>
      </div>
      <div class="subject-tabs" id="pvSubjectTabs"></div>
    </div>
    <div class="exam-body">
      <div class="exam-main"><div class="question-card" id="pvQuestionCard"></div></div>
      <div class="exam-palette-panel" id="pvPalettePanel">
        <div class="palette-header">
          <div class="palette-title-wrap">
            <h3>Question palette</h3>
            <span class="palette-subject" id="pvPaletteSubject"></span>
          </div>
          <button type="button" class="palette-close" id="pvPaletteClose" aria-label="Close palette">×</button>
        </div>
        <div class="palette-progress">
          <div class="palette-progress-text"><span>Questions look good</span><strong id="pvOkText">0 / 0</strong></div>
          <div class="palette-progress-bar"><i id="pvOkFill"></i></div>
        </div>
        <div class="palette-legend">
          <div class="legend-item"><span class="legend-swatch sw-answered"></span>Looks good</div>
          <div class="legend-item"><span class="legend-swatch sw-notanswered"></span>Needs attention</div>
        </div>
        <div class="palette-grid" id="pvPaletteGrid"></div>
      </div>
      <div class="mobile-exam-actions">
        <button type="button" class="btn btn-secondary" id="pvPaletteToggle">Questions</button>
        <button type="button" class="btn btn-danger" id="pvCloseBtn2">Close preview</button>
      </div>
      <div class="palette-backdrop" id="pvBackdrop"></div>
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add("admin-preview-open");

  const close = () => closeTestPreview();
  el.querySelector("#pvCloseBtn").addEventListener("click", close);
  el.querySelector("#pvCloseBtn2").addEventListener("click", close);
  el.querySelector("#pvShowAnswers").addEventListener("change", (e) => {
    pv.showAnswers = e.target.checked;
    pvRenderQuestion();
  });
  const panel = el.querySelector("#pvPalettePanel");
  const backdrop = el.querySelector("#pvBackdrop");
  const togglePanel = (open) => {
    panel.classList.toggle("open", open);
    backdrop.classList.toggle("open", open);
  };
  el.querySelector("#pvPaletteToggle").addEventListener("click", () =>
    togglePanel(!panel.classList.contains("open")),
  );
  el.querySelector("#pvPaletteClose").addEventListener("click", () =>
    togglePanel(false),
  );
  backdrop.addEventListener("click", () => togglePanel(false));
  pv.closePanel = () => togglePanel(false);
  pv.onKey = (e) => {
    if (e.key === "Escape") closeTestPreview();
    else if (e.key === "ArrowRight") pvStep(1);
    else if (e.key === "ArrowLeft") pvStep(-1);
  };
  document.addEventListener("keydown", pv.onKey);

  pvRenderTabs();
  pvRenderQuestion();
}

async function pvRemoveQuestion(q) {
  if (!pv) return;
  const attempts = adminResultsRows.length;
  const warn = attempts
    ? `\n\n${attempts} student${attempts === 1 ? " has" : "s have"} already submitted this test. Their stored scores stay as they are, but this question will disappear from their review.`
    : "";
  if (!confirm(`Remove this question from the test? This can't be undone.${warn}`)) return;
  const { error } = await sb.from("questions").delete().eq("id", q.id);
  if (error) {
    toast(friendlyError(error), "error");
    return;
  }
  toast("Question removed", "success");
  const keepSubject = pv.subject;
  const keepIndex = pv.index;
  await Promise.all([loadQuestions(), loadReports()]);
  if (!adminQuestionsCache.length) {
    closeTestPreview();
    return;
  }
  const groups = pvGroupQuestions();
  pv.bySubj = groups.bySubj;
  pv.subjList = groups.subjList;
  if (groups.bySubj[keepSubject]) {
    pv.subject = keepSubject;
    pv.index = Math.min(keepIndex, groups.bySubj[keepSubject].length - 1);
  } else {
    pv.subject = groups.subjList[0];
    pv.index = 0;
  }
  const count = document.getElementById("pvCount");
  if (count)
    count.textContent = `Admin preview · ${adminQuestionsCache.length} questions`;
  pvRenderTabs();
  pvRenderQuestion();
}

function closeTestPreview() {
  if (!pv) return;
  document.removeEventListener("keydown", pv.onKey);
  document.getElementById("adminPreviewOverlay")?.remove();
  document.body.classList.remove("admin-preview-open");
  pv = null;
}

function pvRenderTabs() {
  const wrap = document.getElementById("pvSubjectTabs");
  wrap.innerHTML = pv.subjList
    .map(
      (sub) =>
        `<button type="button" data-subject="${escapeHtml(sub)}" class="${sub === pv.subject ? "active" : ""}">${subjectDot(sub)}${escapeHtml(sub)}</button>`,
    )
    .join("");
  wrap.querySelectorAll("button").forEach((btn) =>
    btn.addEventListener("click", () => {
      pv.subject = btn.dataset.subject;
      pv.index = 0;
      pvRenderTabs();
      pvRenderQuestion();
    }),
  );
}

function pvStep(delta) {
  if (!pv) return;
  const list = pv.bySubj[pv.subject];
  let next = pv.index + delta;
  if (next >= 0 && next < list.length) {
    pv.index = next;
  } else {
    // roll over into the previous / next subject
    const si = pv.subjList.indexOf(pv.subject) + (delta > 0 ? 1 : -1);
    if (si < 0 || si >= pv.subjList.length) return;
    pv.subject = pv.subjList[si];
    pv.index = delta > 0 ? 0 : pv.bySubj[pv.subject].length - 1;
    pvRenderTabs();
  }
  pvRenderQuestion();
}

function pvRenderPalette() {
  const list = pv.bySubj[pv.subject];
  const okCount = list.filter((q) => !pvQuestionIssues(q).length).length;
  document.getElementById("pvPaletteSubject").textContent = pv.subject;
  document.getElementById("pvOkText").textContent =
    `${okCount} / ${list.length}`;
  document.getElementById("pvOkFill").style.width = list.length
    ? `${(okCount / list.length) * 100}%`
    : "0%";
  const grid = document.getElementById("pvPaletteGrid");
  grid.innerHTML = list
    .map(
      (q, i) =>
        `<button type="button" class="palette-btn ${pvQuestionIssues(q).length ? "not_answered" : "answered"} ${i === pv.index ? "current" : ""} ${adminReports.some((r) => r.question_id === q.id) ? "pv-reported" : ""}" data-i="${i}" title="${q.question_type === "mcq" ? "MCQ" : "Integer"}${adminReports.some((r) => r.question_id === q.id) ? " · reported" : ""}">${i + 1}</button>`,
    )
    .join("");
  grid.querySelectorAll("button").forEach((btn) =>
    btn.addEventListener("click", () => {
      pv.index = parseInt(btn.dataset.i, 10);
      pv.closePanel();
      pvRenderQuestion();
    }),
  );
}

function pvRenderQuestion() {
  const list = pv.bySubj[pv.subject];
  const q = list[pv.index];
  const card = document.getElementById("pvQuestionCard");
  card.style.borderLeft = `4px solid ${subjectColor(q.subject)}`;
  const issues = pvQuestionIssues(q);
  const qReports = adminReports.filter((r) => r.question_id === q.id);
  const show = pv.showAnswers;

  let bodyHtml;
  if (q.question_type === "mcq") {
    bodyHtml =
      `<div class="option-list">` +
      (q.options || [])
        .map(
          (o) => `
      <div class="option-item ${show && q.correct_option === o.id ? "review-correct" : ""}">
        <span class="option-letter">${escapeHtml(o.id)}</span>
        <span class="option-text">${escapeHtml(o.text || "")}</span>
        ${show && q.correct_option === o.id ? '<span class="pv-correct-tag">✓ Correct</span>' : ""}
      </div>`,
        )
        .join("") +
      `</div>`;
  } else {
    bodyHtml = `
      <div class="integer-input-wrap"><input type="number" disabled placeholder="Enter value" value="${show && q.correct_integer_value != null ? escapeHtml(String(q.correct_integer_value)) : ""}"></div>
      ${show ? `<div class="pv-answer-line">Correct answer: <b>${q.correct_integer_value ?? "—"}</b></div>` : ""}`;
  }

  const isFirst = pv.subjList.indexOf(pv.subject) === 0 && pv.index === 0;
  const isLast =
    pv.subjList.indexOf(pv.subject) === pv.subjList.length - 1 &&
    pv.index === list.length - 1;

  card.innerHTML = `
    <div class="question-meta">
      <span class="question-number-badge">${subjectDot(q.subject)}${escapeHtml(q.subject)} · ${q.question_type === "mcq" ? "MCQ" : "Integer"} · Question ${pv.index + 1}</span>
      <span class="question-marks">+${q.positive_marks} / -${q.negative_marks}</span>
    </div>
    ${issues.length ? `<div class="pv-issues">⚠ ${issues.map(escapeHtml).join(" · ")}</div>` : ""}
    ${
      qReports.length
        ? `<div class="pv-reports"><strong>⚑ ${qReports.length} student report${qReports.length === 1 ? "" : "s"} on this question</strong><ul>${qReports
            .map(
              (r) =>
                `<li>${escapeHtml(r.reason)}${r.details ? ` — ${escapeHtml(r.details)}` : ""} <small>· ${escapeHtml(r.profiles?.full_name || "Student")}</small></li>`,
            )
            .join("")}</ul></div>`
        : ""
    }
    ${questionImageHtml(q.image_url)}
    <div class="question-text">${escapeHtml(q.question_text)}</div>
    ${bodyHtml}
    ${show && q.explanation ? `<div class="pv-explanation"><strong>Explanation</strong><div>${escapeHtml(q.explanation)}</div></div>` : ""}
    <div class="exam-actions">
      <div class="exam-actions-left">
        <button class="btn js-pv-edit">✏️ Edit</button>
        <button class="btn btn-danger js-pv-remove">🗑 Remove</button>
      </div>
      <div class="exam-actions-right">
        <button class="btn" id="pvPrev" ${isFirst ? "disabled" : ""}>← Previous</button>
        <button class="btn btn-success" id="pvNext" ${isLast ? "disabled" : ""}>Next →</button>
      </div>
    </div>`;
  card.querySelector("#pvPrev").addEventListener("click", () => pvStep(-1));
  card.querySelector("#pvNext").addEventListener("click", () => pvStep(1));
  card.querySelector(".js-pv-edit").addEventListener("click", () => {
    closeTestPreview();
    editQuestion(q);
  });
  card
    .querySelector(".js-pv-remove")
    .addEventListener("click", () => pvRemoveQuestion(q));
  renderMath(card);
  pvRenderPalette();
  document.getElementById("adminPreviewOverlay").scrollTo({ top: 0 });
}

document.addEventListener("click", (e) => {
  if (e.target.closest("#previewTestBtn")) openTestPreview();
});

function printMarkingSchemeSummary(list) {
  const combos = new Map();
  list.forEach((q) => {
    const key = `${q.question_type}|${q.positive_marks}|${q.negative_marks}`;
    if (!combos.has(key)) combos.set(key, q);
  });
  return [...combos.values()]
    .map(
      (q) =>
        `${q.question_type === "mcq" ? "MCQ" : "Integer"}: +${q.positive_marks} / -${q.negative_marks}`,
    )
    .join(" · ");
}

// Shared by both the admin's "Print / PDF" (full test) and the student's
// "Print question paper" (after they've submitted). Builds a blank paper —
// question + options only, no one's answers — followed by an answer key.
// `questions` items need: subject, question_type, question_text, image_url,
// options, positive_marks, negative_marks, correct_option, correct_integer_value.
// Returns an ordered list of layout blocks — {html, keepNext?, breakBefore?}.
// openPrintPreview() measures them and lays them onto separate A4 pages, so a
// question is never cut in half and a subject heading is never left alone at
// the bottom of a page.
function buildPrintPaperHtml(questions, meta) {
  const SUBJECT_ORDER = ["Physics", "Chemistry", "Mathematics", "Biology"];
  const subjectRank = (name) => {
    const idx = SUBJECT_ORDER.indexOf(name);
    return idx === -1 ? SUBJECT_ORDER.length : idx;
  };
  const groups = {};
  questions.forEach((q) => {
    const key = q.subject || "Other";
    (groups[key] = groups[key] || []).push(q);
  });
  const typeRank = (q) => (q.question_type === "mcq" ? 0 : 1);
  const subjectNames = Object.keys(groups).sort(
    (x, y) => subjectRank(x) - subjectRank(y) || x.localeCompare(y),
  );
  subjectNames.forEach((key) => {
    groups[key] = groups[key]
      .map((q, idx) => ({ q, idx }))
      .sort((a, b) => typeRank(a.q) - typeRank(b.q) || a.idx - b.idx)
      .map((x) => x.q);
  });

  const marking = printMarkingSchemeSummary(questions);
  const blocks = [
    {
      html: `
    <div class="print-promo">JEE Hustlers — practice smart, score high.</div>
    <h1 class="print-title">${escapeHtml(meta.title || "Test")}</h1>
    <div class="print-meta-row">
      <span><b>Duration:</b> ${escapeHtml(String(meta.durationMinutes ?? "—"))} minutes</span>
      <span><b>Syllabus:</b> ${escapeHtml(subjectNames.join(", "))}</span>
      <span><b>Marking scheme:</b> ${escapeHtml(marking)}</span>
    </div>
    <hr>`,
    },
  ];

  // Continuous numbering across the whole paper so the answer key at the end
  // can reference each question "in proper sequence" by that number.
  let n = 0;
  const answerKey = [];
  subjectNames.forEach((subject) => {
    blocks.push({
      html: `<h3 class="print-subject-title">${escapeHtml(subject)}</h3>`,
      keepNext: true,
    });
    groups[subject].forEach((q) => {
      n += 1;
      const ans =
        q.question_type === "mcq"
          ? q.correct_option || "—"
          : (q.correct_integer_value ?? "—");
      answerKey.push({ n, ans });
      const body =
        q.question_type === "mcq"
          ? `<div class="print-options">${(q.options || [])
              .map(
                (o) =>
                  `<div class="print-option"><span class="print-option-mark"></span>${escapeHtml(o.id)}. ${escapeHtml(o.text || "")}</div>`,
              )
              .join("")}</div>`
          : `<div class="print-integer-line">Answer: __________</div>`;
      blocks.push({
        html: `
        <div class="print-question">
          <div class="print-question-head">Q${n}. <span class="print-marks">[+${q.positive_marks} / -${q.negative_marks}]</span></div>
          <div class="print-question-text">${escapeHtml(q.question_text)}</div>
          ${questionImageHtml(q.image_url)}
          ${body}
        </div>`,
      });
    });
  });

  // Answer key always starts on a fresh page; very long keys continue on more.
  const PER_BLOCK = 66;
  for (let i = 0; i < answerKey.length; i += PER_BLOCK) {
    const cells = answerKey
      .slice(i, i + PER_BLOCK)
      .map((a) => `<div class="print-answer-cell"><b>${a.n}.</b> ${escapeHtml(String(a.ans))}</div>`)
      .join("");
    blocks.push({
      html: `${i === 0 ? '<h3 class="print-key-title">Answer Key</h3>' : ""}<div class="print-answer-grid">${cells}</div>`,
      breakBefore: i === 0,
    });
  }
  return blocks;
}

// ---- pagination ----
const PAPER = { W: 794, H: 1122, T: 46, B: 62, X: 52 }; // A4 @ 96dpi, in px
let printPreviewState = null;

async function waitForPaperAssets(root) {
  const imgs = [...root.querySelectorAll("img")].filter((i) => !i.complete);
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((res) => {
          img.addEventListener("load", res, { once: true });
          img.addEventListener("error", res, { once: true });
          setTimeout(res, 4000);
        }),
    ),
  );
  if (document.fonts?.ready)
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
}

function packPaperPages(items, bodyH) {
  const pages = [[]];
  let used = 0;
  for (let i = 0; i < items.length; ) {
    let j = i;
    let h = items[i].h;
    while (items[j].keepNext && j + 1 < items.length) {
      j += 1;
      h += items[j].h;
    }
    const current = pages[pages.length - 1];
    if (current.length && (items[i].breakBefore || used + h > bodyH)) {
      pages.push([]);
      used = 0;
    }
    for (let k = i; k <= j; k++) pages[pages.length - 1].push(items[k].html);
    used += h;
    i = j + 1;
  }
  return pages;
}

async function paginatePaper(blocks) {
  const measure = document.createElement("div");
  measure.className = "print-measure";
  measure.style.width = `${PAPER.W - PAPER.X * 2}px`;
  measure.innerHTML = blocks.map((b) => `<div class="print-block">${b.html}</div>`).join("");
  document.body.appendChild(measure);
  try {
    renderMath(measure); // maths first — it changes the heights
    await waitForPaperAssets(measure);
    const els = [...measure.children];
    const items = blocks.map((b, i) => ({
      html: els[i].innerHTML,
      h: els[i].getBoundingClientRect().height,
      keepNext: !!b.keepNext,
      breakBefore: !!b.breakBefore,
    }));
    return packPaperPages(items, PAPER.H - PAPER.T - PAPER.B - 6);
  } finally {
    measure.remove();
  }
}

function paperPagesHtml(pages, title, { wrap }) {
  return pages
    .map((p, i) => {
      const sheet = `<section class="print-page ${i > 0 ? "print-page-next" : ""}" aria-label="Page ${i + 1} of ${pages.length}">
        <div class="print-page-body">${p.join("")}</div>
        <div class="print-page-foot"><span>${escapeHtml(title || "")}</span><span>Page ${i + 1} of ${pages.length}</span></div>
      </section>`;
      return wrap ? `<div class="print-page-wrap">${sheet}</div>` : sheet;
    })
    .join("");
}

// Renders the paper once, on screen, inside a closable preview — nothing is
// sent to the printer until the student/admin explicitly clicks Download.
async function openPrintPreview(blocks, title) {
  document.getElementById("printPreviewOverlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "printPreviewOverlay";
  overlay.innerHTML = `
    <div class="print-preview-toolbar">
      <span class="print-preview-label">📄 ${escapeHtml(title || "Question paper")}<span class="print-pages-count" id="printPagesCount"></span></span>
      <div class="print-preview-actions">
        <button type="button" class="btn btn-sm btn-primary" id="printDownloadBtn" disabled>⬇ Download now</button>
        <button type="button" class="btn btn-sm" id="printCloseBtn">✕ Close</button>
      </div>
    </div>
    <div class="print-preview-scroll" id="printPreviewScroll">
      <div class="empty-state print-loading">Preparing pages…</div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("print-preview-open");

  const scroll = overlay.querySelector("#printPreviewScroll");
  const fit = () => {
    const scale = Math.min(1, (scroll.clientWidth - 24) / PAPER.W);
    scroll.style.setProperty("--pp-scale", String(Math.max(0.3, scale)));
  };
  const close = () => {
    window.removeEventListener("resize", fit);
    overlay.remove();
    printPreviewState = null;
    document.body.classList.remove("print-preview-open");
  };
  overlay.querySelector("#printCloseBtn").addEventListener("click", close);

  const pages = await paginatePaper(blocks);
  if (!document.body.contains(overlay)) return; // closed while preparing

  printPreviewState = { pages, title };
  scroll.innerHTML = paperPagesHtml(pages, title, { wrap: true });
  overlay.querySelector("#printPagesCount").textContent =
    `${pages.length} page${pages.length === 1 ? "" : "s"}`;
  fit();
  window.addEventListener("resize", fit);

  const dl = overlay.querySelector("#printDownloadBtn");
  dl.disabled = false;
  dl.addEventListener("click", (e) => downloadPaperPdf(title, e.currentTarget));
}

// One click, one file: renders the previewed paper to a real PDF and saves it
// straight to the user's device — no print dialog. The paper is cloned into an
// off-screen A4-width box first so the file looks the same in light/dark mode
// and on phones. Falls back to the browser print dialog only if the PDF
// library could not be loaded.
async function downloadPaperPdf(title, button) {
  const state = printPreviewState;
  if (!state?.pages?.length) return;
  if (typeof window.html2pdf !== "function") {
    toast("PDF engine unavailable — opening the print dialog instead. Choose “Save as PDF”.", "error");
    window.print();
    return;
  }
  const original = button ? button.innerHTML : "";
  if (button) {
    button.disabled = true;
    button.textContent = "Preparing PDF…";
  }
  // The same fixed A4 pages shown in the preview are rebuilt off-screen at
  // full size (no zoom), one page per PDF page.
  const host = document.createElement("div");
  host.className = "pdf-export-host";
  const root = document.createElement("div");
  root.className = "print-export-pages";
  root.innerHTML = paperPagesHtml(state.pages, state.title, { wrap: false });
  host.appendChild(root);
  document.body.appendChild(host);
  const slug =
    String(title || "question-paper")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "question-paper";
  try {
    await window
      .html2pdf()
      .set({
        margin: 0,
        filename: `${slug}-questions.pdf`,
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: PAPER.W,
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css"], before: ".print-page-next" },
      })
      .from(root)
      .save();
    toast("Your PDF has been downloaded", "success");
  } catch (err) {
    console.error("PDF export failed:", err);
    toast("Couldn't create the PDF. Please try again.", "error");
  } finally {
    host.remove();
    if (button) {
      button.disabled = false;
      button.innerHTML = original;
    }
  }
}

// Student-side: blank paper + answer key for a submitted test. Triggered from
// the "Print PDF" button on the dashboard / tests card, never from the report.
// Positive/negative marks come from get_test_questions (no answers in it);
// correct answers come from the student's own review — never their selections.
async function printAttemptPaper(attemptId, button) {
  const idle = button ? button.innerHTML : "";
  if (button) {
    button.disabled = true;
    button.textContent = "Preparing…";
  }
  const restore = () => {
    if (button) {
      button.disabled = false;
      button.innerHTML = idle;
    }
  };
  const [{ data: qData, error: qErr }, { data: review, error: rErr }] =
    await Promise.all([
      sb.rpc("get_test_questions", { p_attempt_id: attemptId }),
      sb.rpc("get_answer_review", { p_attempt_id: attemptId }),
    ]);
  restore();
  if (qErr || rErr || !qData?.length || !review?.length) {
    toast("Couldn't prepare the question paper.", "error");
    return;
  }
  const entry = (testsCatalogCache || []).find(
    (t) => t.myAttempt && t.myAttempt.id === attemptId,
  );
  const marksById = {};
  qData.forEach((q) => {
    marksById[q.id] = q;
  });
  const merged = review
    .filter((r) => marksById[r.question_id])
    .map((r) => ({
      subject: r.subject,
      question_type: r.question_type,
      question_text: r.question_text,
      image_url: r.image_url,
      options: r.options,
      correct_option: r.correct_option,
      correct_integer_value: r.correct_integer_value,
      positive_marks: marksById[r.question_id].positive_marks,
      negative_marks: marksById[r.question_id].negative_marks,
    }));
  const title = entry?.title || "Question paper";
  openPrintPreview(
    buildPrintPaperHtml(merged, {
      title,
      durationMinutes: entry?.duration_minutes,
    }),
    title,
  );
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-print-attempt]");
  if (btn) printAttemptPaper(btn.dataset.printAttempt, btn);
});

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

/* =========================================================================
   ADMIN — Student results with time analysis (cheat-spotting aid)
   ========================================================================= */
let adminResultsRows = [];
let adminResultsFlags = new Map();
let adminResultsStats = null;
const adminResultsView = { q: "", filter: "all", sort: "rank" };
const adminExpandedRows = new Set();

/* Heuristic only — it surfaces attempts worth a closer look. It never
   disqualifies anyone by itself; the admin always makes the call. */
function analyseTimeFlags(rows) {
  const flags = new Map();
  const eligible = rows.filter(
    (r) => !r.disqualified_at && chNum(r.total_time_seconds) > 0,
  );
  const stats = {
    n: eligible.length,
    ready: eligible.length >= 3,
    medianTime: 0,
    medianScore: 0,
    subjectMedians: {},
  };
  if (!eligible.length) return { flags, stats };

  const times = eligible.map((r) => chNum(r.total_time_seconds));
  const scores = eligible.map((r) => chNum(r.total_score));
  stats.medianTime = chMedian(times);
  stats.medianScore = chMedian(scores);
  const bySubject = {};
  eligible.forEach((r) =>
    (r.subject_times || []).forEach((s) => {
      (bySubject[s.subject] = bySubject[s.subject] || []).push(chNum(s.seconds));
    }),
  );
  Object.keys(bySubject).forEach((k) => {
    stats.subjectMedians[k] = chMedian(bySubject[k]);
  });
  const p75Score = chQuantile(scores, 0.75);
  const p25Time = chQuantile(times, 0.25);

  eligible.forEach((r) => {
    const t = chNum(r.total_time_seconds);
    const sc = chNum(r.total_score);
    const answered = chNum(r.correct_count) + chNum(r.wrong_count);
    const acc = answered ? chNum(r.correct_count) / answered : 0;
    const reasons = [];
    let level = null;

    if (stats.ready && sc > 0 && sc >= stats.medianScore && t < stats.medianTime * 0.4) {
      reasons.push(
        `Finished in ${Math.round((t / stats.medianTime) * 100)}% of the median time (${chMinutesLabel(stats.medianTime)}) with an above-median score.`,
      );
      level = "high";
    } else if (eligible.length >= 4 && sc > 0 && sc >= p75Score && t <= p25Time) {
      reasons.push("Top-quartile score achieved in bottom-quartile time.");
      level = "med";
    }
    if (answered >= 10 && t / answered < 15 && acc >= 0.8) {
      reasons.push(
        `Only ${Math.round(t / answered)}s per answered question at ${Math.round(acc * 100)}% accuracy.`,
      );
      level = "high";
    }
    if (reasons.length) flags.set(r.attempt_id, { level, reasons });
  });
  return { flags, stats };
}

function resultsInsightsHtml() {
  const rows = adminResultsRows;
  const stats = adminResultsStats;
  const eligible = rows.filter((r) => chNum(r.total_time_seconds) > 0);
  if (!eligible.length) return "";
  const live = eligible.filter((r) => !r.disqualified_at);
  const fastest = live.slice().sort((a, b) => a.total_time_seconds - b.total_time_seconds)[0];
  const slowest = live.slice().sort((a, b) => b.total_time_seconds - a.total_time_seconds)[0];
  const flaggedCount = adminResultsFlags.size;
  const dqCount = rows.filter((r) => r.disqualified_at).length;

  const tile = (label, value, sub = "", cls = "") =>
    `<div class="insight-tile ${cls}"><span>${label}</span><strong>${value}</strong>${sub ? `<small>${sub}</small>` : ""}</div>`;

  return `
    <div class="insight-grid">
      ${tile("Submissions", rows.length, dqCount ? `${dqCount} disqualified` : "")}
      ${tile("Median time", live.length ? chMinutesLabel(stats.medianTime) : "—", live.length ? `Median score ${Math.round(stats.medianScore * 10) / 10}` : "")}
      ${fastest ? tile("Fastest finish", chMinutesLabel(fastest.total_time_seconds), escapeHtml(fastest.full_name || "Student")) : ""}
      ${slowest ? tile("Slowest finish", chMinutesLabel(slowest.total_time_seconds), escapeHtml(slowest.full_name || "Student")) : ""}
      ${tile("Needs review", flaggedCount, flaggedCount ? "Suspiciously quick" : "No unusual timing", flaggedCount ? "alert" : "")}
    </div>`;
}

function resultDetailHtml(r) {
  const total = chNum(r.total_time_seconds);
  const tracked = chNum(r.tracked_time_seconds);
  const flag = adminResultsFlags.get(r.attempt_id);
  const meds = adminResultsStats?.subjectMedians || {};
  const subj = (r.subject_times || [])
    .slice()
    .sort((a, b) => subjectSortRank(a.subject) - subjectSortRank(b.subject));
  const cards = subj
    .map((s) => {
      const sec = chNum(s.seconds);
      const share = tracked ? (sec / tracked) * 100 : 0;
      const med = chNum(meds[s.subject]);
      const ratio = med > 0 ? sec / med : null;
      const att = chNum(s.correct) + chNum(s.wrong);
      const ratioHtml =
        ratio === null
          ? ""
          : `<span class="vs ${ratio < 0.4 ? "low" : ratio > 1.8 ? "high" : ""}">${ratio.toFixed(1)}× class median (${chMinutesLabel(med)})</span>`;
      return `<div class="subject-time-card">
        <div class="subject-time-head"><span>${subjectDot(s.subject)}${escapeHtml(s.subject)}</span><strong>${chMinutesLabel(sec)}</strong></div>
        ${analyticsBar(share, 100, subjectColor(s.subject))}
        <div class="subject-time-meta">
          <span>${Math.round(share)}% of question time</span>${ratioHtml}
        </div>
        <div class="subject-time-meta">
          <span><b class="c-ok">${chNum(s.correct)}</b> correct · <b class="c-bad">${chNum(s.wrong)}</b> wrong · ${chNum(s.unattempted)} skipped</span>
          <span>${att ? chMinutesLabel(sec / att) + " / answer" : "—"}</span>
        </div>
        <div class="subject-time-meta"><span>Marks ${chNum(s.marks)} / ${chNum(s.total)}</span></div>
      </div>`;
    })
    .join("");

  return `
    <div class="result-detail">
      ${
        flag
          ? `<div class="flag-box ${flag.level}"><strong>${flag.level === "high" ? "⚠ Unusual timing" : "Worth a closer look"}</strong><ul>${flag.reasons.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul><small>This is an automatic hint, not proof — check the answers before removing anyone.</small></div>`
          : ""
      }
      ${
        r.disqualified_at
          ? `<div class="flag-box dq"><strong>Disqualified ${formatDateTime(r.disqualified_at)}</strong>${r.disqualification_reason ? `<p>${escapeHtml(r.disqualification_reason)}</p>` : ""}</div>`
          : ""
      }
      <div class="detail-meta">
        <span><b>Overall time</b> ${total ? formatDurationPrecise(total) : "—"}</span>
        <span><b>Started</b> ${r.started_at ? formatDateTime(r.started_at) : "—"}</span>
        <span><b>Submitted</b> ${r.submitted_at ? formatDateTime(r.submitted_at) : "—"}</span>
        <span><b>Time on questions</b> ${tracked ? formatDurationPrecise(tracked) : "—"}</span>
      </div>
      <div class="subject-time-grid">${cards || `<span class="text-muted">No subject timing recorded.</span>`}</div>
    </div>`;
}

// The expanded "time" panel sits inside the table, so it is pinned to the
// left edge and given the visible width — it stays readable while the table
// scrolls sideways.
function syncResultsScrollWidth() {
  const scroller = document
    .getElementById("studentResultsTable")
    ?.closest(".table-scroll");
  if (scroller) scroller.style.setProperty("--scroll-w", `${scroller.clientWidth}px`);
}
window.addEventListener("resize", syncResultsScrollWidth);

function formatShortDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function renderStudentResultsTable() {
  const body = document.getElementById("studentResultsBody");
  if (!body) return;
  const { q, filter, sort } = adminResultsView;
  const needle = q.trim().toLowerCase();
  let rows = adminResultsRows.filter((r) => {
    if (needle && !(r.full_name || "").toLowerCase().includes(needle)) return false;
    if (filter === "flagged") return adminResultsFlags.has(r.attempt_id);
    if (filter === "dq") return !!r.disqualified_at;
    return true;
  });
  const by = {
    rank: (a, b) =>
      (a.rnk ?? 1e9) - (b.rnk ?? 1e9) ||
      (a.full_name || "").localeCompare(b.full_name || ""),
    recent: (a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0),
    score: (a, b) => chNum(b.total_score) - chNum(a.total_score),
    fastest: (a, b) => (chNum(a.total_time_seconds) || 1e12) - (chNum(b.total_time_seconds) || 1e12),
    slowest: (a, b) => chNum(b.total_time_seconds) - chNum(a.total_time_seconds),
    name: (a, b) => (a.full_name || "").localeCompare(b.full_name || ""),
  }[sort];
  rows = rows.slice().sort(by);

  const countTag = document.getElementById("resultsCountTag");
  if (countTag)
    countTag.textContent = `${adminResultsRows.length} submission${adminResultsRows.length === 1 ? "" : "s"}`;

  if (!rows.length) {
    body.innerHTML = `<tr class="results-empty"><td colspan="10" class="text-muted">${adminResultsRows.length ? "No students match this filter." : "No attempts yet."}</td></tr>`;
    return;
  }

  syncResultsScrollWidth();
  body.innerHTML = rows
    .map((r) => {
      const dq = !!r.disqualified_at;
      const fl = adminResultsFlags.get(r.attempt_id);
      const open = adminExpandedRows.has(r.attempt_id);
      const rankCell = dq
        ? `<span class="rank-na" title="Not ranked">—</span>`
        : r.rnk
          ? `<span class="rank-pill">${medalFor(r.rnk)}#${r.rnk}</span>`
          : "—";
      const pctCell =
        dq || r.percentile === null || r.percentile === undefined
          ? "—"
          : `${Number(r.percentile).toFixed(2)}%`;
      const timeCell = chNum(r.total_time_seconds)
        ? `<div class="time-cell"><strong>${chMinutesLabel(r.total_time_seconds)}</strong>${
            fl
              ? `<span class="flag-chip ${fl.level}" title="${escapeHtml(fl.reasons.join(" "))}">${fl.level === "high" ? "⚠ Very fast" : "Quick"}</span>`
              : ""
          }</div>`
        : "—";
      return `
      <tr class="result-row ${dq ? "row-dq" : ""} ${open ? "row-open" : ""} ${dq ? "" : rankRowClass(r.rnk)}">
        <td data-label="Rank" class="rank-td">${rankCell}</td>
        <td data-label="Student" class="student-td"><div class="student-cell"><strong>${escapeHtml(String(r.full_name || "").trim())}</strong><div class="student-tags">${dq ? `<span class="status-tag dq-tag">Disqualified</span>` : ""}<span class="status-tag ${r.status}">${r.status.replace("_", " ")}</span></div></div></td>
        <td data-label="Score"><strong>${r.total_score}</strong><small class="text-muted"> / ${r.total_marks}</small></td>
        <td data-label="Correct" class="num c-ok">${r.correct_count}</td>
        <td data-label="Wrong" class="num c-bad">${r.wrong_count}</td>
        <td data-label="Unanswered" class="num">${r.unanswered_count ?? 0}</td>
        <td data-label="Percentile" class="num">${pctCell}</td>
        <td data-label="Time taken">${timeCell}</td>
        <td data-label="Submitted" class="submitted-td">${r.submitted_at ? formatShortDateTime(r.submitted_at) : "—"}</td>
        <td class="row-actions"><div class="row-actions-inner">
          <button type="button" class="btn btn-sm js-toggle-detail" data-id="${r.attempt_id}" aria-expanded="${open}" title="Subject-wise and overall time taken">Time ${open ? "▴" : "▾"}</button>
          <a class="btn btn-sm" href="#/result?attempt=${encodeURIComponent(r.attempt_id)}">Report</a>
          ${
            dq
              ? `<button type="button" class="btn btn-sm js-reinstate" data-id="${r.attempt_id}">Reinstate</button>`
              : `<button type="button" class="btn btn-sm btn-danger js-dq" data-id="${r.attempt_id}" data-name="${escapeHtml(r.full_name || "this student")}">Remove</button>`
          }
        </div></td>
      </tr>
      <tr class="result-detail-row" ${open ? "" : "hidden"} data-detail="${r.attempt_id}"><td colspan="10">${open ? resultDetailHtml(r) : ""}</td></tr>`;
    })
    .join("");
}

function bindResultsControls() {
  const card = document.getElementById("studentResultsCard");
  if (!card || card.dataset.bound) return;
  card.dataset.bound = "1";
  document.getElementById("resultsSearch")?.addEventListener("input", (e) => {
    adminResultsView.q = e.target.value;
    renderStudentResultsTable();
  });
  document.getElementById("resultsFilter")?.addEventListener("change", (e) => {
    adminResultsView.filter = e.target.value;
    renderStudentResultsTable();
  });
  document.getElementById("resultsSort")?.addEventListener("change", (e) => {
    adminResultsView.sort = e.target.value;
    renderStudentResultsTable();
  });
  card.addEventListener("click", async (e) => {
    const toggle = e.target.closest(".js-toggle-detail");
    if (toggle) {
      const id = toggle.dataset.id;
      if (adminExpandedRows.has(id)) adminExpandedRows.delete(id);
      else adminExpandedRows.add(id);
      renderStudentResultsTable();
      return;
    }
    const dqBtn = e.target.closest(".js-dq");
    if (dqBtn) return removeAttempt(dqBtn.dataset.id, dqBtn, dqBtn.dataset.name);
    const reBtn = e.target.closest(".js-reinstate");
    if (reBtn) return reinstateAttempt(reBtn.dataset.id, reBtn);
  });
}

async function loadStudentResults() {
  const statusEl = document.getElementById("resultDeclarationStatus");
  const actionsEl = document.getElementById("resultDeclarationActions");
  const body = document.getElementById("studentResultsBody");
  const insightsEl = document.getElementById("timeInsights");
  bindResultsControls();

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
    };
  }

  body.innerHTML = `<tr class="results-empty"><td colspan="10" class="text-muted">Loading results…</td></tr>`;
  const { data, error } = await sb.rpc("admin_get_test_results", {
    p_test_id: currentTest.id,
  });
  if (error) {
    body.innerHTML = `<tr class="results-empty"><td colspan="10" class="text-muted">${escapeHtml(friendlyError(error))}</td></tr>`;
    if (insightsEl) insightsEl.innerHTML = "";
    return;
  }
  adminResultsRows = (data || []).map((r) => ({
    ...r,
    total_score: chNum(r.total_score),
    total_marks: chNum(r.total_marks),
    correct_count: chNum(r.correct_count),
    wrong_count: chNum(r.wrong_count),
    unanswered_count: chNum(r.unanswered_count),
    total_time_seconds: chNum(r.total_time_seconds),
    tracked_time_seconds: chNum(r.tracked_time_seconds),
    subject_times: Array.isArray(r.subject_times) ? r.subject_times : [],
    rnk: r.rnk === null || r.rnk === undefined ? null : Number(r.rnk),
    percentile:
      r.percentile === null || r.percentile === undefined
        ? null
        : Number(r.percentile),
  }));
  const analysed = analyseTimeFlags(adminResultsRows);
  adminResultsFlags = analysed.flags;
  adminResultsStats = analysed.stats;
  if (insightsEl) insightsEl.innerHTML = resultsInsightsHtml();
  renderStudentResultsTable();
  renderAdminSummary();
}


/* ---- Disqualify / reinstate ---- */
function askDisqualify(name) {
  return new Promise((resolve) => {
    const textEl = document.getElementById("dqModalText");
    const reasonEl = document.getElementById("dqReason");
    const okBtn = document.getElementById("dqConfirmBtn");
    const cancelBtn = document.getElementById("dqCancelBtn");
    const backdrop = document.getElementById("dqModal");
    textEl.textContent = `${name}'s attempt will be removed from every leaderboard and their rank and percentile will be withheld. They will see a cheating notice on their report; their score and answer review stay visible. You can reinstate the attempt later.`;
    reasonEl.value = "";
    openModal("dqModal");
    reasonEl.focus();
    const finish = (result) => {
      closeModal("dqModal");
      okBtn.onclick = cancelBtn.onclick = backdrop.onclick = null;
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === "Escape") finish({ confirmed: false });
    };
    document.addEventListener("keydown", onKey);
    okBtn.onclick = () => finish({ confirmed: true, reason: reasonEl.value.trim() });
    cancelBtn.onclick = () => finish({ confirmed: false });
    backdrop.onclick = (e) => {
      if (e.target === backdrop) finish({ confirmed: false });
    };
  });
}

async function refreshAdminResultViews() {
  await loadStudentResults();
}

async function removeAttempt(id, button, name = "this student") {
  if (!id) {
    toast("Could not identify this attempt. Refresh and try again.", "error");
    return;
  }
  const { confirmed, reason } = await askDisqualify(name);
  if (!confirmed) return;

  const original = button ? button.textContent : "";
  if (button) {
    button.disabled = true;
    button.textContent = "Removing…";
  }
  try {
    const { error } = await sb.rpc("admin_disqualify_attempt", {
      p_attempt_id: id,
      p_reason: reason || null,
    });
    if (error) {
      console.error("admin_disqualify_attempt error:", error);
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
      toast(friendlyError(error), "error");
      return;
    }
    toast(`${name} was disqualified and removed from the leaderboard`, "success");
    await refreshAdminResultViews();
  } catch (err) {
    console.error("Unexpected remove attempt error:", err);
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
    toast("Something went wrong while removing the student.", "error");
  }
}

async function reinstateAttempt(id, button) {
  if (!id) return;
  if (
    !confirm(
      "Reinstate this attempt? It will return to the leaderboard and the student's rank and percentile will be visible again.",
    )
  )
    return;
  if (button) {
    button.disabled = true;
    button.textContent = "Reinstating…";
  }
  const { error } = await sb.rpc("admin_reinstate_attempt", { p_attempt_id: id });
  if (error) {
    toast(friendlyError(error), "error");
    if (button) {
      button.disabled = false;
      button.textContent = "Reinstate";
    }
    return;
  }
  toast("Attempt reinstated", "success");
  await refreshAdminResultViews();
}

async function loadReports() {
  const list = document.getElementById("reportsList");
  if (!currentTest || !list) return;
  const { data, error } = await sb
    .from("question_reports")
    .select(
      "id, question_id, reason, details, created_at, questions(question_text, subject, question_type), profiles(full_name)",
    )
    .eq("test_id", currentTest.id)
    .order("created_at", { ascending: false });
  if (error) {
    list.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error))}</div>`;
    return;
  }
  adminReports = data || [];
  const tag = document.getElementById("reportsCountTag");
  if (tag)
    tag.textContent = adminReports.length
      ? `${adminReports.length} report${adminReports.length === 1 ? "" : "s"}`
      : "";
  renderAdminSummary();
  list.innerHTML = !adminReports.length
    ? `<div class="empty-state">No question reports yet.</div>`
    : adminReports
        .map((r) => {
          const exists = adminQuestionsCache.some((q) => q.id === r.question_id);
          return `
    <div class="list-row report-row">
      <div class="list-row-main">
        <div class="list-row-title">${escapeHtml(r.reason)}</div>
        <div class="list-row-meta">${escapeHtml(r.profiles?.full_name || "Student")} · ${formatDateTime(r.created_at)}${r.questions?.subject ? " · " + escapeHtml(r.questions.subject) : ""}${r.details ? " · " + escapeHtml(r.details) : ""}</div>
        <div class="question-text report-question-text">${escapeHtml(r.questions?.question_text || "This question has been removed.")}</div>
      </div>
      <div class="list-row-actions">
        <button type="button" class="btn btn-sm btn-primary js-report-preview" data-question="${r.question_id}" ${exists ? "" : "disabled"}>👁 Preview question</button>
      </div>
    </div>`;
        })
        .join("");
  renderMath(list);
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".js-report-preview");
  if (btn && !btn.disabled) openTestPreview(btn.dataset.question);
});

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
    ${
      pendingIsPractice
        ? `<div class="practice-notice">🔁 <strong>Practice re-attempt</strong> — this run is for your own revision only. It will not affect your rank, percentile, or appear on any leaderboard.</div>`
        : ""
    }

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
        <div class="legend-item"><span class="legend-swatch sw-notvisited"></span>Not visited</div>
        <div class="legend-item"><span class="legend-swatch sw-notanswered"></span>Not answered</div>
        <div class="legend-item"><span class="legend-swatch sw-answered"></span>Answered</div>
        <div class="legend-item"><span class="legend-swatch sw-marked"></span>Marked for review</div>
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
let pendingIsPractice = false;

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
  pendingIsPractice = qs("practice") === "1";

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
        .eq("is_practice", pendingIsPractice)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  // A practice re-attempt is personal revision: it isn't bound by the
  // test's publish/close window (the student already completed the real,
  // scheduled attempt to unlock it in the first place).
  if (
    testMetaError ||
    !testMeta ||
    !testMeta.is_published ||
    (!pendingIsPractice &&
      (Date.now() < new Date(testMeta.available_from).getTime() ||
        Date.now() >= new Date(testMeta.available_until).getTime()))
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

  if (!pendingIsPractice && previousAttempt?.disqualified_at) {
    showTerminal(
      "Test access removed",
      "An administrator has removed you from this test. Contact your admin if you believe this is a mistake.",
      "#/tests",
      "Back to Tests",
    );
    return;
  }
  if (
    !pendingIsPractice &&
    ["submitted", "auto_submitted"].includes(previousAttempt?.status)
  ) {
    showTerminal(
      "Test already attempted",
      "You have already submitted this test. You cannot start it again, but you can view your report or start a practice re-attempt from it.",
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
    `${escapeHtml(testTitle)} ${categoryBadge(testCategory)}${pendingIsPractice ? ' <span class="practice-badge">🔁 Practice</span>' : ""}`;
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

function updatePaletteSummary(list) {
  const count = (fn) => list.filter(fn).length;
  const answered = count(
    (q) => q.status === "answered" || q.status === "answered_marked",
  );
  const marked = count(
    (q) => q.status === "marked" || q.status === "answered_marked",
  );
  const notVisited = count((q) => q.status === "not_visited");
  const notAnswered = count((q) => q.status === "not_answered");
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("paletteSubjectLabel", currentSubject || "");
  set("paletteProgressText", `${answered} / ${list.length}`);
  set("palCountNotVisited", notVisited);
  set("palCountNotAnswered", notAnswered);
  set("palCountAnswered", answered);
  set("palCountMarked", marked);
  const fill = document.getElementById("paletteProgressFill");
  if (fill)
    fill.style.width = list.length
      ? `${(answered / list.length) * 100}%`
      : "0%";
}

function renderPalette() {
  const grid = document.getElementById("paletteGrid");
  const list = bySubject[currentSubject] || [];
  updatePaletteSummary(list);
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
  const { data, error } = pendingIsPractice
    ? await sb.rpc("start_practice_attempt", { p_test_id: pendingTestId })
    : await sb.rpc("start_attempt_by_test", { p_test_id: pendingTestId });

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

/* =========================================================================
   CHART KIT — dependency-free, theme-aware SVG charts.
   Every colour is a CSS variable (or a class in style.css), so the same
   markup renders correctly in both light and dark mode.
   ========================================================================= */
let chartUid = 0;
const chNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const chClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const chShortDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};
const chMedian = (arr) => {
  const a = arr.filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const chQuantile = (arr, q) => {
  const a = arr.filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
};
function chMinutesLabel(seconds) {
  const s = Math.max(0, Math.round(chNum(seconds)));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
function chNiceCeil(v) {
  if (v <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function chartLegend(items) {
  return `<div class="ch-legend">${items
    .map(
      (i) =>
        `<span><i class="ch-swatch ${i.dashed ? "dashed" : ""} ${i.round ? "round" : ""}" style="--sw:${i.color}"></i>${escapeHtml(i.label)}${i.value !== undefined ? ` <b>${escapeHtml(String(i.value))}</b>` : ""}</span>`,
    )
    .join("")}</div>`;
}

/* Compact bar graph of percentages (0-100). Pure HTML/CSS so it always fits
   its card — no horizontal scrolling on desktop or phones.
   rows: [{label, sub, value, tip, latest}] */
function chartTrendBars(rows, { avgLine = null } = {}) {
  const gridLines = [0, 25, 50, 75, 100]
    .map((g) => `<i style="bottom:${g}%"></i>`)
    .join("");
  const axis = [100, 75, 50, 25, 0].map((g) => `<span>${g}%</span>`).join("");
  const cols = rows
    .map(
      (r) => `<div class="tb-col" title="${escapeHtml(r.tip || "")}" style="--v:${chClamp(r.value, 0, 100)}">
        <span class="tb-val">${Math.round(r.value)}%</span>
        <div class="tb-bar ${r.latest ? "latest" : ""}"></div>
      </div>`,
    )
    .join("");
  const labels = rows
    .map((r) => `<span><b>${escapeHtml(r.label)}</b>${escapeHtml(r.sub || "")}</span>`)
    .join("");
  return `<div class="tb-chart" role="img" aria-label="Score trend bar chart">
    <div class="tb-axis">${axis}</div>
    <div class="tb-plot">
      <div class="tb-grid">${gridLines}</div>
      ${avgLine !== null ? `<div class="tb-avg" style="--a:${chClamp(avgLine, 0, 100)}"></div>` : ""}
      <div class="tb-bars">${cols}</div>
    </div>
    <div class="tb-spacer"></div>
    <div class="tb-labels">${labels}</div>
  </div>`;
}

/* Donut. segments: [{value,color,label}] */
function chartDonut(segments, { size = 176, stroke = 22, centerValue = "", centerLabel = "" } = {}) {
  const total = segments.reduce((s, x) => s + chNum(x.value), 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const live = segments.filter((s) => chNum(s.value) > 0);
  const gap = live.length > 1 ? 3 : 0;
  let acc = 0;
  const arcs = total
    ? live
        .map((s) => {
          const len = Math.max(0, (chNum(s.value) / total) * c - gap);
          const el = `<circle class="ch-arc" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" style="--arc:${s.color}" transform="rotate(-90 ${size / 2} ${size / 2})"><title>${escapeHtml(s.label || "")}: ${chNum(s.value)}</title></circle>`;
          acc += (chNum(s.value) / total) * c;
          return el;
        })
        .join("")
    : "";
  return `<div class="ch-donut" style="--d:${size}px">
    <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Donut chart">
      <circle class="ch-donut-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      ${arcs}
    </svg>
    <div class="ch-donut-center"><strong>${centerValue}</strong><span>${escapeHtml(centerLabel)}</span></div>
  </div>`;
}

/* Horizontal stacked bar (HTML, fully responsive). parts: [{value,color,label}] */
function chartStackBar(parts, { height = 10 } = {}) {
  const total = parts.reduce((s, p) => s + chNum(p.value), 0);
  if (!total) return `<div class="ch-stack" style="--h:${height}px"></div>`;
  return `<div class="ch-stack" style="--h:${height}px">${parts
    .filter((p) => chNum(p.value) > 0)
    .map(
      (p) =>
        `<span style="width:${(chNum(p.value) / total) * 100}%;background:${p.color}" title="${escapeHtml(p.label || "")}: ${chNum(p.value)}"></span>`,
    )
    .join("")}</div>`;
}

/* Per-question timeline: one bar per question, height = seconds, colour = outcome.
   items: [{n, seconds, state:'correct'|'wrong'|'skipped', subject}] */
function chartQuestionTimeline(items) {
  const n = items.length;
  const W = Math.max(820, n * 15 + 80);
  const H = 250;
  const pl = 44;
  const pr = 14;
  const pt = 16;
  const pb = 46;
  const iw = W - pl - pr;
  const ih = H - pt - pb;
  const maxSec = Math.max(30, Math.ceil((Math.max(...items.map((i) => chNum(i.seconds)), 10) * 1.1) / 30) * 30);
  const slot = iw / n;
  const bw = Math.max(3, Math.min(20, slot * 0.68));
  const y = (v) => pt + ih - (chNum(v) / maxSec) * ih;
  const colour = { correct: "var(--success)", wrong: "var(--danger)", skipped: "var(--not-visited)" };
  const avg = items.reduce((s, i) => s + chNum(i.seconds), 0) / n;

  const grid = [0, 0.5, 1]
    .map((f) => {
      const v = maxSec * f;
      return (
        `<line class="ch-grid" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/>` +
        `<text class="ch-tick" x="${pl - 8}" y="${y(v) + 4}" text-anchor="end">${chMinutesLabel(v)}</text>`
      );
    })
    .join("");

  const bars = items
    .map((it, i) => {
      const bx = pl + slot * i + (slot - bw) / 2;
      const by = y(it.seconds);
      const h = Math.max(it.seconds > 0 ? 2 : 0, pt + ih - by);
      return `<rect class="ch-bar" x="${bx.toFixed(1)}" y="${(pt + ih - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" style="--bar:${colour[it.state]}"><title>Q${it.n} · ${escapeHtml(it.subject || "")} · ${chMinutesLabel(it.seconds)} · ${it.state}</title></rect>`;
    })
    .join("");

  // Subject strip under the axis
  let strip = "";
  let runStart = 0;
  items.forEach((it, i) => {
    const last = i === n - 1 || items[i + 1].subject !== it.subject;
    if (last) {
      const x1 = pl + slot * runStart + 1;
      const x2 = pl + slot * (i + 1) - 1;
      strip += `<rect x="${x1.toFixed(1)}" y="${H - pb + 10}" width="${Math.max(1, x2 - x1).toFixed(1)}" height="5" rx="2.5" fill="${subjectColor(it.subject)}"/>`;
      if (x2 - x1 > 56)
        strip += `<text class="ch-tick" x="${((x1 + x2) / 2).toFixed(1)}" y="${H - pb + 32}" text-anchor="middle">${escapeHtml(it.subject || "")}</text>`;
      runStart = i + 1;
    }
  });

  return `<div class="ch-scroll"><svg class="ch-svg" viewBox="0 0 ${W} ${H}" style="min-width:${Math.min(W, 1100)}px" role="img" aria-label="Time per question">
    ${grid}
    <line class="ch-avg" x1="${pl}" x2="${W - pr}" y1="${y(avg)}" y2="${y(avg)}"/>
    ${bars}${strip}
  </svg></div>`;
}

const SUBJECT_SORT = ["Physics", "Chemistry", "Mathematics", "Biology"];
const subjectSortRank = (s) => {
  const i = SUBJECT_SORT.indexOf(s);
  return i === -1 ? SUBJECT_SORT.length : i;
};

function outcomeLegend(correct, wrong, skipped) {
  return chartLegend([
    { label: "Correct", value: correct, color: "var(--success)", round: true },
    { label: "Wrong", value: wrong, color: "var(--danger)", round: true },
    { label: "Unattempted", value: skipped, color: "var(--not-visited)", round: true },
  ]);
}

const SUPPORT_EMAIL = "shobhitdwivedi.in@gmail.com";

// Pre-filled email so a disqualified student can raise a query in one tap.
function buildQueryLinks(report) {
  const title = report.test_title || "Test";
  const subject = `Query about my disqualified attempt - ${title}`;
  const body = [
    "Hello,",
    "",
    "I would like to raise a query about my disqualified attempt.",
    "",
    `Name: ${report.full_name || ""}`,
    `Test: ${title}`,
    `Attempt ID: ${report.attempt_id || ""}`,
    `Submitted: ${report.submitted_at ? new Date(report.submitted_at).toLocaleString() : ""}`,
    "",
    "My query:",
    "",
  ].join("\n");
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return {
    mailto: `mailto:${SUPPORT_EMAIL}?${q}`,
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}

function renderReportAnalysis(report, subjectRows, review) {
  const totalMax = subjectRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const scorePct =
    totalMax > 0
      ? chClamp((Number(report.total_score || 0) / totalMax) * 100, 0, 100)
      : 0;
  const correct = review.filter((r) => r.is_correct === true).length;
  const wrong = review.filter((r) => r.is_correct === false).length;
  const skipped = Math.max(0, review.length - correct - wrong);
  const attempted = correct + wrong;
  const accuracy = attempted ? (correct / attempted) * 100 : 0;
  const totalTime = subjectRows.reduce((s, r) => s + chNum(r.time_spent_seconds), 0);

  const subjectBreakdown = subjectRows
    .map((row) => {
      const c = chNum(row.correct_count);
      const w = chNum(row.wrong_count);
      const u = chNum(row.unattempted);
      const acc = c + w ? Math.round((c / (c + w)) * 100) : null;
      return `<div class="subject-performance-row">
        <div class="subject-performance-label"><span>${subjectDot(row.subject)}${escapeHtml(row.subject)}</span><strong>${row.obtained} / ${row.total}</strong></div>
        ${chartStackBar([
          { value: c, color: "var(--success)", label: "Correct" },
          { value: w, color: "var(--danger)", label: "Wrong" },
          { value: u, color: "var(--not-visited)", label: "Unattempted" },
        ])}
        <small class="ch-sub">${c} correct · ${w} wrong · ${u} unattempted · ${acc === null ? "no accuracy yet" : `${acc}% accuracy`}</small>
      </div>`;
    })
    .join("");

  const timeRows = subjectRows
    .map((row) => {
      const t = chNum(row.time_spent_seconds);
      const share = totalTime ? (t / totalTime) * 100 : 0;
      const att = chNum(row.correct_count) + chNum(row.wrong_count);
      return `<div class="subject-performance-row">
        <div class="subject-performance-label"><span>${subjectDot(row.subject)}${escapeHtml(row.subject)}</span><strong>${formatDurationPrecise(t)}</strong></div>
        ${analyticsBar(share, 100, subjectColor(row.subject))}
        <small class="ch-sub">${Math.round(share)}% of total time${att ? ` · ${chMinutesLabel(t / att)} per attempted question` : ""}</small>
      </div>`;
    })
    .join("");

  const ordered = review
    .slice()
    .sort(
      (a, b) =>
        subjectSortRank(a.subject) - subjectSortRank(b.subject) ||
        chNum(a.question_order) - chNum(b.question_order),
    )
    .map((r, i) => ({
      n: i + 1,
      seconds: chNum(r.time_spent_seconds),
      subject: r.subject,
      state: r.is_correct === true ? "correct" : r.is_correct === false ? "wrong" : "skipped",
    }));
  const hasTiming = totalTime > 0 && ordered.length > 0;

  return `<section class="report-charts">
    <div class="card report-chart-card">
      <div class="section-title"><h2>Test performance</h2><span class="text-muted">Score and accuracy</span></div>
      <div class="report-radials">
        ${renderRadialProgress(scorePct, { size: 132, stroke: 10, color: "var(--brand)", subLabel: "Score" })}
        ${renderRadialProgress(accuracy, { size: 132, stroke: 10, color: "var(--success)", subLabel: "Accuracy" })}
      </div>
    </div>

    <div class="card report-chart-card">
      <div class="section-title"><h2>Answer outcomes</h2><span class="text-muted">${review.length} questions</span></div>
      <div class="ch-donut-row">
        ${chartDonut(
          [
            { value: correct, color: "var(--success)", label: "Correct" },
            { value: wrong, color: "var(--danger)", label: "Wrong" },
            { value: skipped, color: "var(--not-visited)", label: "Unattempted" },
          ],
          { centerValue: `${Math.round(accuracy)}%`, centerLabel: "accuracy" },
        )}
        ${outcomeLegend(correct, wrong, skipped)}
      </div>
    </div>

    <div class="card report-chart-card">
      <div class="section-title"><h2>Subject breakdown</h2><span class="text-muted">Marks and outcomes</span></div>
      <div class="subject-performance-list">${subjectBreakdown || `<div class="empty-state">No subject data.</div>`}</div>
    </div>

    <div class="card report-chart-card">
      <div class="section-title"><h2>Time by subject</h2><span class="text-muted">${totalTime ? formatDurationPrecise(totalTime) + " on questions" : "Not recorded"}</span></div>
      <div class="subject-performance-list">${totalTime ? timeRows : `<div class="empty-state">Time per subject wasn't recorded for this attempt.</div>`}</div>
    </div>

    <div class="card report-chart-card report-chart-wide">
      <div class="section-title"><h2>Time per question</h2><span class="text-muted">Where your time went</span></div>
      ${
        hasTiming
          ? chartQuestionTimeline(ordered) + chartLegend([
              { label: "Correct", color: "var(--success)", round: true },
              { label: "Wrong", color: "var(--danger)", round: true },
              { label: "Unattempted", color: "var(--not-visited)", round: true },
              { label: `Average ${chMinutesLabel(totalTime / Math.max(1, ordered.length))} / question`, color: "var(--muted)", dashed: true },
            ])
          : `<div class="empty-state">Question timing wasn't recorded for this attempt.</div>`
      }
    </div>
  </section>`;
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
  const isPractice = !!report.is_practice;
  // An attempt the admin disqualified is never ranked: no rank, no percentile,
  // no leaderboard. Everything else on the report stays visible.
  const isDisqualified = !!report.disqualified && !isPractice;
  const dqReason = String(report.disqualification_reason || "").trim();
  const dqQuery = buildQueryLinks(report);
  const declared =
    !isPractice &&
    !isDisqualified &&
    report.rank !== null &&
    report.rank !== undefined;
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
        <span class="report-status-tags"><span class="status-tag ${report.status}">${report.status.replace("_", " ")}</span>${isDisqualified ? `<span class="status-tag dq-tag">Not ranked</span>` : ""}</span>
      </div>
      <p class="text-muted" style="font-size:13px;">
        ${viewingSomeoneElse ? `Top-3 public report · ${escapeHtml(report.full_name || "Student")} · ` : ""}Submitted ${formatDateTime(report.submitted_at)}
      </p>
      ${
        isPractice
          ? `<div class="practice-notice" style="margin-top:10px;">🔁 <strong>Practice re-attempt</strong> — for your own revision only. Not counted for rank, percentile, or the leaderboard.</div>`
          : ""
      }
      ${
        report.is_owner &&
        ["submitted", "auto_submitted"].includes(report.status)
          ? `<div class="report-actions-row">
              ${
                !isPractice
                  ? `<a class="btn btn-sm btn-secondary" href="#/exam?test=${encodeURIComponent(report.test_id)}&practice=1">🔁 Reattempt this test</a>`
                  : ""
              }
            </div>`
          : ""
      }
    </div>

    ${
      isDisqualified
        ? `<div class="integrity-banner" role="alert">
            <span class="integrity-icon">🚫</span>
            <div>
              <strong>Cheating was detected on this attempt</strong>
              <p>Because of this, your <b>rank and percentile are not available</b> and you are not included in any leaderboard. Your score, subject-wise analysis and answer review are shown below as usual.</p>
              ${
                dqReason
                  ? `<div class="integrity-reason"><span>Reason given by the admin</span><p>${escapeHtml(dqReason)}</p></div>`
                  : ""
              }
              ${
                report.is_owner
                  ? `<div class="integrity-actions">
                      <a class="btn btn-sm integrity-btn" href="${dqQuery.mailto}">✉ Raise a query</a>
                      <a class="integrity-link" href="${dqQuery.gmail}" target="_blank" rel="noopener">Open in Gmail</a>
                      <span class="integrity-hint">Think this is a mistake? Email <b>${SUPPORT_EMAIL}</b> — your test and attempt details are filled in for you.</span>
                    </div>`
                  : ""
              }
            </div>
          </div>`
        : !isPractice && !declared
          ? `<div class="locked-banner">Your score is available. Rank and percentile will be announced when the test is over.</div>`
          : ""
    }

    <div class="stat-grid">
      <div class="stat-card"><div class="val">${report.total_score} / ${totalMax}</div><div class="lbl">Score</div></div>
<div class="stat-card">
  <div class="val">${isPractice ? "—" : isDisqualified ? "🚫" : declared ? `${medalFor(report.rank)}#${report.rank}` : "🔒"}</div>
  <div class="lbl">Rank${isDisqualified ? " · withheld" : ""}</div>
</div>
      <div class="stat-card"><div class="val">${isPractice ? "—" : isDisqualified ? "🚫" : declared ? report.percentile + "%" : "🔒"}</div><div class="lbl">Percentile${isDisqualified ? " · withheld" : ""}</div></div>
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
      <h2 style="font-size:16px;">Top 10</h2>
      ${
        isPractice
          ? `<div class="empty-state">Practice re-attempts don't appear on the leaderboard. Your real attempt's rank and percentile are on that report.</div>`
          : isDisqualified
            ? `<div class="empty-state">This attempt is not ranked, so it can't be shown on the leaderboard.</div>`
          : !declared
            ? `<div class="empty-state">Rank and percentile will be announced when the test gets over.</div>`
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
  const correct = chNum(outcomes.correct);
  const wrong = chNum(outcomes.wrong);
  const skipped = chNum(outcomes.unattempted);
  const totalOutcome = correct + wrong + skipped;
  const acc = correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : 0;

  const barRows = trend.map((t, i) => ({
    label: new Date(t.submitted_at).getDate(),
    sub: new Date(t.submitted_at).toLocaleDateString(undefined, { month: "short" }),
    value: chNum(t.percentage),
    latest: i === trend.length - 1,
    tip: `${t.title} · ${chShortDate(t.submitted_at)} — ${t.total_score}/${t.total_marks} (${chNum(t.percentage)}%)${t.accuracy === null || t.accuracy === undefined ? "" : " · accuracy " + chNum(t.accuracy) + "%"}`,
  }));
  const latest = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  const delta =
    latest && prev ? Math.round((chNum(latest.percentage) - chNum(prev.percentage)) * 10) / 10 : null;
  const deltaHtml =
    delta === null
      ? ""
      : `<span class="ch-delta ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)} pts vs previous test</span>`;

  const subjectRowsHtml = subjects.length
    ? subjects
        .map((s) => {
          const c = chNum(s.correct_count);
          const w = chNum(s.wrong_count);
          const u = chNum(s.unattempted);
          const a = c + w ? Math.round((c / (c + w)) * 100) : null;
          return `<div class="subject-performance-row">
            <div class="subject-performance-label"><span>${subjectDot(s.subject)}${escapeHtml(s.subject)}</span><strong>${a === null ? "—" : a + "%"} accuracy</strong></div>
            ${chartStackBar([
              { value: c, color: "var(--success)", label: "Correct" },
              { value: w, color: "var(--danger)", label: "Wrong" },
              { value: u, color: "var(--not-visited)", label: "Unattempted" },
            ])}
            <small class="ch-sub">${c} correct · ${w} wrong · ${u} unattempted · ${chNum(s.obtained)} / ${chNum(s.total)} marks${chNum(s.time_spent_seconds) ? " · " + formatDurationPrecise(s.time_spent_seconds) : ""}</small>
          </div>`;
        })
        .join("")
    : `<div class="empty-state">Subject analytics will appear after your first submitted test.</div>`;

  return `
    <div class="analytics-stat-grid">
      <div class="analytics-stat-card"><span class="analytics-stat-icon">%</span><strong>${summary.average_score || 0}%</strong><span>Average score</span></div>
      <div class="analytics-stat-card"><span class="analytics-stat-icon">★</span><strong>${summary.best_score || 0}%</strong><span>Best score</span></div>
      <div class="analytics-stat-card"><span class="analytics-stat-icon">✓</span><strong>${summary.accuracy || 0}%</strong><span>Accuracy</span></div>
      <div class="analytics-stat-card"><span class="analytics-stat-icon">▣</span><strong>${summary.completed_tests || 0}</strong><span>Tests completed</span></div>
      <div class="analytics-stat-card"><span class="analytics-stat-icon">↗</span><strong>${summary.questions_answered || 0}</strong><span>Questions answered</span></div>
      <div class="analytics-stat-card"><span class="analytics-stat-icon">◷</span><strong>${chNum(summary.total_time_seconds) ? formatDurationShort(summary.total_time_seconds) : "—"}</strong><span>Time on questions</span></div>
    </div>

    <section class="card analytics-panel">
      <div class="section-title"><div><h2>Score trend</h2><span class="text-muted">Last ${trend.length} main test${trend.length === 1 ? "" : "s"} · re-attempts excluded</span></div>${deltaHtml}</div>
      ${
        trend.length
          ? chartTrendBars(barRows, { avgLine: chNum(summary.average_score) }) +
            chartLegend([
              { label: "Score %", color: "var(--brand)", round: true },
              { label: "Latest test", color: "var(--brand-dark)", round: true },
              { label: `Average ${chNum(summary.average_score)}%`, color: "var(--muted)", dashed: true },
            ])
          : `<div class="empty-state">Submit a test to start your trend.</div>`
      }
    </section>

    <div class="analytics-chart-grid">
      <section class="card analytics-panel">
        <div class="section-title"><h2>Question outcomes</h2><span class="text-muted">${totalOutcome} questions</span></div>
        <div class="ch-donut-row">
          ${chartDonut(
            [
              { value: correct, color: "var(--success)", label: "Correct" },
              { value: wrong, color: "var(--danger)", label: "Wrong" },
              { value: skipped, color: "var(--not-visited)", label: "Unattempted" },
            ],
            { centerValue: `${acc}%`, centerLabel: "accuracy" },
          )}
          ${outcomeLegend(correct, wrong, skipped)}
        </div>
      </section>
      <section class="card analytics-panel">
        <div class="section-title"><h2>Subject performance</h2><span class="text-muted">Outcomes by subject</span></div>
        <div class="subject-performance-list">${subjectRowsHtml}</div>
      </section>
    </div>`;
}

async function enterAnalyticsView() {
  const content = document.getElementById("analyticsContent");
  const historyContainer = document.getElementById("analysisHistory");
  content.innerHTML = `<div class="empty-state">Loading analytics…</div>`;
  if (historyContainer) historyContainer.innerHTML = "";
  const { data, error } = await sb.rpc("get_student_analytics");
  if (error || !data) {
    content.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error) || "Analytics could not be loaded.")}</div>`;
    return;
  }

  const completedTests = Number(data.summary?.completed_tests || 0);
  if (!completedTests) {
    content.innerHTML = `
      <div class="card analytics-empty-card">
        <span class="analytics-empty-icon">📊</span>
        <h2>No analytics yet</h2>
        <p class="text-muted">Attempt a test to view your detailed analytics.</p>
        <a href="#/tests" class="btn btn-primary">Browse tests</a>
      </div>
    `;
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
        <div class="history-card-meta">${categoryBadge(item.category)} · ${formatDateTime(item.submitted_at)} · ${item.status.replace("_", " ")}${item.disqualified ? ' · <span class="status-tag dq-tag">Not ranked</span>' : ""}</div>
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
  const visible = (data || []).filter((item) => !item.disqualified);
  target.innerHTML = `<div class="section-title"><div><span class="eyebrow-label">Attempt history</span><h2>Every test report</h2></div><span class="text-muted">${visible.length} completed</span></div><div class="history-list" id="analysisHistoryList"></div>`;
  renderHistoryCards(visible, "analysisHistoryList");
}

// Best score is shown to three decimals (e.g. 68.333%).
function fmtBestScore(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(3)}%` : "—";
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
        <td>${fmtBestScore(row.best_score)}</td>
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
        Best score: ${fmtBestScore(myRow.best_score)} &nbsp;·&nbsp; Total time: ${formatDurationPrecise(myRow.total_time_seconds)}
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
  content.innerHTML = `<div class="profile-hero"><div class="profile-avatar-large">${escapeHtml(name.trim().charAt(0).toUpperCase() || "S")}</div><div><span class="eyebrow-label">Your account</span><h1>${escapeHtml(name)}</h1><p>${roleLine} · ${escapeHtml(myProfile?.email || "")}</p></div><a class="btn btn-sm" href="#/analytics">Open analytics</a></div><section class="card profile-edit-card"><div class="section-title"><div><span class="eyebrow-label">Required before your first test</span><h2>Student profile</h2></div><span id="profileSaveStatus" class="text-muted"></span></div><form id="profileEditForm" class="profile-edit-form profile-details-form"><label>Full name *<input type="text" id="profileNameInput" value="${escapeHtml(myProfile?.full_name || "")}" maxlength="120" required></label><label>Email *<input type="email" id="profileEmailInput" value="${escapeHtml(myProfile?.email || "")}" required></label><label>Mobile number<input type="tel" id="profileMobileInput" inputmode="tel" autocomplete="tel" placeholder="e.g. 98765 43210" value="${escapeHtml(myProfile?.mobile_number || "")}" maxlength="20"></label><label>Date of birth / age<input type="date" id="profileDobInput" value="${escapeHtml(myProfile?.date_of_birth || "")}"></label><label>Gender (optional)<select id="profileGenderInput"><option value="">Prefer not to say</option>${options(["Female", "Male", "Non-binary", "Other"])}</select></label><label>Class / grade *<input type="text" id="profileClassInput" value="${escapeHtml(myProfile?.class_grade || "")}" maxlength="40" required></label><label>Target exam<select id="profileTargetInput"><option value="">Select target exam</option>${options(["JEE Main", "JEE Advanced", "NEET", "Olympiads", "Other"])}</select></label><label>Board<select id="profileBoardInput"><option value="">Select board</option>${options(["CBSE", "ICSE", "State Board", "Other"])}</select></label><button type="submit" class="btn btn-primary">Save profile</button></form></section><div class="section-title profile-history-heading"><div><span class="eyebrow-label">Your activity</span><h2>Test history</h2></div></div><div id="profileHistory" class="history-list"><div class="empty-state">Loading test history…</div></div>`;
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