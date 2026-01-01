#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createInterface } from "node:readline/promises";

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

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
  init [dir]                      Create a new monorepo (defaults to current directory)
  add app <name> --framework <f>  Add an app (react or hono)
  add package <name>              Add a shared package (use "db" for Drizzle + Neon)
  add auth                        Add Better Auth to a Hono app

Frameworks:
  react    Vite + React + TypeScript
  hono     Hono + Node.js + TypeScript

Options:
  --tailwind          Add Tailwind CSS (React only)
  -h, --help          Show this help message
  -v, --version       Show version

Examples:
  seren init
  seren init my-project
  seren add app web --framework react
  seren add app web --framework react --tailwind
  seren add app api --framework hono
  seren add package utils
  seren add package db
  seren add auth
`.trim();

if (command === "--help" || command === "-h" || !command) {
  console.log(HELP);
  process.exit(0);
} else if (command === "--version" || command === "-v") {
  console.log("0.0.1");
  process.exit(0);
} else if (command === "init") {
  const name = args[1] ?? ".";
  await init(name);
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
    const tailwind = args.includes("--tailwind");
    await addReactApp(name, tailwind);
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
} else if (command === "add" && subcommand === "auth") {
  await addAuth();
} else {
  console.log(`Unknown command: ${command}\n`);
  console.log(HELP);
  process.exit(1);
}

async function addReactApp(name: string, tailwind: boolean) {
  const rootPkg = JSON.parse(await readFile("package.json", "utf-8"));
  const scope = rootPkg.name;
  const dir = `apps/${name}`;

  await mkdir(`${dir}/src`, { recursive: true });

  const devDependencies: Record<string, string> = {
    [`@${scope}/tsconfig`]: "*",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^5",
    typescript: "^5",
    vite: "^7",
  };

  if (tailwind) {
    devDependencies["tailwindcss"] = "^4";
    devDependencies["@tailwindcss/vite"] = "^4";
  }

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
          react: "^19",
          "react-dom": "^19",
        },
        devDependencies,
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
${tailwind ? `import "./index.css";\n` : ""}
createRoot(document.getElementById("root")!).render(<App />);
`
  );

  if (tailwind) {
    await writeFile(`${dir}/src/index.css`, `@import "tailwindcss";\n`);
  }

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
${tailwind ? `import tailwindcss from "@tailwindcss/vite";\n` : ""}
export default defineConfig({
  plugins: [react()${tailwind ? ", tailwindcss()" : ""}],
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

  execSync("npm install", { stdio: "inherit" });

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
          dev: "tsx watch src/index.ts",
          build: "tsc",
          start: "node dist/index.js",
        },
        dependencies: {
          hono: "^4",
          "@hono/node-server": "^1",
        },
        devDependencies: {
          [`@${scope}/tsconfig`]: "*",
          "@types/node": "^22",
          tsx: "^4",
          typescript: "^5",
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

  execSync("npm install", { stdio: "inherit" });

  console.log(`${green("✓")} Created Hono app: ${name}`);
}

async function addPackage(name: string) {
  if (name === "db") {
    await addDbPackage();
    return;
  }
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
          [`@${scope}/tsconfig`]: "*",
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

async function addDbPackage() {
  const rootPkg = JSON.parse(await readFile("package.json", "utf-8"));
  const scope = rootPkg.name;
  const dir = "packages/db";

  await mkdir(`${dir}/src`, { recursive: true });

  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {
    [`@${scope}/tsconfig`]: "*",
  };

  // Step 1 - Install @neondatabase/serverless package
  dependencies["drizzle-orm"] = "^0.38";
  dependencies["@neondatabase/serverless"] = "^0.10";
  dependencies["dotenv"] = "^16";
  devDependencies["drizzle-kit"] = "^0.30";
  devDependencies["tsx"] = "^4";

  // Step 2 - Setup connection variables
  await writeFile(`${dir}/.env`, `DATABASE_URL=\n`);

  // Step 3 - Connect Drizzle ORM to the database
  await writeFile(
    `${dir}/src/index.ts`,
    `import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export const db = drizzle(process.env["DATABASE_URL"]!, { schema });
`
  );

  // Step 4 - Create composable columns
  await writeFile(
    `${dir}/src/columns.ts`,
    `import { integer, timestamp } from "drizzle-orm/pg-core";

export const id = {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
};

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
};
`
  );

  // Step 5 - Create a table
  await writeFile(`${dir}/src/schema.ts`, ``);

  // Step 5 - Setup Drizzle config file
  await writeFile(
    `${dir}/drizzle.config.ts`,
    `import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"]!,
  },
});
`
  );

  // tsconfig.json
  await writeFile(
    `${dir}/tsconfig.json`,
    JSON.stringify(
      {
        extends: `@${scope}/tsconfig/base`,
        include: ["src", "drizzle.config.ts"],
      },
      null,
      2
    )
  );

  // Write package.json and install
  await writeFile(
    `${dir}/package.json`,
    JSON.stringify(
      {
        name: `@${scope}/db`,
        private: true,
        exports: {
          ".": "./src/index.ts",
        },
        dependencies,
        devDependencies,
      },
      null,
      2
    )
  );
  execSync("npm install", { stdio: "inherit" });

  console.log(`${green("✓")} Created db package with Drizzle + Neon`);
}

async function addAuth() {
  // Check prerequisites
  if (!existsSync("packages/db")) {
    console.log(`${red("✗")} packages/db not found. Run 'seren add package db' first.`);
    process.exit(1);
  }

  // Find Hono apps
  const apps = existsSync("apps") ? readdirSync("apps") : [];
  const honoApps: string[] = [];
  for (const app of apps) {
    const pkgPath = `apps/${app}/package.json`;
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
      if (pkg.dependencies?.hono) {
        honoApps.push(app);
      }
    }
  }

  if (honoApps.length === 0) {
    console.log(`${red("✗")} No Hono app found. Run 'seren add app <name> --framework hono' first.`);
    process.exit(1);
  }

  let appName = honoApps[0]!;
  if (honoApps.length > 1) {
    appName = await prompt("Select a Hono app:", honoApps);
  }

  const rootPkg = JSON.parse(await readFile("package.json", "utf-8"));
  const scope = rootPkg.name;

  // Append auth tables to schema.ts
  const schemaPath = "packages/db/src/schema.ts";
  const existingSchema = await readFile(schemaPath, "utf-8");
  await writeFile(
    schemaPath,
    `import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
${existingSchema}
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestamps,
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  ...timestamps,
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  ...timestamps,
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});
`
  );

  // Create auth.ts in db package
  await writeFile(
    "packages/db/src/auth.ts",
    `import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./index";
import * as schema from "./schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
});
`
  );

  // Update db package.json
  const dbPkgPath = "packages/db/package.json";
  const dbPkg = JSON.parse(await readFile(dbPkgPath, "utf-8"));
  dbPkg.dependencies["better-auth"] = "^1";
  dbPkg.exports["./auth"] = "./src/auth.ts";
  await writeFile(dbPkgPath, JSON.stringify(dbPkg, null, 2));

  // Append env vars to .env
  const envPath = "packages/db/.env";
  const envContent = await readFile(envPath, "utf-8");
  if (!envContent.includes("BETTER_AUTH_SECRET")) {
    await writeFile(envPath, envContent + `BETTER_AUTH_SECRET=\nBETTER_AUTH_URL=http://localhost:3000\n`);
  }

  // Update Hono app
  await writeFile(
    `apps/${appName}/src/index.ts`,
    `import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "@${scope}/db/auth";

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

app.use(
  "/api/auth/*",
  cors({
    origin: "http://localhost:5173",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    c.set("user", null);
    c.set("session", null);
    return next();
  }
  c.set("user", session.user);
  c.set("session", session.session);
  return next();
});

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/", (c) => c.text("Hello from ${appName}!"));

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(\`Server running at http://localhost:\${info.port}\`);
});
`
  );

  // Add db dependency to hono app
  const appPkgPath = `apps/${appName}/package.json`;
  const appPkg = JSON.parse(await readFile(appPkgPath, "utf-8"));
  appPkg.dependencies[`@${scope}/db`] = "*";
  await writeFile(appPkgPath, JSON.stringify(appPkg, null, 2));

  execSync("npm install", { stdio: "inherit" });

  console.log(`${green("✓")} Added auth to ${appName}`);
  console.log();
  console.log("Next steps:");
  console.log("  cd packages/db");
  console.log("  npx drizzle-kit generate");
  console.log("  npx drizzle-kit migrate");
}

async function init(name: string) {
  const isCurrentDir = name === ".";
  const prefix = isCurrentDir ? "" : `${name}/`;
  const pkgName = isCurrentDir ? basename(resolve(".")) : basename(name);

  const targetDir = isCurrentDir ? "." : name;
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    console.log(`${red("✗")} Directory is not empty. Use an empty directory.`);
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
          // Type Checking
          allowUnreachableCode: false,
          allowUnusedLabels: false,
          exactOptionalPropertyTypes: true,
          noFallthroughCasesInSwitch: true,
          noImplicitOverride: true,
          noImplicitReturns: true,
          noUncheckedIndexedAccess: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          strict: true,

          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          skipLibCheck: true,
          noEmit: true,
          verbatimModuleSyntax: true,
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

  try {
    execSync(`git init ${isCurrentDir ? "." : name}`, { stdio: "ignore" });
  } catch {
    console.log(`${red("✗")} Failed to initialize git repository. Is git installed?`);
    process.exit(1);
  }

  console.log(`${green("✓")} Created monorepo: ${pkgName}`);
  console.log();
  console.log("Next steps:");
  if (!isCurrentDir) {
    console.log(`  cd ${name}`);
  }
  console.log("  npm install");
}
