function getErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code.toLowerCase();
  }

  return "";
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message.toLowerCase();
  }

  return "";
}

export function isExpectedOfflineError(error: unknown): boolean {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  return (
    code === "unavailable" ||
    code === "network_error" ||
    code === "networkerror" ||
    message.includes("client is offline") ||
    message.includes("offline") ||
    message.includes("unable to resolve host") ||
    message.includes("no address associated with hostname") ||
    message.includes("network request failed") ||
    message.includes("error performing request")
  );
}

export function isExpectedOfflineMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("network_error") ||
    normalized.includes("networkerror") ||
    normalized.includes("unable to resolve host") ||
    normalized.includes("no address associated with hostname") ||
    normalized.includes("client is offline") ||
    normalized.includes("error performing request")
  );
}
