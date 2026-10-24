/**
 * Brand files in public/examples/ (copied by `npm run generate:icons`) that the
 * image tools load as their example, so every demo uses a real asset.
 */
export const brandExamples = {
  icon: "/examples/logo-icon.svg",
  wordmark: "/examples/logo-wordmark-dark.svg",
  banner: "/examples/kitforweb-banner.png",
} as const;

async function fetchExample(path: string): Promise<Response> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Example ${path} not found (${res.status})`);
  return res;
}

export async function exampleFile(path: string): Promise<File> {
  const blob = await (await fetchExample(path)).blob();
  return new File([blob], path.slice(path.lastIndexOf("/") + 1), { type: blob.type });
}

export async function exampleText(path: string): Promise<string> {
  return (await fetchExample(path)).text();
}
