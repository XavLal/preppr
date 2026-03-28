import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import bcrypt from "bcrypt";
import staticPlugin from "@fastify/static";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "node:crypto";
import { importPayloadSchema } from "./lib/schemas.js";
import { tenantSlugFromLogin } from "./lib/slug.js";
import {
  loadAccounts,
  loadState,
  saveState,
  recomputeShopping,
} from "./lib/storage.js";
import {
  validateStateTransition,
  validateRecipesRemoved,
  StateValidationError,
} from "./lib/validate.js";
import type { AppState, StoredRecipe } from "./lib/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const PORT = Number(process.env.PORT ?? 3001);

type JwtPayload = { sub: string; login: string };

function signToken(payload: JwtPayload, longLived: boolean): string {
  const expiresIn = longLived ? "30d" : "8h";
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

function parseAuth(
  req: FastifyRequest,
  reply: FastifyReply
): JwtPayload | undefined {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Non authentifié" });
    return undefined;
  }
  try {
    return verifyToken(h.slice(7));
  } catch {
    reply.status(401).send({ error: "Session invalide" });
    return undefined;
  }
}

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true,
});

app.post("/api/auth/login", async (req, reply) => {
  const body = req.body as {
    login?: string;
    password?: string;
    rememberMe?: boolean;
  };
  const login = body.login?.trim();
  const password = body.password ?? "";
  if (!login || !password) {
    return reply.status(400).send({ error: "Identifiant et mot de passe requis." });
  }
  let slug: string;
  try {
    slug = tenantSlugFromLogin(login);
  } catch {
    return reply.status(400).send({ error: "Identifiant invalide." });
  }
  const accounts = await loadAccounts();
  const user = accounts.users.find(
    (u) => u.login.toLowerCase() === login.toLowerCase()
  );
  if (!user) {
    return reply.status(401).send({ error: "Identifiant ou mot de passe incorrect." });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return reply.status(401).send({ error: "Identifiant ou mot de passe incorrect." });
  }
  const token = signToken({ sub: slug, login: user.login }, Boolean(body.rememberMe));
  return { token, tenantSlug: slug, login: user.login };
});

app.get("/api/state", async (req, reply) => {
  const auth = parseAuth(req, reply);
  if (!auth) return;
  const state = await loadState(auth.sub);
  return state;
});

app.put("/api/state", async (req, reply) => {
  const auth = parseAuth(req, reply);
  if (!auth) return;
  const body = req.body as { expectedVersion?: number; state?: AppState };
  if (body.expectedVersion === undefined || !body.state) {
    return reply.status(400).send({ error: "expectedVersion et state requis." });
  }
  const prev = await loadState(auth.sub);
  if (prev.version !== body.expectedVersion) {
    return reply.status(409).send({
      error: "Conflit de version",
      state: prev,
    });
  }
  const nextRaw: AppState = {
    ...body.state,
    version: body.expectedVersion + 1,
    updatedAt: new Date().toISOString(),
  };
  try {
    validateStateTransition(prev, nextRaw);
    validateRecipesRemoved(prev, nextRaw);
  } catch (e) {
    if (e instanceof StateValidationError) {
      return reply.status(400).send({ error: e.message });
    }
    throw e;
  }
  const next = recomputeShopping(nextRaw);
  next.version = body.expectedVersion + 1;
  next.updatedAt = new Date().toISOString();
  await saveState(auth.sub, next);
  return next;
});

app.post("/api/import", async (req, reply) => {
  const auth = parseAuth(req, reply);
  if (!auth) return;
  const body = req.body as { json?: string };
  if (!body.json || typeof body.json !== "string") {
    return reply.status(400).send({ error: "Champ json (texte) requis." });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.json);
  } catch {
    return reply.status(400).send({ error: "JSON invalide." });
  }
  const parsedRes = importPayloadSchema.safeParse(parsed);
  if (!parsedRes.success) {
    return reply.status(400).send({
      error: "Format de fichier invalide.",
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
    equipment: r.equipment,
    tags: r.tags,
    isSpecialMeal: r.isSpecialMeal,
    alreadyCooked: r.alreadyCooked,
    removedFromPlan: false,
    ingredients: r.ingredients.map((i) => ({ ...i })),
    steps: [...r.steps],
  }));
  const nextRaw: AppState = {
    ...prev,
    recipes: [...prev.recipes, ...newRecipes],
    updatedAt: new Date().toISOString(),
  };
  const next = recomputeShopping(nextRaw);
  next.version = prev.version + 1;
  next.updatedAt = new Date().toISOString();
  await saveState(auth.sub, next);
  return next;
});

const staticDir = process.env.CLIENT_DIST;
if (staticDir) {
  await app.register(staticPlugin, {
    root: path.resolve(staticDir),
    prefix: "/",
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.method === "GET" && !req.url.startsWith("/api")) {
      return reply.sendFile("index.html");
    }
    return reply.status(404).send({ error: "Not found" });
  });
}

await app.listen({ port: PORT, host: "0.0.0.0" });
