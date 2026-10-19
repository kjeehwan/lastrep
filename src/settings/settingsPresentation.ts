/** Native binary metadata only; a Metro/OTA manifest can describe a different build. */
export function formatInstalledVersion(version?: string | null, build?: string | null): string {
  if (!version) return "Not available";
  return build ? `${version} (${build})` : version;
}

export function settingsAccessLabel(accountLoaded: boolean, state: "loading" | "active" | "inactive"): string {
  return !accountLoaded || state === "loading" ? "Checking access" : state === "active" ? "Premium" : "Free";
}
