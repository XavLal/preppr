const readline = require("node:readline");
const { spawnSync } = require("node:child_process");

const IMAGE_NAME = "xavlal/preppr";

function runCommand(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function askVersion() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Version Docker a publier (ex: 0.1.9) : ", (rawVersion) => {
    const version = rawVersion.trim();
    rl.close();

    if (!version) {
      console.error("Version vide: publication annulée.");
      process.exit(1);
    }

    const tag = `${IMAGE_NAME}:${version}`;

    console.log(`\nBuild de ${tag}...`);
    runCommand("docker", ["build", "-t", tag, "."]);

    console.log(`\nPush de ${tag}...`);
    runCommand("docker", ["push", tag]);
  });
}

askVersion();
