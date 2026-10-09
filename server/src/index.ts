import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  AccountError,
  changePassword,
  changePasswordSchema,
  createMember,
  credentialsSchema,
  findBySlug,
  listAccounts,
  needsSetup,
  readAccounts,
  resetPassword,
  resetPasswordSchema,
  setupOwner,
  toPublicAccount,
  verifyCredentials,
} from "./lib/accounts.js";
import { importPayloadSchema } from "./lib/schemas.js";
import {
  isAllowlistedRecipeUrl,
  probeRecipeUrlHttpStatus,
} from "./lib/recipeUrlCheck.js";
import { coerceAppState } from "./lib/coerceAppState.js";
import {
  clearSetupToken,
  ensureSetupToken,
  readSetupToken,
  resolveJwtSecret,
  resolveStaticDir,
  safeEqual,
} from "./lib/config.js";
import { RateLimiter } from "./lib/rateLimit.js";
import { AccountsFileError, loadState, restrictDataPermissions, saveState, type AccountUser } from "./lib/storage.js";
import { mergeImportedRecipesIntoShoppingLines } from "./lib/shopping.js";
import {
  validateStateTransition,
  validateRecipesRemoved,
  StateValidationError,
} from "./lib/validate.js";
import type { AppState, ShoppingLine, StoredRecipe } from "./lib/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.umask(0o077);
const JWT_SECRET = await resolveJwtSecret();
await restrictDataPermissions();
const PORT = Number(process.env.PORT ?? 3001);

/** `sv` absent : jeton émis avant les versions de session, équivaut à 0. */
type JwtPayload = {
  sub: string;
  login: string;
  sv?: number;
  long?: boolean;
  iat?: number;
  exp?: number;
};

function isLongLived(p: JwtPayload): boolean {
  if (typeof p.long === "boolean") return p.long;
  return p.exp !== undefined && p.iat !== undefined && p.exp - p.iat > 24 * 3600;
}

function signToken(user: AccountUser, longLived: boolean): string {
  const expiresIn = longLived ? "30d" : "8h";
  const payload: JwtPayload = {
    sub: user.tenantSlug,
    login: user.login,
    sv: user.sessionVersion,
    long: longLived,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

async function parseAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<JwtPayload | undefined> {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Non authentifié", code: "auth.unauthenticated" });
    return undefined;
  }
  let payload: JwtPayload;
  try {
    payload = verifyToken(h.slice(7));
  } catch {
    reply.status(401).send({ error: "Session invalide", code: "auth.invalid_session" });
    return undefined;
  }
  const user = findBySlug(await readAccounts(), payload.sub);
  if (!user || user.sessionVersion !== (payload.sv ?? 0)) {
    reply.status(401).send({ error: "Session invalide", code: "auth.invalid_session" });
    return undefined;
  }
  return payload;
}

function sendAccountError(reply: FastifyReply, e: unknown) {
  if (e instanceof AccountError) {
    return reply.status(e.status).send({ error: e.message, code: e.code });
  }
  throw e;
}

function sessionResponse(user: AccountUser, longLived: boolean) {
  return {
    token: signToken(user, longLived),
    tenantSlug: user.tenantSlug,
    login: user.login,
    role: user.role,
  };
}

const missingCredentials = {
  error: "Identifiant et mot de passe requis.",
  code: "auth.missing_credentials",
};

try {
  await readAccounts();
} catch (e) {
  if (e instanceof AccountsFileError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}

const needsInitialAccount = await needsSetup();
const setupToken = needsInitialAccount ? await ensureSetupToken() : null;
if (!needsInitialAccount) await clearSetupToken();

const app = Fastify({ logger: true });
const limiter = new RateLimiter();
const RATE_WINDOW_MS = 15 * 60 * 1000;

if (setupToken) {
  app.log.info(`Code d'installation Preppr : ${setupToken}`);
}

if (process.env.NODE_ENV !== "production") {
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
}

function rejectIfLimited(reply: FastifyReply, key: string, limit: number): boolean {
  if (!limiter.isBlocked(key, limit, RATE_WINDOW_MS)) return false;
  reply.status(429).send({
    error: "Trop de tentatives. Réessayez dans quelques minutes.",
    code: "auth.rate_limited",
  });
  return true;
}

app.get("/api/auth/status", async () => ({ needsSetup: await needsSetup() }));

app.post("/api/auth/login", async (req, reply) => {
  const parsed = credentialsSchema
    .extend({ rememberMe: z.boolean().optional() })
    .safeParse(req.body);
  if (!parsed.success || !parsed.data.password) {
    return reply.status(400).send(missingCredentials);
  }
  const ipKey = `login-ip:${req.ip}`;
  const loginKey = `login:${parsed.data.login.toLowerCase()}`;
  if (rejectIfLimited(reply, ipKey, 30) || rejectIfLimited(reply, loginKey, 10)) return;
  try {
    const user = await verifyCredentials(parsed.data.login, parsed.data.password);
    limiter.reset(loginKey);
    return sessionResponse(user, Boolean(parsed.data.rememberMe));
  } catch (e) {
    if (e instanceof AccountError && e.code === "auth.invalid_credentials") {
      limiter.record(ipKey, RATE_WINDOW_MS);
      limiter.record(loginKey, RATE_WINDOW_MS);
    }
    return sendAccountError(reply, e);
  }
});

app.post("/api/auth/setup", async (req, reply) => {
  const setupKey = `setup:${req.ip}`;
  if (rejectIfLimited(reply, setupKey, 10)) return;
  limiter.record(setupKey, RATE_WINDOW_MS);
  const parsed = credentialsSchema.extend({ setupToken: z.string() }).safeParse(req.body);
  if (!parsed.success || !parsed.data.setupToken.trim()) {
    return reply.status(400).send(missingCredentials);
  }
  const expected = await readSetupToken();
  if (!expected || !safeEqual(parsed.data.setupToken.trim(), expected)) {
    return reply.status(401).send({
      error: "Code d'installation incorrect.",
      code: "auth.setup_token",
    });
  }
  try {
    const user = await setupOwner(parsed.data.login, parsed.data.password);
    await clearSetupToken();
    return sessionResponse(user, true);
  } catch (e) {
    return sendAccountError(reply, e);
  }
});

app.get("/api/auth/me", async (req, reply) => {
  const auth = await parseAuth(req, reply);
  if (!auth) return;
  const user = findBySlug(await readAccounts(), auth.sub);
  if (!user) return reply.status(401).send({ error: "Session invalide", code: "auth.invalid_session" });
  return toPublicAccount(user);
});

app.post("/api/auth/change-password", async (req, reply) => {
  const auth = await parseAuth(req, reply);
  if (!auth) return;
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Mot de passe actuel et nouveau mot de passe requis.",
      code: "auth.missing_passwords",
    });
  }
  if (rejectIfLimited(reply, `password:${auth.sub}`, 10)) return;
  try {
    const user = await changePassword(
      auth.sub,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );
    limiter.reset(`password:${auth.sub}`);
    return sessionResponse(user, isLongLived(auth));
  } catch (e) {
    if (e instanceof AccountError) limiter.record(`password:${auth.sub}`, RATE_WINDOW_MS);
    return sendAccountError(reply, e);
  }
});

app.get("/api/accounts", async (req, reply) => {
  const auth = await parseAuth(req, reply);
  if (!auth) return;
  try {
    return { accounts: await listAccounts(auth.sub) };
  } catch (e) {
    return sendAccountError(reply, e);
  }
});

app.post("/api/accounts", async (req, reply) => {
  const auth = await parseAuth(req, reply);
  if (!auth) return;
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send(missingCredentials);
  if (rejectIfLimited(reply, `accounts:${auth.sub}`, 20)) return;
  limiter.record(`accounts:${auth.sub}`, RATE_WINDOW_MS);
  try {
    const user = await createMember(auth.sub, parsed.data.login, parsed.data.password);
    return toPublicAccount(user);
  } catch (e) {
    return sendAccountError(reply, e);
  }
});

app.post("/api/accounts/:login/reset-password", async (req, reply) => {
  const auth = await parseAuth(req, reply);
  if (!auth) return;
  const { login } = req.params as { login: string };
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Nouveau mot de passe requis.",
      code: "auth.missing_passwords",
    });
  }
  if (rejectIfLimited(reply, `accounts:${auth.sub}`, 20)) return;
  limiter.record(`accounts:${auth.sub}`, RATE_WINDOW_MS);
  try {
    const user = await resetPassword(auth.sub, login, parsed.data.newPassword);
    return toPublicAccount(user);
  } catch (e) {
    return sendAccountError(reply, e);
  }
});

app.get("/api/state", async (req, reply) => {
  const auth = await parseAuth(req, reply);
  if (!auth) return;
  const state = await loadState(auth.sub);
  return state;
});

app.put("/api/state", async (req, reply) => {
  const auth = await parseAuth(req, reply);
  if (!auth) return;
  const body = req.body as { expectedVersion?: number; state?: AppState };
  if (body.expectedVersion === undefined || !body.state) {
    return reply.status(400).send({
      error: "expectedVersion et state requis.",
      code: "state.missing_body",
    });
  }
  const prev = await loadState(auth.sub);
  if (prev.version !== body.expectedVersion) {
    return reply.status(409).send({
      error: "Conflit de version",
      code: "state.version_conflict",
      state: prev,
    });
  }
  const coerced = coerceAppState(body.state);
  const nextRaw: AppState = {
    ...coerced,
    version: body.expectedVersion + 1,
    updatedAt: new Date().toISOString(),
  };
  try {
    validateStateTransition(prev, nextRaw);
    validateRecipesRemoved(prev, nextRaw);
  } catch (e) {
    if (e instanceof StateValidationError) {
      return reply.status(400).send({ error: e.message, code: e.code });
    }
    throw e;
  }
  await saveState(auth.sub, nextRaw);
  return nextRaw;
});

app.post("/api/clear-recipes", async (req, reply) => {
  const auth = await parseAuth(req, reply);
  if (!auth) return;
  const body = req.body as { expectedVersion?: number };
  if (body.expectedVersion === undefined) {
    return reply.status(400).send({
      error: "expectedVersion requis.",
      code: "state.missing_version",
    });
  }
  const prev = await loadState(auth.sub);
  if (prev.version !== body.expectedVersion) {
    return reply.status(409).send({
      error: "Conflit de version",
      code: "state.version_conflict",
      state: prev,
    });
  }
  const next: AppState = {
    ...prev,
    recipes: [],
    targetPortions: {},
    shoppingLines: prev.shoppingLines.filter((l) => l.manual),
    version: body.expectedVersion + 1,
    updatedAt: new Date().toISOString(),
  };
  await saveState(auth.sub, next);
  return next;
});

app.post("/api/clear-shopping", async (req, reply) => {
  const auth = await parseAuth(req, reply);
  if (!auth) return;
  const body = req.body as { expectedVersion?: number };
  if (body.expectedVersion === undefined) {
    return reply.status(400).send({
      error: "expectedVersion requis.",
      code: "state.missing_version",
    });
  }
  const prev = await loadState(auth.sub);
  if (prev.version !== body.expectedVersion) {
    return reply.status(409).send({
      error: "Conflit de version",
      code: "state.version_conflict",
      state: prev,
    });
  }
  const next: AppState = {
    ...prev,
    shoppingLines: [],
    version: body.expectedVersion + 1,
    updatedAt: new Date().toISOString(),
  };
  await saveState(auth.sub, next);
  return next;
});

app.post("/api/recipe-url-check", async (req, reply) => {
  const auth = await parseAuth(req, reply);
  if (!auth) return;
  const body = req.body as { url?: string };
  const raw = typeof body.url === "string" ? body.url.trim() : "";
  if (!raw) {
    return reply.status(400).send({ error: "Paramètre url requis.", code: "recipe_url.missing" });
  }
  if (!isAllowlistedRecipeUrl(raw)) {
    return { determined: false as const };
  }
  const status = await probeRecipeUrlHttpStatus(raw);
  if (status === null) {
    return { determined: false as const };
  }
  return { determined: true as const, status };
});

app.post("/api/import", async (req, reply) => {
  const auth = await parseAuth(req, reply);
  if (!auth) return;
  const body = req.body as { json?: string };
  if (!body.json || typeof body.json !== "string") {
    return reply.status(400).send({
      error: "Champ json (texte) requis.",
      code: "import.missing_json",
    });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.json);
  } catch {
    return reply.status(400).send({ error: "JSON invalide.", code: "import.invalid_json" });
  }
  const parsedRes = importPayloadSchema.safeParse(parsed);
  if (!parsedRes.success) {
    return reply.status(400).send({
      error: "Format de fichier invalide.",
      code: "import.invalid_format",
      details: parsedRes.error.flatten(),
    });
  }
  const payload = parsedRes.data;
  const prev = await loadState(auth.sub);
  if (prev.version < 1) prev.version = 1;
  const newRecipes: StoredRecipe[] = payload.recipes.map((r) => ({
    recipeInstanceId: randomUUID(),
    sourceRecipeId: r.id,
    weekId: payload.weekId,
    title: r.title,
    source: r.source,
    url: r.url,
    basePortions: r.portions,
    prepTimeMinutes: r.prepTimeMinutes,
    cookingTimeMinutes: r.cookingTimeMinutes,
    equipment: r.equipment,
    tags: r.tags,
    isSpecialMeal: r.isSpecialMeal,
    alreadyCooked: r.alreadyCooked,
    removedFromPlan: false,
    ingredients: r.ingredients.map((i) => ({ ...i })),
    steps: [...r.steps],
  }));
  const extraLines: ShoppingLine[] = payload.extraIngredients.map((ing) => ({
    id: randomUUID(),
    name: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    aisle: ing.aisle,
    checked: false,
    manual: true,
    extraIngredient: true,
  }));

  const shoppingLines = mergeImportedRecipesIntoShoppingLines(
    [...prev.shoppingLines, ...extraLines],
    newRecipes,
    prev.targetPortions
  );
  const next: AppState = {
    ...prev,
    recipes: [...prev.recipes, ...newRecipes],
    shoppingLines,
    version: prev.version + 1,
    updatedAt: new Date().toISOString(),
  };
  await saveState(auth.sub, next);
  return next;
});

const staticDir = resolveStaticDir(__dirname);
if (staticDir) {
  await app.register(staticPlugin, {
    root: staticDir,
    prefix: "/",
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.method === "GET" && !req.url.startsWith("/api")) {
      return reply.sendFile("index.html");
    }
    return reply.status(404).send({ error: "Not found", code: "not_found" });
  });
}

await app.listen({ port: PORT, host: "0.0.0.0" });
