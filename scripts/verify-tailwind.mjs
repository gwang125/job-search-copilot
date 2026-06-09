/**
 * Verifies Tailwind utilities exist in the compiled Next.js CSS bundle.
 * Run after: npm run build   (or visit any page once with npm run dev)
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

function findCssFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) {
      files.push(...findCssFiles(path));
    } else if (name.name.endsWith(".css")) {
      files.push(path);
    }
  }
  return files;
}

const staticCssDir = join(process.cwd(), ".next", "static", "css");
const cssPaths = findCssFiles(staticCssDir);

if (cssPaths.length === 0) {
  console.error("\n❌ Tailwind CSS bundle not found.");
  console.error("   Expected at least one CSS file under .next/static/css\n");
  console.error("   This file is created by Next.js when you build or run dev.\n");
  console.error("   Run these commands in order:\n");
  console.error("     npm run build");
  console.error("     npm run verify:css\n");
  console.error("   Or start the app (styles compile on first load):\n");
  console.error("     npm run dev");
  console.error("     (open http://localhost:3000 in the browser, then run verify:css again)\n");
  process.exit(1);
}

const checks = [
  ".flex{",
  ".grid{",
  ".hidden{",
  ".bg-zinc-50",
  ".text-zinc-900",
  ".antialiased",
  ".lg\\:ml-",
];
const cssWithUtilities = cssPaths.find((path) => {
  const css = readFileSync(path, "utf8");
  return checks.some((c) => css.includes(c));
});

if (!cssWithUtilities) {
  console.error("\n❌ CSS bundles exist but Tailwind utilities are missing.");
  console.error("   Files checked:");
  for (const path of cssPaths) console.error("   -", path);
  console.error("\n   Try: Remove-Item -Recurse -Force .next; npm run build\n");
  process.exit(1);
}

console.log("✅ OK: Tailwind utilities found in", cssWithUtilities);
