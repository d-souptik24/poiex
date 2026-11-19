/**
 * Native C/C++ Package Registry and Addon Failure Detector for WebContainers.
 *
 * WebContainers run in a WebAssembly sandbox and cannot execute native compiled
 * binary extensions (.node files) or compile C/C++ addons using node-gyp.
 */

export interface NativePackageMeta {
  replacement: string;
  reason: string;
  command: string;
}

export interface DetectedNativePackage extends NativePackageMeta {
  name: string;
  version?: string;
  section: "dependencies" | "devDependencies" | "optionalDependencies";
}

/**
 * Curated knowledge base of common native C/C++ npm packages and their
 * WebAssembly / pure JavaScript drop-in replacements.
 */
export const NATIVE_PACKAGES_MAP: Record<string, NativePackageMeta> = {
  bcrypt: {
    replacement: "bcryptjs",
    reason: "Requires C++ node-gyp compilation. WebContainer cannot compile C++.",
    command: "npm uninstall bcrypt && npm install bcryptjs",
  },
  sharp: {
    replacement: "jimp",
    reason: "Depends on native Libvips C shared libraries.",
    command: "npm uninstall sharp && npm install jimp",
  },
  sqlite3: {
    replacement: "sql.js",
    reason: "Native SQLite C library cannot be compiled or loaded in WebAssembly.",
    command: "npm uninstall sqlite3 && npm install sql.js",
  },
  "better-sqlite3": {
    replacement: "sql.js",
    reason: "Native SQLite C++ bindings cannot run in browser WebAssembly.",
    command: "npm uninstall better-sqlite3 && npm install sql.js",
  },
  "node-sass": {
    replacement: "sass",
    reason: "LibSass C++ library is deprecated and requires native build tools.",
    command: "npm uninstall node-sass && npm install sass",
  },
  canvas: {
    replacement: "HTML5 Canvas API / pure SVG",
    reason: "Cairo and Pango native C libraries cannot be compiled in WebContainers.",
    command: "npm uninstall canvas (use browser Canvas or SVG libraries)",
  },
  puppeteer: {
    replacement: "Browser Fetch / DOM APIs",
    reason: "Spawns host OS Chrome browser processes, which is impossible inside WebAssembly.",
    command: "npm uninstall puppeteer (use standard Web APIs)",
  },
  playwright: {
    replacement: "Browser standard APIs",
    reason: "Requires external host browser binaries that cannot run in browser sandboxes.",
    command: "npm uninstall playwright",
  },
  argon2: {
    replacement: "argon2-browser",
    reason: "Native C argon2 hashing library cannot be compiled by node-gyp in Wasm.",
    command: "npm uninstall argon2 && npm install argon2-browser",
  },
  leveldown: {
    replacement: "memdown or level-js",
    reason: "Native LevelDB C++ bindings cannot run in WebContainers.",
    command: "npm uninstall leveldown && npm install level-js",
  },
  re2: {
    replacement: "Built-in RegExp",
    reason: "Native RE2 C++ regex engine requires native compilation.",
    command: "npm uninstall re2 (use JavaScript standard RegExp)",
  },
  fibers: {
    replacement: "Native async/await",
    reason: "Native C++ coroutine library is obsolete and cannot execute in WebAssembly.",
    command: "npm uninstall fibers",
  },
};

/**
 * Scans a package.json content string for known native C/C++ packages.
 */
export function detectNativePackages(packageJsonContent: string): DetectedNativePackage[] {
  if (!packageJsonContent || typeof packageJsonContent !== "string") {
    return [];
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(packageJsonContent);
  } catch {
    return [];
  }

  const detected: DetectedNativePackage[] = [];
  const sections: ("dependencies" | "devDependencies" | "optionalDependencies")[] = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
  ];

  for (const section of sections) {
    const deps = pkg[section];
    if (deps && typeof deps === "object" && !Array.isArray(deps)) {
      for (const [name, version] of Object.entries(deps)) {
        const lowerName = name.toLowerCase();
        if (lowerName in NATIVE_PACKAGES_MAP) {
          const meta = NATIVE_PACKAGES_MAP[lowerName];
          detected.push({
            name,
            version: typeof version === "string" ? version : undefined,
            section,
            ...meta,
          });
        }
      }
    }
  }

  return detected;
}

/**
 * Generates high-contrast ANSI terminal warning text before npm install runs.
 */
export function formatTerminalNativeWarning(packages: DetectedNativePackage[]): string {
  if (!packages.length) return "";

  const lines: string[] = [
    "\r\n\x1b[33m┌────────────────────────────────────────────────────────────────────────┐\x1b[0m",
    "\x1b[33m│ ⚠️  WebContainer Notice: Native C/C++ Package Detected                   │\x1b[0m",
    "\x1b[33m├────────────────────────────────────────────────────────────────────────┤\x1b[0m",
  ];

  for (const pkg of packages) {
    lines.push(
      `\x1b[33m│\x1b[0m \x1b[1mPackage:\x1b[0m     \x1b[31m${pkg.name}\x1b[0m (${pkg.section})`,
      `\x1b[33m│\x1b[0m \x1b[1mWhy it fails:\x1b[0m Node runs in WebAssembly and cannot compile C++ binaries.`,
      `\x1b[33m│\x1b[0m \x1b[1mReplacement:\x1b[0m  \x1b[32m${pkg.replacement}\x1b[0m`,
      `\x1b[33m│\x1b[0m \x1b[1mFix command:\x1b[0m  \x1b[36m${pkg.command}\x1b[0m`,
      "\x1b[33m├────────────────────────────────────────────────────────────────────────┤\x1b[0m",
    );
  }

  lines.push(
    "\x1b[33m│ Proceeding with install. If compilation fails, use the suggested fix.  │\x1b[0m",
    "\x1b[33m└────────────────────────────────────────────────────────────────────────┘\x1b[0m\r\n",
  );

  return lines.join("\r\n");
}

/**
 * Checks if the terminal install output indicates a node-gyp or native addon failure.
 */
export function isNativeAddonFailure(installOutput: string): boolean {
  if (!installOutput || typeof installOutput !== "string") return false;

  const signatures = [
    /gyp\s+ERR!/i,
    /node-gyp\s+rebuild/i,
    /node-pre-gyp\s+ERR!/i,
    /prebuild-install/i,
    /Cannot\s+load\s+native\s+addon\s+because\s+loading\s+addons\s+is\s+disabled/i,
    /Can't\s+find\s+Python\s+executable/i,
    /No\s+Python\s+at/i,
    /make:\s*\*\*\*\s*\[.*Release\/obj\.target/i,
    /error:\s*C\+\+\s*compiler\s*not\s*installed/i,
    /\.node:\s*invalid\s*ELF\s*header/i,
    /Failed\s+to\s+execute\s+'.*node-gyp/i,
  ];

  return signatures.some((regex) => regex.test(installOutput));
}

/**
 * Formats a post-failure diagnostic banner for the terminal.
 */
export function formatNativeFailureDiagnostic(
  _installOutput: string,
  packages: DetectedNativePackage[],
): string {
  const pkgNames = packages.map((p) => p.name).join(", ");
  const lines: string[] = [
    "\r\n\x1b[31m┌────────────────────────────────────────────────────────────────────────┐\x1b[0m",
    "\x1b[31m│ ❌ Build Failed: Missing C/C++ Compiler Toolchain (WebAssembly)        │\x1b[0m",
    "\x1b[31m├────────────────────────────────────────────────────────────────────────┤\x1b[0m",
    `\x1b[31m│\x1b[0m WebContainers cannot execute native C++ compilers (node-gyp / Python).`,
  ];

  if (packages.length > 0) {
    lines.push(`\x1b[31m│\x1b[0m Detected conflicting package(s): \x1b[1m\x1b[33m${pkgNames}\x1b[0m`);
    for (const pkg of packages) {
      lines.push(
        `\x1b[31m│\x1b[0m • Switch \x1b[31m${pkg.name}\x1b[0m ➔ \x1b[32m${pkg.replacement}\x1b[0m (\x1b[36m${pkg.command}\x1b[0m)`,
      );
    }
  } else {
    lines.push(
      `\x1b[31m│\x1b[0m A dependency attempted to run a native C++ build script (node-gyp).`,
      `\x1b[31m│\x1b[0m Ask PoiEx DevSpace to identify and replace the native package with pure JS.`,
    );
  }

  lines.push(
    "\x1b[31m│ Click 'Fix in DevSpace' in the preview panel for an automated fix.     │\x1b[0m",
    "\x1b[31m└────────────────────────────────────────────────────────────────────────┘\x1b[0m\r\n",
  );

  return lines.join("\r\n");
}

/**
 * Detects project language for non-Node repositories to enable
 * Monaco browsing and PoiEx DevSpace AI analysis.
 */
export function detectRepoLanguage(filePaths: string[]): { language: string; isNode: boolean } {
  const rootFiles = new Set(
    filePaths
      .filter((p) => !p.includes("/"))
      .map((f) => f.toLowerCase())
  );

  if (rootFiles.has("package.json")) {
    return { language: "JavaScript/TypeScript", isNode: true };
  }
  if (
    rootFiles.has("requirements.txt") ||
    rootFiles.has("pyproject.toml") ||
    rootFiles.has("pipfile") ||
    rootFiles.has("setup.py")
  ) {
    return { language: "Python", isNode: false };
  }
  if (rootFiles.has("cargo.toml")) {
    return { language: "Rust", isNode: false };
  }
  if (rootFiles.has("go.mod")) {
    return { language: "Go", isNode: false };
  }
  if (
    rootFiles.has("pom.xml") ||
    rootFiles.has("build.gradle") ||
    rootFiles.has("build.gradle.kts") ||
    rootFiles.has("settings.gradle")
  ) {
    return { language: "Java", isNode: false };
  }
  if (
    rootFiles.has("cmakelists.txt") ||
    rootFiles.has("makefile") ||
    rootFiles.has("meson.build")
  ) {
    return { language: "C/C++", isNode: false };
  }
  if (rootFiles.has("gemfile")) {
    return { language: "Ruby", isNode: false };
  }
  if (rootFiles.has("composer.json")) {
    return { language: "PHP", isNode: false };
  }

  // Inspect file extension distribution across repo
  const extCounts: Record<string, number> = {};
  for (const p of filePaths) {
    const ext = p.split(".").pop()?.toLowerCase();
    if (ext) extCounts[ext] = (extCounts[ext] || 0) + 1;
  }

  const cppCount =
    (extCounts["cpp"] || 0) +
    (extCounts["c"] || 0) +
    (extCounts["cc"] || 0) +
    (extCounts["cxx"] || 0) +
    (extCounts["h"] || 0) +
    (extCounts["hpp"] || 0) +
    (extCounts["hxx"] || 0) +
    (extCounts["hh"] || 0) +
    (extCounts["ino"] || 0) +
    (extCounts["pde"] || 0);

  const pyCount = (extCounts["py"] || 0) + (extCounts["ipynb"] || 0) + (extCounts["pyw"] || 0);
  const rsCount = extCounts["rs"] || 0;
  const goCount = extCounts["go"] || 0;
  const javaCount = (extCounts["java"] || 0) + (extCounts["kt"] || 0) + (extCounts["kts"] || 0);
  const csCount = extCounts["cs"] || 0;
  const rbCount = extCounts["rb"] || 0;
  const phpCount = extCounts["php"] || 0;

  const languageScores: { language: string; count: number }[] = [
    { language: "C/C++", count: cppCount },
    { language: "Python", count: pyCount },
    { language: "Rust", count: rsCount },
    { language: "Go", count: goCount },
    { language: "Java", count: javaCount },
    { language: "C#", count: csCount },
    { language: "Ruby", count: rbCount },
    { language: "PHP", count: phpCount },
  ].filter((s) => s.count > 0);

  languageScores.sort((a, b) => b.count - a.count);

  if (languageScores.length > 0) {
    return { language: languageScores[0].language, isNode: false };
  }

  return { language: "Non-Node", isNode: false };
}

/**
 * Recursively extracts all file paths from a TemplateFolder tree.
 */
export function extractAllFilePaths(
  folder: { folderName?: string; items?: unknown[] },
  currentPath = ""
): string[] {
  const paths: string[] = [];
  if (!folder || !Array.isArray(folder.items)) return paths;

  for (const raw of folder.items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as { folderName?: string; filename?: string; fileExtension?: string; items?: unknown[] };
    if (typeof item.folderName === "string") {
      const sub = currentPath ? `${currentPath}/${item.folderName}` : item.folderName;
      paths.push(...extractAllFilePaths(item, sub));
    } else if (typeof item.filename === "string") {
      const ext = typeof item.fileExtension === "string" ? item.fileExtension : "";
      const full = ext ? `${item.filename}.${ext}` : item.filename;
      paths.push(currentPath ? `${currentPath}/${full}` : full);
    }
  }
  return paths;
}

