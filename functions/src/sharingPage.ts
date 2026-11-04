import * as functions from "firebase-functions/v1";
import { handleWorkoutSharing } from "./workoutSharing";
import { sharingPageTemplate } from "./sharingPageTemplate";

/** Type-only metadata: never place a sender's identity or prescription in a link card. */
export async function sharingPageResponse(originalUrl: string, load: (token: string) => Promise<{plan: {version: number}}>) {
  const url = new URL(originalUrl, "https://lastrep.web.app");
  const query = url.searchParams.getAll("token");
  const pathToken = /^\/w\/([A-Za-z0-9_-]{32})$/.exec(url.pathname)?.[1];
  const token = pathToken && query.length === 0 ? pathToken : url.pathname === "/shared-workout" && query.length === 1 && /^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{32})$/.test(query[0]) ? query[0] : null;
  let kind = "Shared plan", title = "Link unavailable · Lastrep", status = 404;
  if (token) {
    try {
      const snapshot = await load(token);
      kind = snapshot.plan.version === 2 ? "Shared program" : "Shared workout";
      title = `${kind} · Lastrep`; status = 200;
    } catch (error) {
      const code = (error as {code?: string}).code;
      if (code !== "not-found") { status = code === "resource-exhausted" ? 429 : 503; title = "Shared plan · Lastrep"; }
    }
  }
  return {status, html: sharingPageTemplate.split("Shared plan · Lastrep").join(title).replace('id="plan-kind" class="eyebrow">Shared plan', `id="plan-kind" class="eyebrow">${kind}`).replace('content="Preview this shared plan and open it in Lastrep."', `content="Preview this ${kind.toLowerCase()} and open it in Lastrep."`)};
}

export const sharingPage = functions.region("asia-northeast3")
  .runWith({timeoutSeconds: 30, maxInstances: 5})
  .https.onRequest(async (req, res) => {
    res.set({"Cache-Control":"no-store", "Referrer-Policy":"no-referrer", "X-Robots-Tag":"noindex, nofollow, noarchive", "X-Content-Type-Options":"nosniff", "Content-Security-Policy":"default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});
    if (req.method !== "GET" && req.method !== "HEAD") { res.set("Allow", "GET, HEAD").status(405).send("Method not allowed"); return; }
    const result = await sharingPageResponse(req.originalUrl, async token =>
      await handleWorkoutSharing({op:"snapshot",token,expectedUid:null,supportedPlanVersion:2},null) as {plan:{version:number}});
    res.status(result.status).type("html").send(req.method === "HEAD" ? "" : result.html);
  });
