import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import {
  sharingToken,
  setPrescription,
  loadSnapshot,
  startPage,
  renderSnapshot,
} from "../../hosting/workout-sharing/sharing.mjs";

const token = "a".repeat(64);
const shortToken = "B".repeat(32);
const plan = {
  title: "<img src=x onerror=alert(1)>",
  effortScale: "rir",
  exercises: [
    {
      name: "Bench press",
      mode: "resistance",
      unit: "lbs",
      restSec: 90,
      tempo: "3-0-X-0",
      instructions: "<script>private</script>",
      sets: [
        { weightKg: 45.359237, reps: "8", targetRpe: 8, setType: "normal" },
      ],
    },
  ],
};
function documentFixture() {
  const node = (tag) => ({
    tag,
    textContent: "",
    hidden: true,
    children: [],
    append(child) {
      this.children.push(child);
    },
    replaceChildren() {
      this.children = [];
    },
  });
  const nodes = new Map(
    ["title", "status", "open", "retry", "preview"].map((key) => [
      key,
      node(key),
    ]),
  );
  return { getElementById: (id) => nodes.get(id), createElement: node };
}
describe("public sharing landing page", () => {
  it("shows exercise targets separately from set prescriptions using the chosen effort scale", () => {
    const doc = documentFixture();
    renderSnapshot(doc, { sender: { nickname: "Example" }, plan: { ...plan, exercises: [{ ...plan.exercises[0], targets: { minReps: 8, maxReps: 12, targetRpe: 8.5 } }] } });
    const article = doc.getElementById("preview").children[0];
    expect(article.children[1].textContent).toBe("Target: 8–12 reps · RIR 1.5");
    expect(article.children[2].textContent).toContain("RIR 2");
  });
  it("accepts one opaque token and rejects ambiguous or executable input", () => {
    expect(sharingToken(`?token=${token}`)).toBe(token);
    expect(sharingToken("", `/w/${shortToken}`)).toBe(shortToken);
    expect(sharingToken(`?token=${token}`, `/w/${shortToken}`)).toBeNull();
    for (const search of [
      "",
      "?token=javascript:alert(1)",
      `?token=${token}&token=${token}`,
      `?token=${token}x`,
    ])
      expect(sharingToken(search)).toBeNull();
  });
  it("shows converted weights and target RIR without inventing omitted weights", () => {
    const exercise = plan.exercises[0];
    expect(setPrescription(exercise.sets[0], exercise, "rir")).toBe(
      "100 lbs × 8 · RIR 2",
    );
    expect(
      setPrescription(
        { ...exercise.sets[0], weightKg: null, setType: "warmup" },
        exercise,
        "rpe",
      ),
    ).toBe("W · 8 reps · RPE 8");
    expect(
      setPrescription(
        { durationSec: 90, distanceKm: 1.609344 },
        { mode: "cardio", unit: "mi" },
        "rpe",
      ),
    ).toBe("1.5 min · 1 mi");
  });
  it("requests only a public snapshot without credentials or a referrer", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          result: { plan, sender: { nickname: "Example" } },
        }),
      });
    await loadSnapshot(token, fetcher);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      data: { op: "snapshot", token, expectedUid: null },
    });
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
  });
  it("renders sender content as text and offers an explicit app launch only after loading", async () => {
    const doc = documentFixture();
    await startPage(doc, { search: "", pathname: `/w/${shortToken}` }, async () => ({
      ok: true,
      json: async () => ({ result: { plan, sender: { nickname: "Example" } } }),
    }));
    expect(doc.getElementById("title").textContent).toBe(plan.title);
    const article = doc.getElementById("preview").children[0];
    expect(article.children.at(-1).textContent).toContain(
      "<script>private</script>",
    );
    expect(doc.getElementById("open").hidden).toBe(false);
    expect(doc.getElementById("open").href).toContain(
      "package=com.kjeehwan.lastrep;",
    );
    expect(doc.getElementById("open").href).toContain(`token=${shortToken}#Intent;`);
  });
  it("distinguishes unavailable links from retryable network failures", async () => {
    for (const [status, retryHidden] of [
      ["NOT_FOUND", true],
      ["RESOURCE_EXHAUSTED", false],
    ]) {
      const doc = documentFixture();
      await startPage(doc, { search: `?token=${token}` }, async () => ({
        ok: false,
        json: async () => ({ error: { status } }),
      }));
      expect(doc.getElementById("open").hidden).toBe(true);
      expect(doc.getElementById("preview").hidden).toBe(true);
      expect(doc.getElementById("retry").hidden).toBe(retryHidden);
    }
    const doc = documentFixture(),
      fetcher = vi.fn();
    await startPage(doc, { search: "?token=invalid" }, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("serves the association JSON without authentication or redirect and confines links to production", () => {
    const config = JSON.parse(fs.readFileSync("firebase.json", "utf8")).hosting;
    expect(config.public).toBe("hosting/workout-sharing");
    expect(config.target).toBe("sharing");
    const targets = JSON.parse(fs.readFileSync(".firebaserc", "utf8")).targets;
    expect(targets["lastrep-ebac5"].hosting.sharing).toEqual(["lastrep"]);
    const release = JSON.parse(fs.readFileSync("eas.json", "utf8")).build.production;
    expect(release.env.EXPO_PUBLIC_WORKOUT_SHARING_URL).toBe("https://lastrep.web.app");
    expect(config.rewrites).toEqual([
      {
        source: "/api/workout-sharing",
        function: { functionId: "workoutSharing", region: "asia-northeast3" },
      },
      { source: "/shared-workout", destination: "/index.html" },
      { source: "/w/**", destination: "/index.html" },
    ]);
    expect(config.ignore).not.toContain("**/.*");
    const association = JSON.parse(
      fs.readFileSync(`${config.public}/.well-known/assetlinks.json`, "utf8"),
    );
    expect(association).toHaveLength(1);
    expect(association[0].target.package_name).toBe("com.kjeehwan.lastrep");
    expect(association[0].target.sha256_cert_fingerprints[0]).toMatch(
      /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/,
    );
    const manifest = fs.readFileSync(
      "android/app/src/prod/AndroidManifest.xml",
      "utf8",
    );
    expect(manifest).toContain('android:autoVerify="true"');
    for (const host of ["lastrep.web.app", "lastrep-ebac5.web.app"]) {
      expect(manifest).toContain(`android:host="${host}" android:path="/shared-workout"`);
      expect(manifest).toContain(`android:host="${host}" android:pathPrefix="/w/"`);
    }
    expect(
      fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf8"),
    ).not.toContain("lastrep-ebac5.web.app");
    const policies = config.headers.find(
      (rule) => rule.source === "**",
    ).headers;
    expect(policies).toContainEqual({
      key: "Referrer-Policy",
      value: "no-referrer",
    });
    expect(
      policies.find((p) => p.key === "Content-Security-Policy").value,
    ).toContain("frame-ancestors 'none'");
  });
});
