const endpoint = "/api/workout-sharing";
export function sharingToken(search, pathname = "") {
  const values = new URLSearchParams(search).getAll("token");
  const pathToken = /^\/w\/([A-Za-z0-9_-]{32})$/.exec(pathname)?.[1];
  if (pathToken) return values.length ? null : pathToken;
  return values.length === 1 && /^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{32})$/.test(values[0])
    ? values[0]
    : null;
}
const number = (value) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
export function setPrescription(set, exercise, scale) {
  const parts = [];
  if (exercise.mode === "cardio") {
    if (set.durationSec != null)
      parts.push(`${number(set.durationSec / 60)} min`);
    if (set.distanceKm != null)
      parts.push(
        `${number(set.distanceKm * (exercise.unit === "mi" ? 0.6213711922 : 1))} ${exercise.unit === "mi" ? "mi" : "km"}`,
      );
  } else {
    parts.push(
      set.weightKg == null
        ? `${set.reps} reps`
        : `${number(set.weightKg * (exercise.unit === "lbs" ? 2.20462262185 : 1))} ${exercise.unit} × ${set.reps}`,
    );
    if (set.targetRpe != null)
      parts.push(
        `${scale.toUpperCase()} ${number(scale === "rir" ? 10 - set.targetRpe : set.targetRpe)}`,
      );
  }
  return `${set.setType === "warmup" ? "W · " : set.setType === "drop" ? "Drop · " : set.setType === "failure" ? "Failure · " : ""}${parts.join(" · ")}`;
}
export async function loadSnapshot(token, fetcher = fetch, signal) {
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: { op: "snapshot", token, expectedUid: null },
    }),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-store",
    signal,
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    const error = new Error(
      body.error?.status === "NOT_FOUND" ? "unavailable" : "retry",
    );
    throw error;
  }
  const snapshot = body.result ?? body.data;
  if (!snapshot?.plan || !Array.isArray(snapshot.plan.exercises))
    throw new Error("retry");
  return snapshot;
}
export function renderSnapshot(doc, snapshot) {
  const add = (parent, tag, value, className) => {
    const node = doc.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    parent.append(node);
    return node;
  };
  doc.getElementById("title").textContent = snapshot.plan.title;
  doc.getElementById("status").textContent =
    `From ${snapshot.sender.nickname || "a Lastrep user"}`;
  const preview = doc.getElementById("preview");
  preview.replaceChildren();
  for (const exercise of snapshot.plan.exercises) {
    const article = add(preview, "article", "");
    add(article, "h2", exercise.name);
    for (const set of exercise.sets)
      add(
        article,
        "p",
        setPrescription(set, exercise, snapshot.plan.effortScale),
        "prescription",
      );
    const details = [
      exercise.restSec ? `Rest ${number(exercise.restSec)} sec` : "",
      exercise.tempo ? `Tempo ${exercise.tempo}` : "",
      exercise.cardioSessionType || "",
      exercise.cardioEffortLevel || "",
      exercise.instructions,
    ].filter(Boolean);
    if (details.length) add(article, "p", details.join("\n"), "details");
  }
  preview.hidden = false;
}
export async function startPage(doc, location, fetcher = fetch) {
  const token = sharingToken(location.search, location.pathname);
  const status = doc.getElementById("status"),
    open = doc.getElementById("open"),
    retry = doc.getElementById("retry");
  if (!token) {
    status.textContent =
      "This sharing link is unavailable. Ask the sender for a new link.";
    return;
  }
  retry.hidden = true;
  open.hidden = true;
  status.textContent = "Checking this sharing link…";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const snapshot = await loadSnapshot(token, fetcher, controller.signal);
    renderSnapshot(doc, snapshot);
    open.href = `intent://shared-workout?token=${token}#Intent;scheme=lastrep;package=com.kjeehwan.lastrep;S.browser_fallback_url=${encodeURIComponent("https://play.google.com/store/apps/details?id=com.kjeehwan.lastrep")};end`;
    open.hidden = false;
  } catch (error) {
    doc.getElementById("preview").hidden = true;
    status.textContent =
      error.message === "unavailable"
        ? "This sharing link has expired, was revoked, or is unavailable. Ask the sender for a new link."
        : "Couldn’t load this workout. Check your connection and try again.";
    retry.hidden = error.message === "unavailable";
  } finally {
    clearTimeout(timeout);
  }
  retry.onclick = () => {
    void startPage(doc, location, fetcher);
  };
}
if (typeof document !== "undefined") void startPage(document, window.location);
