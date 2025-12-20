#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

if (command === "init") {
  const name = args[1];
  if (!name) {
    console.log("Usage: seren init <name>");
    process.exit(1);
  } else {
    await init(name);
  }
} else if (command === "add" && subcommand === "app") {
  const name = args[2];
  if (!name) {
    console.log("Usage: seren add app <name>");
    process.exit(1);
  } else {
    await addApp(name);
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
  console.log("Usage: seren init <name> | seren add app <name> | seren add package <name>");
  process.exit(1);
}

async function addApp(name: string) {
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
          "@types/node": "^24.10.1",
          "@types/react": "^19.2.5",
          "@types/react-dom": "^19.2.3",
          "@vitejs/plugin-react": "^5.1.1",
          globals: "^16.5.0",
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
        files: [],
        references: [
          { path: "./tsconfig.app.json" },
          { path: "./tsconfig.node.json" },
        ],
      },
      null,
      2
    )
  );

  await writeFile(
    `${dir}/tsconfig.app.json`,
    JSON.stringify(
      {
        compilerOptions: {
          tsBuildInfoFile: "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
          target: "ES2022",
          useDefineForClassFields: true,
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          types: ["vite/client"],
          skipLibCheck: true,

          /* Bundler mode */
          moduleResolution: "bundler",
          allowImportingTsExtensions: true,
          verbatimModuleSyntax: true,
          moduleDetection: "force",
          noEmit: true,
          jsx: "react-jsx",

          /* Linting */
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          erasableSyntaxOnly: true,
          noFallthroughCasesInSwitch: true,
          noUncheckedSideEffectImports: true,
        },
        include: ["src"],
      },
      null,
      2
    )
  );

  await writeFile(
    `${dir}/tsconfig.node.json`,
    JSON.stringify(
      {
        compilerOptions: {
          tsBuildInfoFile: "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
          target: "ES2023",
          lib: ["ES2023"],
          module: "ESNext",
          types: ["node"],
          skipLibCheck: true,

          /* Bundler mode */
          moduleResolution: "bundler",
          allowImportingTsExtensions: true,
          verbatimModuleSyntax: true,
          moduleDetection: "force",
          noEmit: true,

          /* Linting */
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          erasableSyntaxOnly: true,
          noFallthroughCasesInSwitch: true,
          noUncheckedSideEffectImports: true,
        },
        include: ["vite.config.ts"],
      },
      null,
      2
    )
  );

  console.log(`Created app: ${name}`);
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
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["src"],
      },
      null,
      2
    )
  );

  console.log(`Created package: ${name}`);
}

async function init(name: string) {
  await mkdir(`${name}/apps`, { recursive: true });
  await mkdir(`${name}/packages`, { recursive: true });

  await writeFile(
    `${name}/package.json`,
    JSON.stringify(
      {
        name,
        private: true,
        workspaces: ["apps/*", "packages/*"],
      },
      null,
      2
    )
  );

  await writeFile(
    `${name}/.gitignore`,
    `.DS_Store
node_modules
`
  );

  console.log(`Created monorepo: ${name}`);
}
