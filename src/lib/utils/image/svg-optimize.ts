import { optimize, type Config } from "svgo/browser";
import { utf8Length } from "../format/bytes";

export interface SvgOptimizeOptions {
  /** Decimal places kept in coordinates and transforms. */
  precision: number;
  multipass: boolean;
  /** Indent the output instead of minifying it. */
  pretty: boolean;
  /** Keep the viewBox (needed to resize the SVG with CSS). */
  keepViewBox: boolean;
  /** Keep <title> and <desc>, which screen readers use. */
  keepTitle: boolean;
}

export const DEFAULT_SVG_OPTIONS: SvgOptimizeOptions = {
  precision: 2,
  multipass: true,
  pretty: false,
  keepViewBox: true,
  keepTitle: true,
};

export type SvgOptimizeResult =
  | { ok: true; output: string; before: number; after: number; saved: number }
  | { ok: false; error: string; line?: number; column?: number };

export interface SvgOptimizeRequest {
  svg: string;
  options: SvgOptimizeOptions;
}

export function optimizeSvg({ svg, options }: SvgOptimizeRequest): SvgOptimizeResult {
  if (!/<svg[\s>]/i.test(svg)) return { ok: false, error: "not-svg" };
  // SVGO 4's preset keeps the viewBox and <title>; removing them is opt-in here too.
  const plugins: Config["plugins"] = [
    { name: "preset-default", params: { overrides: options.keepTitle ? { removeDesc: false } : {} } },
  ];
  if (!options.keepViewBox) plugins.push("removeViewBox");
  if (!options.keepTitle) plugins.push("removeTitle");
  const config: Config = {
    multipass: options.multipass,
    floatPrecision: options.precision,
    js2svg: options.pretty ? { pretty: true, indent: 2 } : undefined,
    plugins,
  };
  try {
    const output = optimize(svg, config).data;
    const before = utf8Length(svg);
    const after = utf8Length(output);
    return { ok: true, output, before, after, saved: before === 0 ? 0 : Math.round((1 - after / before) * 1000) / 10 };
  } catch (e) {
    const err = e as { reason?: string; message?: string; line?: number; column?: number };
    return { ok: false, error: err.reason ?? err.message ?? String(e), line: err.line, column: err.column };
  }
}
