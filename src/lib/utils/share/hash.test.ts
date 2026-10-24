import { describe, expect, it } from "vitest";
import { decodeShareState, encodeShareState } from "./hash";

const isCode = (v: unknown): v is { code: string } =>
  typeof v === "object" && v !== null && typeof (v as { code?: unknown }).code === "string";

describe("share hash", () => {
  it("round-trips state through the fragment", () => {
    const state = { code: "graph TD\n  A --> B ñ 😀" };
    const hash = `#${encodeShareState(state)}`;
    expect(decodeShareState(hash, isCode)).toEqual(state);
  });

  it("produces URL-safe output", () => {
    expect(encodeShareState({ code: "a/b?c=d&e#f" })).toMatch(/^[A-Za-z0-9+\-$_]*$/);
  });

  it("returns null for empty, corrupt or unexpected state", () => {
    expect(decodeShareState("", isCode)).toBeNull();
    expect(decodeShareState("#garbage!!", isCode)).toBeNull();
    expect(decodeShareState(`#${encodeShareState({ other: 1 })}`, isCode)).toBeNull();
  });
});
