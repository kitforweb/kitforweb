// Browser stand-in for the Node built-ins (fs, path) that quicktype-core imports
// for its Node-only file input. None of these run in the browser.
const unavailable = (): never => {
  throw new Error("Not available in the browser");
};

export const createReadStream = unavailable;
export const existsSync = (): boolean => false;
export const lstatSync = unavailable;
export const readlinkSync = unavailable;
export const dirname = (p: string): string => p.replace(/\/[^/]*$/, "");
export const isAbsolute = (p: string): boolean => p.startsWith("/");
export const join = (...parts: string[]): string => parts.join("/");

const nodeStub = { createReadStream, existsSync, lstatSync, readlinkSync, dirname, isAbsolute, join };
export default nodeStub;
