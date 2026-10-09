import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  AccountError,
  changePassword,
  clearAccountsCache,
  createAccount,
  createMember,
  listAccounts,
  migrateDuplicateSlugs,
  needsSetup,
  readAccounts,
  resetPassword,
  setupOwner,
  verifyCredentials,
} from "./accounts.js";
import { AccountsFileError, accountsPath, loadAccounts, resolveDataRoot, tenantDir } from "./storage.js";

const PASSWORD = "correct-horse";

function rejectsWith(code: string) {
  return (e: unknown) => e instanceof AccountError && e.code === code;
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "preppr-accounts-"));
  process.env.DATA_DIR = dir;
  clearAccountsCache();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("accounts.json", () => {
  it("complète les comptes créés avant les rôles", async () => {
    await writeFile(
      accountsPath(),
      JSON.stringify({
        users: [
          { login: "Famille Martin", passwordHash: "h1" },
          { login: "dupont", passwordHash: "h2" },
        ],
      })
    );
    const file = await loadAccounts();
    assert.deepEqual(file.users, [
      {
        login: "Famille Martin",
        passwordHash: "h1",
        role: "owner",
        tenantSlug: "famille-martin",
        sessionVersion: 0,
      },
      {
        login: "dupont",
        passwordHash: "h2",
        role: "member",
        tenantSlug: "dupont",
        sessionVersion: 0,
      },
    ]);
  });

  it("garde un seul propriétaire", async () => {
    await writeFile(
      accountsPath(),
      JSON.stringify({
        users: [
          { login: "a", passwordHash: "h", role: "owner" },
          { login: "b", passwordHash: "h", role: "owner" },
        ],
      })
    );
    const roles = (await loadAccounts()).users.map((u) => u.role);
    assert.deepEqual(roles, ["owner", "member"]);
  });

  it("refuse un fichier corrompu au lieu de le traiter comme vide", async () => {
    await writeFile(accountsPath(), "{ pas du json");
    await assert.rejects(loadAccounts(), AccountsFileError);
    await assert.rejects(needsSetup(), AccountsFileError);
  });

  it("traite un fichier absent comme aucun compte", async () => {
    assert.equal(await needsSetup(), true);
  });
});

describe("premier compte", () => {
  it("crée le propriétaire une seule fois", async () => {
    const owner = await setupOwner("famille", PASSWORD);
    assert.equal(owner.role, "owner");
    assert.equal(await needsSetup(), false);
    await assert.rejects(setupOwner("autre", PASSWORD), rejectsWith("auth.setup_done"));
  });

  it("ne crée qu’un propriétaire pour deux demandes simultanées", async () => {
    const results = await Promise.allSettled([
      setupOwner("un", PASSWORD),
      setupOwner("deux", PASSWORD),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await readAccounts()).users.length, 1);
  });

  it("refuse un mot de passe trop court", async () => {
    await assert.rejects(setupOwner("famille", "abc"), rejectsWith("auth.password_too_short"));
  });

  it("refuse un mot de passe que bcrypt tronquerait", async () => {
    await assert.rejects(
      setupOwner("famille", "a".repeat(73)),
      rejectsWith("auth.password_too_long")
    );
  });
});

describe("foyers", () => {
  beforeEach(async () => {
    await setupOwner("admin", PASSWORD);
  });

  it("refuse deux identifiants qui partagent le même dossier", async () => {
    await createMember("admin", "Famille A", PASSWORD);
    await assert.rejects(
      createMember("admin", "famille-a", PASSWORD),
      rejectsWith("accounts.login_taken")
    );
    await assert.rejects(createAccount("FAMILLE  A", PASSWORD), rejectsWith("accounts.login_taken"));
  });

  it("réserve l’administration au propriétaire", async () => {
    await createMember("admin", "dupont", PASSWORD);
    await assert.rejects(
      createMember("dupont", "autre", PASSWORD),
      rejectsWith("accounts.forbidden")
    );
    await assert.rejects(listAccounts("dupont"), rejectsWith("accounts.forbidden"));
    await assert.rejects(
      resetPassword("dupont", "admin", "nouveau-motdepasse"),
      rejectsWith("accounts.forbidden")
    );
    const logins = (await listAccounts("admin")).map((a) => a.login);
    assert.deepEqual(logins, ["admin", "dupont"]);
  });

  it("crée les comptes suivants comme membres", async () => {
    const user = await createAccount("dupont", PASSWORD);
    assert.equal(user.role, "member");
  });
});

describe("mots de passe", () => {
  beforeEach(async () => {
    await setupOwner("admin", PASSWORD);
    await createMember("admin", "dupont", PASSWORD);
  });

  it("vérifie l’ancien mot de passe et incrémente la version de session", async () => {
    await assert.rejects(
      changePassword("dupont", "faux", "nouveau-motdepasse"),
      rejectsWith("auth.wrong_password")
    );
    const updated = await changePassword("dupont", PASSWORD, "nouveau-motdepasse");
    assert.equal(updated.sessionVersion, 1);
    await assert.rejects(verifyCredentials("dupont", PASSWORD), rejectsWith("auth.invalid_credentials"));
    assert.equal((await verifyCredentials("dupont", "nouveau-motdepasse")).login, "dupont");
  });

  it("laisse le propriétaire réinitialiser un autre compte, pas le sien", async () => {
    const updated = await resetPassword("admin", "Dupont", "nouveau-motdepasse");
    assert.equal(updated.sessionVersion, 1);
    assert.equal((await verifyCredentials("dupont", "nouveau-motdepasse")).login, "dupont");
    await assert.rejects(
      resetPassword("admin", "admin", "nouveau-motdepasse"),
      rejectsWith("accounts.self_reset")
    );
    await assert.rejects(
      resetPassword("admin", "inconnu", "nouveau-motdepasse"),
      rejectsWith("accounts.not_found")
    );
  });
});

describe("données et anciens comptes", () => {
  it("résout un DATA_DIR relatif depuis la racine du dépôt", () => {
    const moduleDir = "/repo/server/dist/lib";
    assert.equal(resolveDataRoot(undefined, moduleDir), "/repo/data");
    assert.equal(resolveDataRoot("data", moduleDir), "/repo/data");
    assert.equal(resolveDataRoot("/var/preppr", moduleDir), "/var/preppr");
  });

  it("refuse deux anciens identifiants sur le même dossier, puis les sépare", async () => {
    await mkdir(tenantDir("famille-a"), { recursive: true });
    await writeFile(path.join(tenantDir("famille-a"), "state.json"), '{"version":1}\n');
    await writeFile(
      accountsPath(),
      JSON.stringify({
        users: [
          { login: "Famille A", passwordHash: "h1" },
          { login: "famille-a", passwordHash: "h2" },
        ],
      })
    );
    await assert.rejects(loadAccounts(), AccountsFileError);
    const moved = await migrateDuplicateSlugs();
    assert.equal(moved.length, 1);
    assert.equal(moved[0].login, "famille-a");
    const file = await loadAccounts();
    assert.equal(file.users[0].tenantSlug, "famille-a");
    assert.equal(file.users[1].tenantSlug, moved[0].to);
    assert.notEqual(file.users[1].tenantSlug, "famille-a");
    const copied = await readFile(path.join(tenantDir(moved[0].to), "state.json"), "utf-8");
    assert.match(copied, /"version":1/);
  });
});
