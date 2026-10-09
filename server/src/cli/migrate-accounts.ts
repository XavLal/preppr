import { migrateDuplicateSlugs } from "../lib/accounts.js";

async function main() {
  const moved = await migrateDuplicateSlugs();
  if (moved.length === 0) {
    console.log("Aucune collision de foyer.");
    return;
  }
  for (const change of moved) {
    console.log(
      `« ${change.login} » utilise maintenant le dossier ${change.to} (copie de ${change.from}).`
    );
  }
  console.log("Redémarrez Preppr.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
