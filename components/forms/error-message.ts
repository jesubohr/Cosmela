import { ConvexError } from "convex/values";

/** The Spanish `message` of a ConvexError from our functions, or the fallback for anything else. */
export function errorMessage(error: unknown, fallback = "Algo salió mal. Revisa tu conexión e intenta de nuevo."): string {
  if (error instanceof ConvexError) {
    const message = (error.data as { message?: unknown } | undefined)?.message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

/** First line of a ConvexError's Spanish message, or a generic one. */
export function errorText(error: unknown) {
  const data = (error as { data?: { message?: string } } | null)?.data;
  return data?.message ?? "No pudimos guardar. Revisa tu conexión e intenta de nuevo.";
}
