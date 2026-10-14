import { spawnSync } from "node:child_process";

const checks = [
  ["npm", ["test"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "test:host"]],
  ...["browser", "lobby", "menu", "table", "dialog", "decision", "action", "assessment", "mobile", "dev"].map(name => ["node", [`scripts/${name}-smoke.mjs`]])
];
for (const [command, args] of checks) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
