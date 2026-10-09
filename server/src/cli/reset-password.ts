import readline from "readline";
import { AccountError, forceResetPassword } from "../lib/accounts.js";

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
    login = (await ask("Identifiant : ")).trim();
    password = await ask("Nouveau mot de passe : ");
  }
  rl.close();

  if (!login) {
    console.error("Identifiant requis.");
    process.exit(1);
  }
  try {
    const user = await forceResetPassword(login, password);
    console.log("Mot de passe modifié :", user.login);
    console.log("Les sessions ouvertes de ce compte sont déconnectées.");
  } catch (e) {
    if (e instanceof AccountError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
