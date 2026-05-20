/**
 * Verifies Tailwind utilities exist in the compiled Next.js CSS bundle.
 * Run after: npm run build   (or visit any page once with npm run dev)
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

function findLayoutCss(dir) {
  if (!existsSync(dir)) return null;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) {
      const found = findLayoutCss(path);
      if (found) return found;
    } else if (name.name === "layout.css" && path.replace(/\\/g, "/").includes("/css/app/")) {
      return path;
    }
  }
  return null;
}

const staticCssDir = join(process.cwd(), ".next", "static", "css");
const cssPath =
  findLayoutCss(staticCssDir) ?? join(staticCssDir, "app", "layout.css");

if (!existsSync(cssPath)) {
  console.error("\n❌ Tailwind CSS bundle not found.");
  console.error("   Expected something like: .next/static/css/app/layout.css\n");
  console.error("   This file is created by Next.js when you build or run dev.\n");
  console.error("   Run these commands in order:\n");
  console.error("     npm run build");
  console.error("     npm run verify:css\n");
  console.error("   Or start the app (styles compile on first load):\n");
  console.error("     npm run dev");
  console.error("     (open http://localhost:3000 in the browser, then run verify:css again)\n");
  process.exit(1);
}

const css = readFileSync(cssPath, "utf8");
const checks = [".flex{", ".flex ", ".lg\\:ml-", ".hidden{", ".hidden "];
const found = checks.some((c) => css.includes(c));

if (!found) {
  console.error("\n❌ layout.css exists but Tailwind utilities are missing.");
  console.error("   File:", cssPath);
  console.error("\n   Try: Remove-Item -Recurse -Force .next; npm run build\n");
  process.exit(1);
}

console.log("✅ OK: Tailwind utilities found in", cssPath);
