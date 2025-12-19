import { mkdir } from "node:fs/promises";

const command = Bun.argv[2];

if (command === "init") {
  await init();
} else {
  console.log("usage: seren init");
}

async function init() {
  await Bun.write(
    "package.json",
    JSON.stringify(
      {
        name: "my-project",
        private: true,
        workspaces: ["apps/*", "packages/*"],
      },
      null,
      2
    )
  );

  await mkdir("apps", { recursive: true });
  await mkdir("packages", { recursive: true });

  await Bun.write(
    ".gitignore",
    `.DS_Store
node_modules
`
  );

  console.log("Created monorepo");
}
