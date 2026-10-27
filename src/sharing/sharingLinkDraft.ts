export function sharingDraftMessage(title: string, url: string) {
  return `Open this workout in Lastrep:\n${title.trim() || "Workout"}\n\n${url}`;
}

export function sharingEmailDraftUrl(title: string, url: string) {
  return `mailto:?subject=${encodeURIComponent(title.trim() || "Workout")}&body=${encodeURIComponent(sharingDraftMessage(title, url))}`;
}
