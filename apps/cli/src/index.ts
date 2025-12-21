#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createInterface } from "node:readline/promises";

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

function getFlag(flag: string): string | undefined {
  // --flag=value
  const eqIndex = args.findIndex((a) => a.startsWith(`--${flag}=`));
  if (eqIndex !== -1) {
    return args[eqIndex]!.split("=")[1]!;
  }
  // --flag value
  const longIndex = args.indexOf(`--${flag}`);
  if (longIndex !== -1 && args[longIndex + 1]) {
    return args[longIndex + 1];
  }
  // -f value (single char flags)
  if (flag.length === 1) {
    const shortIndex = args.indexOf(`-${flag}`);
    if (shortIndex !== -1 && args[shortIndex + 1]) {
      return args[shortIndex + 1];
    }
  }
  return undefined;
}

async function prompt(question: string, options: string[]): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log(question);
  options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));
  const answer = await rl.question("Enter choice: ");
  rl.close();
  const index = parseInt(answer, 10) - 1;
  if (index >= 0 && index < options.length) {
    return options[index]!;
  }
  return options[0]!;
}

const HELP = `
seren - A CLI for scaffolding monorepo projects

Usage:
  seren <command> [options]

Commands:
  init <name>                     Create a new monorepo
  add app <name> --framework <f>  Add an app (react or hono)
  add package <name>              Add a shared package

Frameworks:
  react    Vite + React + TypeScript
  hono     Hono + Node.js + TypeScript

Options:
  -h, --help          Show this help message
  -v, --version       Show version

Examples:
  seren init my-project
  seren add app web --framework react
  seren add app api --framework hono
  seren add package utils
`.trim();

if (command === "--help" || command === "-h" || !command) {
  console.log(HELP);
  process.exit(0);
} else if (command === "--version" || command === "-v") {
  console.log("0.0.1");
  process.exit(0);
} else if (command === "init") {
  const name = args[1];
  if (!name) {
    console.log("Usage: seren init <name>");
    process.exit(1);
  } else {
    await init(name);
  }
} else if (command === "add" && subcommand === "app") {
  const name = args[2];
  if (!name || name.startsWith("-")) {
    console.log("Usage: seren add app <name> --framework <react|hono>");
    process.exit(1);
  }
  let framework = getFlag("framework") ?? getFlag("f");
  if (!framework) {
    framework = await prompt("Select a framework:", ["react", "hono"]);
  }
  if (framework === "react") {
    await addReactApp(name);
  } else if (framework === "hono") {
    await addHonoApp(name);
  } else {
    console.log(`Unknown framework: ${framework}. Use 'react' or 'hono'.`);
    process.exit(1);
  }
} else if (command === "add" && subcommand === "package") {
  const name = args[2];
  if (!name) {
    console.log("Usage: seren add package <name>");
    process.exit(1);
  } else {
    await addPackage(name);
  }
} else {
  console.log(`Unknown command: ${command}\n`);
  console.log(HELP);
  process.exit(1);
}

async function addReactApp(name: string) {
  const rootPkg = JSON.parse(await readFile("package.json", "utf-8"));
  const scope = rootPkg.name;
  const dir = `apps/${name}`;

  await mkdir(`${dir}/src`, { recursive: true });

  await writeFile(
    `${dir}/package.json`,
    JSON.stringify(
      {
        name: `@${scope}/${name}`,
        private: true,
        scripts: {
          dev: "vite",
          build: "vite build",
        },
        dependencies: {
          react: "^19.2.0",
          "react-dom": "^19.2.0",
        },
        devDependencies: {
          [`@${scope}/tsconfig`]: "workspace:*",
          "@types/react": "^19.2.5",
          "@types/react-dom": "^19.2.3",
          "@vitejs/plugin-react": "^5.1.1",
          typescript: "~5.9.3",
          vite: "^7.2.4",
        },
      },
      null,
      2
    )
  );

  await writeFile(
    `${dir}/index.html`,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
  );

  await writeFile(
    `${dir}/src/main.tsx`,
    `import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
`
  );

  await writeFile(
    `${dir}/src/App.tsx`,
    `export function App() {
  return <h1>Hello from ${name}</h1>;
}
`
  );

  await writeFile(
    `${dir}/vite.config.ts`,
    `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`
  );

  await writeFile(
    `${dir}/tsconfig.json`,
    JSON.stringify(
      {
        extends: `@${scope}/tsconfig/react`,
        compilerOptions: {
          types: ["vite/client"],
        },
        include: ["src", "vite.config.ts"],
      },
      null,
      2
    )
  );

  console.log(`${green("✓")} Created React app: ${name}`);
}

async function addHonoApp(name: string) {
  const rootPkg = JSON.parse(await readFile("package.json", "utf-8"));
  const scope = rootPkg.name;
  const dir = `apps/${name}`;

  await mkdir(`${dir}/src`, { recursive: true });

  await writeFile(
    `${dir}/package.json`,
    JSON.stringify(
      {
        name: `@${scope}/${name}`,
        private: true,
        type: "module",
        scripts: {
          dev: "node --experimental-strip-types --watch src/index.ts",
          build: "tsc",
          start: "node dist/index.js",
        },
        dependencies: {
          hono: "^4.7.0",
          "@hono/node-server": "^1.14.0",
        },
        devDependencies: {
          [`@${scope}/tsconfig`]: "workspace:*",
          "@types/node": "^22.10.2",
          typescript: "~5.9.3",
        },
      },
      null,
      2
    )
  );

  await writeFile(
    `${dir}/src/index.ts`,
    `import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("Hello from ${name}!"));

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(\`Server running at http://localhost:\${info.port}\`);
});
`
  );

  await writeFile(
    `${dir}/tsconfig.json`,
    JSON.stringify(
      {
        extends: `@${scope}/tsconfig/node`,
        compilerOptions: {
          outDir: "dist",
          noEmit: false,
        },
        include: ["src"],
      },
      null,
      2
    )
  );

  console.log(`${green("✓")} Created Hono app: ${name}`);
}

async function addPackage(name: string) {
  const rootPkg = JSON.parse(await readFile("package.json", "utf-8"));
  const scope = rootPkg.name;
  const dir = `packages/${name}`;

  await mkdir(`${dir}/src`, { recursive: true });

  await writeFile(
    `${dir}/package.json`,
    JSON.stringify(
      {
        name: `@${scope}/${name}`,
        private: true,
        exports: {
          ".": "./src/index.ts",
        },
        devDependencies: {
          [`@${scope}/tsconfig`]: "workspace:*",
          typescript: "~5.9.3",
        },
      },
      null,
      2
    )
  );

  await writeFile(
    `${dir}/src/index.ts`,
    `export {};\n`
  );

  await writeFile(
    `${dir}/tsconfig.json`,
    JSON.stringify(
      {
        extends: `@${scope}/tsconfig/base`,
        include: ["src"],
      },
      null,
      2
    )
  );

  console.log(`${green("✓")} Created package: ${name}`);
}

async function init(name: string) {
  const isCurrentDir = name === ".";
  const prefix = isCurrentDir ? "" : `${name}/`;
  const pkgName = isCurrentDir ? basename(resolve(".")) : name;

  if (!isCurrentDir && existsSync(name)) {
    console.log(`Error: Directory "${name}" already exists.`);
    process.exit(1);
  }

  if (existsSync(`${prefix}package.json`)) {
    console.log("Error: package.json already exists in this directory.");
    process.exit(1);
  }

  await mkdir(`${prefix}apps`, { recursive: true });
  await mkdir(`${prefix}packages/tsconfig`, { recursive: true });

  await writeFile(
    `${prefix}package.json`,
    JSON.stringify(
      {
        name: pkgName,
        private: true,
        workspaces: ["apps/*", "packages/*"],
      },
      null,
      2
    )
  );

  await writeFile(
    `${prefix}packages/tsconfig/package.json`,
    JSON.stringify(
      {
        name: `@${pkgName}/tsconfig`,
        private: true,
        exports: {
          "./base": "./base.json",
          "./react": "./react.json",
          "./node": "./node.json",
        },
      },
      null,
      2
    )
  );

  await writeFile(
    `${prefix}packages/tsconfig/base.json`,
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          verbatimModuleSyntax: true,
          noFallthroughCasesInSwitch: true,
          noUncheckedSideEffectImports: true,
        },
      },
      null,
      2
    )
  );

  await writeFile(
    `${prefix}packages/tsconfig/react.json`,
    JSON.stringify(
      {
        extends: "./base.json",
        compilerOptions: {
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          jsx: "react-jsx",
        },
      },
      null,
      2
    )
  );

  await writeFile(
    `${prefix}packages/tsconfig/node.json`,
    JSON.stringify(
      {
        extends: "./base.json",
        compilerOptions: {
          lib: ["ES2023"],
          types: ["node"],
        },
      },
      null,
      2
    )
  );

  await writeFile(
    `${prefix}.gitignore`,
    `.DS_Store
node_modules
dist
`
  );

  execSync(`git init ${isCurrentDir ? "." : name}`, { stdio: "ignore" });

  console.log(`${green("✓")} Created monorepo: ${pkgName}`);
  console.log();
  console.log("Next steps:");
  if (!isCurrentDir) {
    console.log(`  cd ${name}`);
  }
  console.log("  npm install");
}
