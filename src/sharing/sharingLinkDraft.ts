export function sharingDraftMessage(title: string, url: string, kind: "workout" | "program" = "workout") {
  return `Open this ${kind} in Lastrep:\n${title.trim() || (kind === "program" ? "Program" : "Workout")}\n\n${url}`;
}

export function sharingEmailDraftUrl(title: string, url: string, kind: "workout" | "program" = "workout") {
  return `mailto:?subject=${encodeURIComponent(title.trim() || (kind === "program" ? "Program" : "Workout"))}&body=${encodeURIComponent(sharingDraftMessage(title, url, kind))}`;
}
