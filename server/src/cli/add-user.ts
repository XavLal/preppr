import bcrypt from "bcrypt";
import readline from "readline";
import { loadAccounts, saveAccounts } from "../lib/storage.js";
import { tenantSlugFromLogin } from "../lib/slug.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(q: string): Promise<string> {
  return new Promise((res) => rl.question(q, res));
}

async function main() {
  const argvLogin = process.argv[2]?.trim();
  const argvPassword = process.argv[3];

  let login: string;
  let password: string;

  if (argvLogin && argvPassword) {
    login = argvLogin;
    password = argvPassword;
  } else {
    login = (await ask("Identifiant (famille): ")).trim();
    password = await ask("Mot de passe: ");
  }

  if (!login) {
    console.error("Identifiant requis.");
    process.exit(1);
  }
  try {
    tenantSlugFromLogin(login);
  } catch {
    console.error("Identifiant invalide (lettres, chiffres, tirets).");
    process.exit(1);
  }
  if (password.length < 4) {
    console.error("Mot de passe trop court.");
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  const acc = await loadAccounts();
  if (acc.users.some((u) => u.login.toLowerCase() === login.toLowerCase())) {
    console.error("Cet identifiant existe déjà.");
    process.exit(1);
  }
  acc.users.push({ login, passwordHash: hash });
  await saveAccounts(acc);
  console.log("Compte créé:", login);
  rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
