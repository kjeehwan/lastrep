export function deletionRequestDetails(kind) {
  if (kind !== "account" && kind !== "data") throw new Error("Unknown deletion request.");
  const subject = kind === "account" ? "Account Deletion Request" : "Data Deletion Request";
  const body = kind === "account"
    ? "Lastrep account email:\n\nPlease delete my Lastrep account and associated data."
    : "Lastrep account email:\nRecord types to delete:\nDates or date range:\n\nPlease keep my account and records outside this request.";
  return `To: lastrep.dev@gmail.com\nSubject: ${subject}\n\n${body}`;
}

export function setupDeletionCopy(doc, clipboard) {
  for (const button of doc.querySelectorAll("[data-copy-request]")) {
    button.addEventListener("click", async () => {
      const text = deletionRequestDetails(button.dataset.copyRequest);
      const status = doc.getElementById("request-copy-status");
      const fallback = doc.getElementById("request-copy-fallback");
      fallback.hidden = true;
      try {
        if (!clipboard?.writeText) throw new Error("Clipboard unavailable");
        await clipboard.writeText(text);
        status.textContent = "Email details copied. Paste them into your email draft and complete the missing details.";
      } catch {
        fallback.value = text;
        fallback.hidden = false;
        fallback.focus();
        fallback.select();
        status.textContent = "Copy the selected details below into your email draft.";
      }
    });
  }
}
if (typeof document !== "undefined") setupDeletionCopy(document, navigator.clipboard);
