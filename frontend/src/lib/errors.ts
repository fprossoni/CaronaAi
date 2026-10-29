export function getErrorMessage(
  err: unknown,
  fallback = "Ocorreu um erro inesperado. Tente novamente."
): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (typeof first?.msg === "string") {
        return first.msg.replace(/^Value error,\s*/i, "");
      }
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}