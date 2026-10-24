/** Result of a text conversion: what every converter tool returns. */
export type ConvertResult =
  | { ok: true; output: string; warnings?: string[]; notes?: string[] }
  | { ok: false; error: string; line?: number; column?: number };

export const ok = (output: string, warnings?: string[]): ConvertResult =>
  warnings && warnings.length > 0 ? { ok: true, output, warnings } : { ok: true, output };

/** Successful result with neutral information (sizes, counts…). */
export const okWithNotes = (output: string, notes: string[]): ConvertResult => ({ ok: true, output, notes });

export const fail = (error: string, line?: number, column?: number): ConvertResult =>
  line === undefined ? { ok: false, error } : { ok: false, error, line, column };

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Runs `fn` and turns any thrown error into a failed result. */
export function attempt(fn: () => ConvertResult): ConvertResult {
  try {
    return fn();
  } catch (e) {
    return fail(errorMessage(e));
  }
}
