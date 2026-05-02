import { isAxiosError } from "axios";

/** Maps Axios/fetch errors to a user-visible string (bundle equivalent `_2`). */
export function parseApiError(error: unknown): string {
  if (isAxiosError(error)) {
    const msg = error.response?.data as { message?: string } | undefined;
    if (msg?.message) return String(msg.message);
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
