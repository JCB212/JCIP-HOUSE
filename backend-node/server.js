// JCIP House Finance — Node.js Backend (Express + MySQL)
// Compatible with Hostinger Node.js apps
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const { query, one, tx, pool } = require("./db");
const { runMigrations } = require("./migrations");
const {
  uuidv4, nowUtc, today, genCode, round2,
  findLogicalMonth, monthRangeFor, optimizeDebts,
} = require("./utils");

const isProduction = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || "";
if (isProduction && (!JWT_SECRET || JWT_SECRET === "change-me" || JWT_SECRET.length < 32)) {
  throw new Error("JWT_SECRET obrigatório em produção com pelo menos 32 caracteres");
}
const JWT_SIGNING_SECRET = JWT_SECRET || "dev-only-change-me";
const JWT_EXPIRE_DAYS = Number(process.env.JWT_EXPIRE_DAYS || 30);
const PORT = Number(process.env.PORT || 8001);
const RESET_CODE_MINUTES = Number(process.env.RESET_CODE_MINUTES || 30);
const PASSWORD_MIN_LENGTH = Number(process.env.PASSWORD_MIN_LENGTH || 8);
const startupState = {
  migrations: "pending",
  migrations_error_code: null,
};

const app = express();
app.disable("x-powered-by");
app.set("query parser", "simple");
app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  referrerPolicy: { policy: "no-referrer" },
}));
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: corsOrigin === "*" ? "*" : corsOrigin.split(",").map((s) => s.trim()) }));
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method) && req.headers["content-length"] !== "0" && !req.is("application/json")) {
    return res.status(415).json({ detail: "Use Content-Type: application/json" });
  }
  next();
});
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "256kb", strict: true }));
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
});
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.PASSWORD_RESET_RATE_LIMIT_MAX || 8),
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Muitas tentativas de redefinição. Aguarde e tente novamente." },
});
app.use("/api", apiLimiter);

const api = express.Router();

// ---------- helpers ----------
function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SIGNING_SECRET, { expiresIn: `${JWT_EXPIRE_DAYS}d` });
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validateUuidParam(label) {
  return (_req, res, next, value) => {
    if (!uuidRegex.test(String(value || ""))) {
      return res.status(400).json({ detail: `${label} inválido` });
    }
    next();
  };
}

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function validatePassword(password) {
  const value = String(password || "");
  if (value.length < PASSWORD_MIN_LENGTH || value.length > 128) return false;
  return true;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasUnsafeKeys(value, depth = 0) {
  if (depth > 20) return true;
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => hasUnsafeKeys(item, depth + 1));
  for (const key of Object.keys(value)) {
    if (key === "__proto__" || key === "prototype" || key === "constructor") return true;
    if (hasUnsafeKeys(value[key], depth + 1)) return true;
  }
  return false;
}

function rejectUnsafeInput(req, res, next) {
  if (hasUnsafeKeys(req.body) || hasUnsafeKeys(req.query)) {
    return res.status(400).json({ detail: "Requisição inválida" });
  }
  next();
}

async function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ detail: "Token ausente" });
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    const u = await one("SELECT * FROM users WHERE id=?", [payload.sub]);
    if (!u) return res.status(401).json({ detail: "Usuário inválido" });
    req.user = u;
    next();
  } catch {
    return res.status(401).json({ detail: "Token inválido" });
  }
}

async function ensureMember(houseId, userId) {
  const m = await one(
    "SELECT * FROM house_members WHERE house_id=? AND user_id=?",
    [houseId, userId]
  );
  if (!m) {
    const err = new Error("Você não pertence a esta casa");
    err.status = 403;
    throw err;
  }
  return m;
}

const PERMISSION_LABELS = {
  view_dashboard: "Ver painel da casa",
  view_statement: "Ver extrato da casa",
  manage_expenses: "Cadastrar/remover gastos",
  manage_recurring: "Gerenciar recorrentes",
  manage_contributions: "Gerenciar contribuições",
  manage_payments: "Registrar acertos",
  manage_bills: "Gerenciar contas a pagar/receber",
  manage_shopping_list: "Usar lista de compras",
  manage_chores: "Gerenciar afazeres da casa",
  view_reports: "Ver relatórios completos",
  manage_members: "Gerenciar moradores e permissões",
  manage_settings: "Alterar configurações da casa",
};
const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS);
const DEFAULT_MEMBER_PERMISSIONS = {
  view_dashboard: true,
  view_statement: true,
  manage_expenses: true,
  manage_recurring: true,
  manage_contributions: true,
  manage_payments: true,
  manage_bills: true,
  manage_shopping_list: true,
  manage_chores: false,
  view_reports: true,
  manage_members: false,
  manage_settings: false,
};

function parsePermissions(raw, isOwner = false) {
  if (isOwner) return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true]));
  let saved = {};
  try {
    saved = raw ? JSON.parse(raw) : {};
  } catch {
    saved = {};
  }
  const out = { ...DEFAULT_MEMBER_PERMISSIONS };
  for (const key of PERMISSION_KEYS) {
    if (typeof saved[key] === "boolean") out[key] = saved[key];
  }
  return out;
}

function canMember(member, house, permission) {
  if (!permission) return true;
  const isOwner = member.role === "owner" || member.user_id === house.owner_id;
  if (isOwner) return true;
  const perms = parsePermissions(member.permissions_json, false);
  return perms[permission] === true;
}

async function ensurePermission(houseId, userId, permission) {
  const member = await ensureMember(houseId, userId);
  const house = await one("SELECT * FROM houses WHERE id=?", [houseId]);
  if (!house) {
    const err = new Error("Casa não encontrada");
    err.status = 404;
    throw err;
  }
  if (!canMember(member, house, permission)) {
    const err = new Error("Sem permissão para esta ação");
    err.status = 403;
    throw err;
  }
  return { member, house };
}

async function ensureAnyPermission(houseId, userId, permissions) {
  const member = await ensureMember(houseId, userId);
  const house = await one("SELECT * FROM houses WHERE id=?", [houseId]);
  if (!house) {
    const err = new Error("Casa não encontrada");
    err.status = 404;
    throw err;
  }
  if (!permissions?.length || permissions.some((permission) => canMember(member, house, permission))) {
    return { member, house };
  }
  const err = new Error("Sem permissão para esta ação");
  err.status = 403;
  throw err;
}

function sanitizeUser(u) {
  return { id: u.id, email: u.email, name: u.name, avatar_url: u.avatar_url || null };
}

function resetCodeHash(email, code) {
  return crypto
    .createHash("sha256")
    .update(`${String(email).toLowerCase().trim()}:${String(code).trim()}:${JWT_SIGNING_SECRET}`)
    .digest("hex");
}

function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
}

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

async function sendPasswordResetEmail(to, name, code) {
  if (!smtpConfigured()) {
    const err = new Error("Serviço de e-mail não configurado no servidor");
    err.status = 500;
    throw err;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") !== "false",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  const from = process.env.SMTP_FROM || `"JCIP House" <${process.env.SMTP_USER}>`;
  await transporter.sendMail({
    from,
    to,
    subject: "Código para redefinir sua senha - JCIP House",
    text: `Olá${name ? `, ${name}` : ""}.\n\nSeu código para redefinir a senha do JCIP House é: ${code}\n\nEle expira em ${RESET_CODE_MINUTES} minutos. Se você não pediu isso, ignore este e-mail.`,
  });
}

function wrap(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((e) => {
      console.error(e);
      const status = e.status || 500;
      res.status(status).json({ detail: status >= 500 ? "Erro interno. Tente novamente." : (e.message || "Erro interno") });
    });
  };
}

api.use(rejectUnsafeInput);
for (const [param, label] of Object.entries({
  id: "Casa",
  userId: "Usuário",
  mid: "Mês",
  eid: "Gasto",
  cid: "Contribuição",
  cat: "Categoria",
  itemId: "Item",
  billId: "Conta",
  choreId: "Afazer",
  rid: "Recorrente",
  pid: "Plano",
})) {
  api.param(param, validateUuidParam(label));
}

// ---------- seed defaults ----------
const DEFAULT_CATEGORIES = [
  { name: "Alimentação", icon: "utensils", color: "#f97316", is_market_style: 0 },
  { name: "Supermercado", icon: "shopping-cart", color: "#10b981", is_market_style: 1 },
  { name: "Moradia", icon: "home", color: "#3b82f6", is_market_style: 0 },
  { name: "Contas", icon: "zap", color: "#eab308", is_market_style: 0 },
  { name: "Transporte", icon: "car", color: "#8b5cf6", is_market_style: 0 },
  { name: "Lazer", icon: "film", color: "#ec4899", is_market_style: 0 },
  { name: "Saúde", icon: "heart", color: "#ef4444", is_market_style: 0 },
  { name: "Outros", icon: "tag", color: "#6b7280", is_market_style: 0 },
];

async function ensureMonth(houseId, isoDate, startDay) {
  const { year, month_number } = findLogicalMonth(isoDate, startDay);
  let m = await one(
    "SELECT * FROM months WHERE house_id=? AND year=? AND month_number=?",
    [houseId, year, month_number]
  );
  if (m) return m;
  const { start, end } = monthRangeFor(year, month_number, startDay);
  const id = uuidv4();
  await query(
    `INSERT INTO months (id, house_id, year, month_number, status, start_date, end_date, carried_balance, created_at)
     VALUES (?,?,?,?, 'open', ?,?, 0, ?)`,
    [id, houseId, year, month_number, start, end, nowUtc()]
  );
  return await one("SELECT * FROM months WHERE id=?", [id]);
}

async function currentMonth(houseId, startDay) {
  return await ensureMonth(houseId, today(), startDay);
}

// ---------- expense split ----------
async function computeShares(houseId, payload, amount) {
  const splitType = payload.split_type || "equal";
  const expenseType = payload.expense_type || "collective";
  if (expenseType === "individual" || splitType === "individual") {
    return [{ user_id: payload.payer_id, share_amount: round2(amount) }];
  }
  let pids = (payload.participants || []).map((p) => p.user_id);
  if (pids.length === 0) {
    const ms = await query("SELECT user_id FROM house_members WHERE house_id=?", [houseId]);
    pids = ms.map((m) => m.user_id);
  }

  if (splitType === "equal") {
    const share = round2(amount / pids.length);
    const res = pids.map((uid) => ({ user_id: uid, share_amount: share }));
    const diff = round2(amount - share * pids.length);
    if (res.length && Math.abs(diff) > 0) {
      res[0].share_amount = round2(res[0].share_amount + diff);
    }
    return res;
  }

  if (splitType === "weight") {
    const placeholders = pids.map(() => "?").join(",");
    const ms = await query(
      `SELECT user_id, weight FROM house_members WHERE house_id=? AND user_id IN (${placeholders})`,
      [houseId, ...pids]
    );
    const wmap = Object.fromEntries(ms.map((m) => [m.user_id, m.weight]));
    const tw = pids.reduce((s, u) => s + (wmap[u] || 1), 0) || 1;
    const res = [];
    let acc = 0;
    pids.forEach((uid, i) => {
      const w = wmap[uid] || 1;
      const share = i === pids.length - 1 ? round2(amount - acc) : round2((amount * w) / tw);
      if (i !== pids.length - 1) acc += share;
      res.push({ user_id: uid, share_amount: share });
    });
    return res;
  }

  if (splitType === "custom") {
    const total = round2((payload.participants || []).reduce((s, p) => s + (p.share_amount || 0), 0));
    if (Math.abs(total - amount) > 0.02) {
      const e = new Error(`Soma das partes (${total}) ≠ total (${amount})`);
      e.status = 400;
      throw e;
    }
    return (payload.participants || []).map((p) => ({
      user_id: p.user_id,
      share_amount: round2(p.share_amount || 0),
    }));
  }

  const e = new Error("split_type inválido");
  e.status = 400;
  throw e;
}

// ---------- serializers ----------
async function serializeHouse(h) {
  const members = await query(
    `SELECT hm.*, u.name as user_name, u.email, u.avatar_url
     FROM house_members hm JOIN users u ON u.id=hm.user_id
     WHERE hm.house_id=?`,
    [h.id]
  );
  return {
    id: h.id, name: h.name, invite_code: h.invite_code, currency: h.currency,
    owner_id: h.owner_id,
    gamification_enabled: !!h.gamification_enabled,
    month_start_day: h.month_start_day,
    permissions_catalog: PERMISSION_LABELS,
    members: members.map((m) => {
      const isOwner = m.role === "owner" || m.user_id === h.owner_id;
      return {
        id: m.id, user_id: m.user_id, name: m.user_name, email: m.email,
        weight: m.weight, role: m.role, avatar_url: m.avatar_url,
        permissions: parsePermissions(m.permissions_json, isOwner),
      };
    }),
  };
}

async function serializeExpense(e) {
  const payer = await one("SELECT name FROM users WHERE id=?", [e.payer_id]);
  const creator = e.created_by_user_id ? await one("SELECT name FROM users WHERE id=?", [e.created_by_user_id]) : null;
  const cat = e.category_id ? await one("SELECT * FROM categories WHERE id=?", [e.category_id]) : null;
  const parts = await query(
    `SELECT ep.*, u.name FROM expense_participants ep
     JOIN users u ON u.id=ep.user_id WHERE ep.expense_id=?`,
    [e.id]
  );
  const items = await query("SELECT * FROM expense_items WHERE expense_id=?", [e.id]);
  return {
    id: e.id, month_id: e.month_id,
    description: e.description, amount: e.amount,
    payer_id: e.payer_id, payer_name: payer ? payer.name : "",
    category_id: e.category_id, category_name: cat ? cat.name : null,
    category_icon: cat ? cat.icon : null, category_color: cat ? cat.color : null,
    expense_date: e.expense_date, expense_type: e.expense_type, split_type: e.split_type,
    has_items: !!e.has_items, is_paid: !!e.is_paid,
    is_recurring_instance: !!e.is_recurring_instance,
    notes: e.notes,
    created_by_user_id: e.created_by_user_id || null,
    created_by_name: creator ? creator.name : null,
    participants: parts.map((p) => ({
      user_id: p.user_id, name: p.name, share_amount: p.share_amount,
    })),
    items: items.map((i) => ({
      id: i.id, name: i.name, quantity: i.quantity, unit_price: i.unit_price, total: i.total,
    })),
    created_at: e.created_at,
  };
}

// ============== ROUTES ==============

api.get("/", (_req, res) => res.json({ message: "JCIP House Finance API (Node.js)", status: "online" }));

api.get("/health", async (_req, res) => {
  const startedAt = Date.now();
  const exposeDetails = process.env.EXPOSE_HEALTH_DETAILS === "true";
  try {
    await one("SELECT 1 AS ok");
    const payload = {
      status: "ok",
      api: "online",
      database: "online",
      migrations: startupState.migrations,
      latency_ms: Date.now() - startedAt,
      timestamp: nowUtc(),
    };
    if (exposeDetails) payload.db_configured = !!process.env.DB_NAME;
    res.json(payload);
  } catch (e) {
    const payload = {
      status: "degraded",
      api: "online",
      database: "offline",
      migrations: startupState.migrations,
      latency_ms: Date.now() - startedAt,
      timestamp: nowUtc(),
    };
    if (exposeDetails) {
      payload.db_configured = !!process.env.DB_NAME;
      payload.db_error_code = e?.code || "UNKNOWN";
      payload.startup_error_code = startupState.migrations_error_code;
    }
    res.status(503).json(payload);
  }
});

// AUTH
api.post("/auth/register", authLimiter, wrap(async (req, res) => {
  const { email, name, password } = req.body || {};
  const em = normalizeEmail(email);
  const cleanName = String(name || "").trim();
  if (!isEmail(em) || cleanName.length < 2 || !validatePassword(password)) {
    return res.status(400).json({ detail: `Dados inválidos. Use e-mail válido, nome e senha com no mínimo ${PASSWORD_MIN_LENGTH} caracteres.` });
  }
  const exists = await one("SELECT id FROM users WHERE email=?", [em]);
  if (exists) return res.status(400).json({ detail: "Este email já está cadastrado" });
  const hash = await bcrypt.hash(String(password), 10);
  const id = uuidv4();
  const n = nowUtc();
  await tx(async (c) => {
    await c.execute(
      `INSERT INTO users (id,email,name,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
      [id, em, cleanName.slice(0, 120), hash, n, n]
    );
    if (req.body?.accepted_lgpd === true) {
      await c.execute(
        `INSERT INTO user_consents (id,user_id,consent_type,version,accepted_at,ip_address,user_agent)
         VALUES (?,?,?,?,?,?,?)`,
        [
          uuidv4(),
          id,
          "lgpd_terms",
          "1.2-test",
          n,
          req.ip || null,
          String(req.headers["user-agent"] || "").slice(0, 500) || null,
        ]
      );
    }
  });
  const u = await one("SELECT * FROM users WHERE id=?", [id]);
  res.json({ token: signToken(id), user: sanitizeUser(u) });
}));

api.post("/auth/login", authLimiter, wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const u = await one("SELECT * FROM users WHERE email=?", [normalizeEmail(email)]);
  if (!u || !(await bcrypt.compare(password || "", u.password_hash))) {
    await wait(250 + crypto.randomInt(0, 250));
    return res.status(401).json({ detail: "Email ou senha inválidos" });
  }
  res.json({ token: signToken(u.id), user: sanitizeUser(u) });
}));

api.get("/auth/me", auth, wrap(async (req, res) => res.json(sanitizeUser(req.user))));

api.put("/auth/me", auth, wrap(async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (name.length < 2) return res.status(400).json({ detail: "Nome inválido" });
  await query("UPDATE users SET name=?, updated_at=? WHERE id=?", [name, nowUtc(), req.user.id]);
  const fresh = await one("SELECT * FROM users WHERE id=?", [req.user.id]);
  res.json(sanitizeUser(fresh));
}));

api.post("/auth/forgot-password", passwordResetLimiter, wrap(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isEmail(email)) return res.status(400).json({ detail: "Informe um e-mail válido" });
  const u = await one("SELECT * FROM users WHERE email=?", [email]);
  if (!u) {
    return res.json({ ok: true, message: "Se o e-mail existir, enviaremos um código de redefinição." });
  }
  const code = String(crypto.randomInt(100000, 1000000));
  await query(
    `INSERT INTO password_reset_tokens (id,user_id,email,code_hash,expires_at,created_at)
     VALUES (?,?,?,?,?,?)`,
    [uuidv4(), u.id, email, resetCodeHash(email, code), minutesFromNow(RESET_CODE_MINUTES), nowUtc()]
  );
  await sendPasswordResetEmail(email, u.name, code);
  res.json({ ok: true, message: "Código enviado para o e-mail informado." });
}));

api.post("/auth/reset-password", passwordResetLimiter, wrap(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();
  const password = String(req.body?.password || "");
  if (!isEmail(email) || !/^\d{6}$/.test(code) || !validatePassword(password)) {
    return res.status(400).json({ detail: `Informe e-mail, código de 6 números e senha com no mínimo ${PASSWORD_MIN_LENGTH} caracteres` });
  }
  const u = await one("SELECT * FROM users WHERE email=?", [email]);
  if (!u) return res.status(400).json({ detail: "Código inválido ou expirado" });
  const token = await one(
    `SELECT * FROM password_reset_tokens
     WHERE user_id=? AND email=? AND code_hash=? AND used_at IS NULL AND expires_at >= ?
     ORDER BY created_at DESC LIMIT 1`,
    [u.id, email, resetCodeHash(email, code), nowUtc()]
  );
  if (!token) return res.status(400).json({ detail: "Código inválido ou expirado" });
  const hash = await bcrypt.hash(String(password), 10);
  await tx(async (c) => {
    await c.execute("UPDATE users SET password_hash=?, updated_at=? WHERE id=?", [hash, nowUtc(), u.id]);
    await c.execute("UPDATE password_reset_tokens SET used_at=? WHERE id=?", [nowUtc(), token.id]);
  });
  res.json({ ok: true, message: "Senha alterada com sucesso." });
}));

// HOUSES
api.post("/houses", auth, wrap(async (req, res) => {
  const { name, currency = "BRL", month_start_day = 1 } = req.body || {};
  if (!name || name.length < 2) return res.status(400).json({ detail: "Nome inválido" });
  let code;
  for (let i = 0; i < 10; i++) {
    code = genCode();
    const x = await one("SELECT id FROM houses WHERE invite_code=?", [code]);
    if (!x) break;
  }
  const id = uuidv4();
  const msd = Math.min(Math.max(1, Number(month_start_day) || 1), 28);
  await tx(async (c) => {
    await c.execute(
      `INSERT INTO houses (id,name,invite_code,currency,owner_id,gamification_enabled,month_start_day,created_at)
       VALUES (?,?,?,?,?,1,?,?)`,
      [id, name, code, currency, req.user.id, msd, nowUtc()]
    );
    await c.execute(
      `INSERT INTO house_members (id,house_id,user_id,weight,role,joined_at) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), id, req.user.id, 1.0, "owner", nowUtc()]
    );
    for (const cat of DEFAULT_CATEGORIES) {
      await c.execute(
        `INSERT INTO categories (id,house_id,name,icon,color,is_market_style,created_at) VALUES (?,?,?,?,?,?,?)`,
        [uuidv4(), id, cat.name, cat.icon, cat.color, cat.is_market_style, nowUtc()]
      );
    }
    await c.execute(
      `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), id, req.user.id, "house.created", name, nowUtc()]
    );
  });
  const h = await one("SELECT * FROM houses WHERE id=?", [id]);
  res.json(await serializeHouse(h));
}));

api.post("/houses/join", auth, wrap(async (req, res) => {
  const code = String(req.body?.invite_code || "").trim().toUpperCase();
  const h = await one("SELECT * FROM houses WHERE invite_code=?", [code]);
  if (!h) return res.status(404).json({ detail: "Código de convite inválido" });
  const existing = await one(
    "SELECT id FROM house_members WHERE house_id=? AND user_id=?",
    [h.id, req.user.id]
  );
  if (!existing) {
    await query(
      `INSERT INTO house_members (id,house_id,user_id,weight,role,joined_at) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), h.id, req.user.id, 1.0, "member", nowUtc()]
    );
    await query(
      `INSERT INTO activity_logs (id,house_id,user_id,action,created_at) VALUES (?,?,?,?,?)`,
      [uuidv4(), h.id, req.user.id, "member.joined", nowUtc()]
    );
  }
  res.json(await serializeHouse(h));
}));

api.get("/houses", auth, wrap(async (req, res) => {
  const hs = await query(
    `SELECT h.* FROM houses h
     JOIN house_members hm ON hm.house_id=h.id
     WHERE hm.user_id=?`,
    [req.user.id]
  );
  const out = [];
  for (const h of hs) out.push(await serializeHouse(h));
  res.json(out);
}));

api.get("/houses/:id", auth, wrap(async (req, res) => {
  await ensureMember(req.params.id, req.user.id);
  const h = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  if (!h) return res.status(404).json({ detail: "Casa não encontrada" });
  res.json(await serializeHouse(h));
}));

api.put("/houses/:id/settings", auth, wrap(async (req, res) => {
  const { house: h } = await ensurePermission(req.params.id, req.user.id, "manage_settings");
  if (!h) return res.status(404).json({ detail: "Casa não encontrada" });
  const { name, month_start_day, gamification_enabled } = req.body || {};
  const updates = [];
  const values = [];
  if (name != null) { updates.push("name=?"); values.push(name); }
  if (month_start_day != null) {
    const d = Math.min(Math.max(1, Number(month_start_day)), 28);
    updates.push("month_start_day=?"); values.push(d);
  }
  if (gamification_enabled != null) { updates.push("gamification_enabled=?"); values.push(gamification_enabled ? 1 : 0); }
  if (updates.length) {
    values.push(req.params.id);
    await query(`UPDATE houses SET ${updates.join(",")} WHERE id=?`, values);
  }
  const fresh = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  res.json(await serializeHouse(fresh));
}));

api.put("/houses/:id/members/weight", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_members");
  const { user_id, weight } = req.body || {};
  const m = await one("SELECT id FROM house_members WHERE house_id=? AND user_id=?",
    [req.params.id, user_id]);
  if (!m) return res.status(404).json({ detail: "Membro não encontrado" });
  await query("UPDATE house_members SET weight=? WHERE id=?",
    [Math.max(0.1, Number(weight) || 1), m.id]);
  const h = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  res.json(await serializeHouse(h));
}));

api.delete("/houses/:id/members/:userId", auth, wrap(async (req, res) => {
  const h = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  if (!h) return res.status(404).json({ detail: "Casa não encontrada" });
  if (req.user.id !== req.params.userId) {
    await ensurePermission(req.params.id, req.user.id, "manage_members");
  }
  if (req.params.userId === h.owner_id) {
    return res.status(400).json({ detail: "Não pode remover o dono" });
  }
  await query("DELETE FROM house_members WHERE house_id=? AND user_id=?",
    [req.params.id, req.params.userId]);
  res.json({ ok: true });
}));

api.put("/houses/:id/members/:userId/permissions", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_members");
  const h = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  if (!h) return res.status(404).json({ detail: "Casa não encontrada" });
  if (req.params.userId === h.owner_id) {
    return res.status(400).json({ detail: "O dono sempre tem todas as permissões" });
  }
  const target = await one("SELECT * FROM house_members WHERE house_id=? AND user_id=?",
    [req.params.id, req.params.userId]);
  if (!target) return res.status(404).json({ detail: "Membro não encontrado" });
  const input = req.body?.permissions || {};
  const clean = {};
  for (const key of PERMISSION_KEYS) clean[key] = input[key] === true;
  await query("UPDATE house_members SET permissions_json=? WHERE id=?",
    [JSON.stringify(clean), target.id]);
  const fresh = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  res.json(await serializeHouse(fresh));
}));

api.post("/houses/:id/transfer-owner", auth, wrap(async (req, res) => {
  const h = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  if (!h) return res.status(404).json({ detail: "Casa não encontrada" });
  if (h.owner_id !== req.user.id) {
    return res.status(403).json({ detail: "Apenas o dono atual pode transferir a casa" });
  }

  const targetUserId = req.body?.new_owner_user_id || req.body?.target_user_id;
  const confirmHouseName = String(req.body?.confirm_house_name || "").trim();
  const confirmText = String(req.body?.confirm_text || "").trim().toUpperCase();
  if (!targetUserId || targetUserId === req.user.id) {
    return res.status(400).json({ detail: "Escolha outro morador para receber a casa" });
  }
  if (confirmHouseName !== h.name || confirmText !== "TRANSFERIR") {
    return res.status(400).json({
      detail: "Confirmação inválida. Digite o nome exato da casa e a palavra TRANSFERIR.",
    });
  }

  const target = await one(
    `SELECT hm.*, u.name
     FROM house_members hm JOIN users u ON u.id=hm.user_id
     WHERE hm.house_id=? AND hm.user_id=?`,
    [req.params.id, targetUserId]
  );
  if (!target) return res.status(404).json({ detail: "O novo dono precisa ser morador desta casa" });

  const allPermissions = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true]));
  await tx(async (c) => {
    await c.execute("UPDATE houses SET owner_id=? WHERE id=?", [targetUserId, req.params.id]);
    await c.execute(
      "UPDATE house_members SET role='member', permissions_json=? WHERE house_id=? AND user_id=?",
      [JSON.stringify(allPermissions), req.params.id, req.user.id]
    );
    await c.execute(
      "UPDATE house_members SET role='owner', permissions_json=NULL WHERE house_id=? AND user_id=?",
      [req.params.id, targetUserId]
    );
    await c.execute(
      `INSERT INTO house_ownership_transfers
       (id,house_id,previous_owner_id,new_owner_id,confirmed_by_user_id,confirmation_text,created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [uuidv4(), req.params.id, req.user.id, targetUserId, req.user.id, confirmText, nowUtc()]
    );
    await c.execute(
      `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), req.params.id, req.user.id, "house.owner_transferred", target.name, nowUtc()]
    );
  });
  const fresh = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  res.json(await serializeHouse(fresh));
}));

// CATEGORIES
api.get("/houses/:id/categories", auth, wrap(async (req, res) => {
  await ensureMember(req.params.id, req.user.id);
  const cats = await query("SELECT * FROM categories WHERE house_id=? ORDER BY name", [req.params.id]);
  res.json(cats.map((c) => ({
    id: c.id, name: c.name, icon: c.icon, color: c.color,
    parent_id: c.parent_id, is_market_style: !!c.is_market_style,
  })));
}));

api.post("/houses/:id/categories", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_settings");
  const { name, icon = "tag", color = "#3b82f6", parent_id = null, is_market_style = false } = req.body || {};
  if (!name) return res.status(400).json({ detail: "Nome obrigatório" });
  const id = uuidv4();
  await query(
    `INSERT INTO categories (id,house_id,name,icon,color,parent_id,is_market_style,created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, req.params.id, name, icon, color, parent_id, is_market_style ? 1 : 0, nowUtc()]
  );
  const c = await one("SELECT * FROM categories WHERE id=?", [id]);
  res.json({
    id: c.id, name: c.name, icon: c.icon, color: c.color,
    parent_id: c.parent_id, is_market_style: !!c.is_market_style,
  });
}));

api.delete("/houses/:id/categories/:cat", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_settings");
  await query("DELETE FROM categories WHERE id=? AND house_id=?", [req.params.cat, req.params.id]);
  res.json({ ok: true });
}));

// MONTHS
api.get("/houses/:id/months", auth, wrap(async (req, res) => {
  await ensureAnyPermission(req.params.id, req.user.id, ["view_dashboard", "view_statement", "view_reports", "manage_settings"]);
  const h = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  await currentMonth(h.id, h.month_start_day);
  const ms = await query(
    "SELECT * FROM months WHERE house_id=? ORDER BY year DESC, month_number DESC",
    [req.params.id]
  );
  res.json(ms.map((m) => ({
    id: m.id, year: m.year, month_number: m.month_number, status: m.status,
    start_date: m.start_date, end_date: m.end_date,
    carried_balance: m.carried_balance, closed_at: m.closed_at,
  })));
}));

api.post("/houses/:id/months/:mid/close", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_settings");
  const m = await one("SELECT * FROM months WHERE id=? AND house_id=?",
    [req.params.mid, req.params.id]);
  if (!m) return res.status(404).json({ detail: "Mês não encontrado" });
  if (m.status === "closed") return res.status(400).json({ detail: "Já fechado" });
  const contribs = await query(
    "SELECT SUM(amount) AS t FROM contributions WHERE house_id=? AND month_id=?",
    [req.params.id, m.id]
  );
  const exps = await query(
    "SELECT SUM(amount) AS t FROM expenses WHERE house_id=? AND month_id=? AND expense_type='collective'",
    [req.params.id, m.id]
  );
  const balance = round2((contribs[0].t || 0) - (exps[0].t || 0));
  const carry = !!(req.body && req.body.carry_balance);
  await query(
    "UPDATE months SET status='closed', closed_at=?, carried_balance=? WHERE id=?",
    [nowUtc(), carry ? balance : 0, m.id]
  );
  await query(
    `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
    [uuidv4(), req.params.id, req.user.id, "month.closed", `${m.year}-${String(m.month_number).padStart(2,"0")}`, nowUtc()]
  );
  const fresh = await one("SELECT * FROM months WHERE id=?", [m.id]);
  res.json({
    id: fresh.id, year: fresh.year, month_number: fresh.month_number, status: fresh.status,
    start_date: fresh.start_date, end_date: fresh.end_date,
    carried_balance: fresh.carried_balance, closed_at: fresh.closed_at,
  });
}));

api.post("/houses/:id/months/:mid/reopen", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_settings");
  await query(
    "UPDATE months SET status='open', closed_at=NULL WHERE id=? AND house_id=?",
    [req.params.mid, req.params.id]
  );
  const m = await one("SELECT * FROM months WHERE id=?", [req.params.mid]);
  if (!m) return res.status(404).json({ detail: "Mês não encontrado" });
  res.json({
    id: m.id, year: m.year, month_number: m.month_number, status: m.status,
    start_date: m.start_date, end_date: m.end_date,
    carried_balance: m.carried_balance, closed_at: m.closed_at,
  });
}));

// EXPENSES
api.post("/houses/:id/expenses", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_expenses");
  const p = req.body || {};
  await ensureMember(req.params.id, p.payer_id);
  const h = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  const expDate = p.expense_date || today();
  const month = await ensureMonth(h.id, expDate, h.month_start_day);
  if (month.status === "closed") return res.status(400).json({ detail: "Mês fechado" });

  let amount;
  const items = p.items || [];
  if (items.length > 0) {
    amount = round2(items.reduce((s, it) => s + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0), 0));
  } else {
    if (!p.amount || p.amount <= 0) return res.status(400).json({ detail: "Informe o valor" });
    amount = round2(p.amount);
  }

  const shares = await computeShares(h.id, p, amount);
  const id = uuidv4();
  await tx(async (c) => {
    await c.execute(
      `INSERT INTO expenses
       (id,house_id,month_id,payer_id,category_id,description,amount,expense_date,expense_type,split_type,has_items,is_paid,is_recurring_instance,notes,created_by_user_id,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)`,
      [
        id, h.id, month.id, p.payer_id, p.category_id || null,
        p.description, amount, expDate, p.expense_type || "collective",
        p.split_type || "equal", items.length > 0 ? 1 : 0,
        p.is_paid === false ? 0 : 1, p.notes || null, req.user.id, nowUtc(),
      ]
    );
    for (const s of shares) {
      await c.execute(
        "INSERT INTO expense_participants (id,expense_id,user_id,share_amount) VALUES (?,?,?,?)",
        [uuidv4(), id, s.user_id, s.share_amount]
      );
    }
    for (const it of items) {
      const totalItem = round2((it.quantity || 1) * (it.unit_price || 0));
      await c.execute(
        `INSERT INTO expense_items (id,expense_id,name,quantity,unit_price,total,created_at)
         VALUES (?,?,?,?,?,?,?)`,
        [uuidv4(), id, it.name, it.quantity || 1, it.unit_price || 0, totalItem, nowUtc()]
      );
    }
    await c.execute(
      `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), h.id, req.user.id, "expense.created", p.description, nowUtc()]
    );
  });
  const e = await one("SELECT * FROM expenses WHERE id=?", [id]);
  res.json(await serializeExpense(e));
}));

api.get("/houses/:id/expenses", auth, wrap(async (req, res) => {
  await ensureAnyPermission(req.params.id, req.user.id, ["view_statement", "view_reports", "manage_expenses"]);
  const { month_id } = req.query;
  const params = [req.params.id];
  let sql = "SELECT * FROM expenses WHERE house_id=?";
  if (month_id) { sql += " AND month_id=?"; params.push(month_id); }
  sql += " ORDER BY expense_date DESC, created_at DESC LIMIT 500";
  const rows = await query(sql, params);
  const out = [];
  for (const e of rows) out.push(await serializeExpense(e));
  res.json(out);
}));

api.delete("/houses/:id/expenses/:eid", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_expenses");
  const e = await one("SELECT * FROM expenses WHERE id=? AND house_id=?",
    [req.params.eid, req.params.id]);
  if (!e) return res.status(404).json({ detail: "Não encontrada" });
  if (e.month_id) {
    const m = await one("SELECT status FROM months WHERE id=?", [e.month_id]);
    if (m && m.status === "closed") return res.status(400).json({ detail: "Mês fechado" });
  }
  await query("DELETE FROM expenses WHERE id=?", [req.params.eid]);
  await query(
    `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
    [uuidv4(), req.params.id, req.user.id, "expense.deleted", e.description, nowUtc()]
  );
  res.json({ ok: true });
}));

// CONTRIBUTIONS
api.post("/houses/:id/contributions", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_contributions");
  const p = req.body || {};
  await ensureMember(req.params.id, p.user_id);
  const h = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  const cdate = p.contribution_date || today();
  const m = await ensureMonth(h.id, cdate, h.month_start_day);
  if (m.status === "closed") return res.status(400).json({ detail: "Mês fechado" });
  const id = uuidv4();
  await query(
    `INSERT INTO contributions (id,house_id,month_id,user_id,amount,description,contribution_date,is_auto,created_by_user_id,created_at)
     VALUES (?,?,?,?,?,?,?,0,?,?)`,
    [id, h.id, m.id, p.user_id, round2(p.amount), p.description || null, cdate, req.user.id, nowUtc()]
  );
  await query(
    `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
    [uuidv4(), h.id, req.user.id, "contribution.created", `${round2(p.amount)} para ${p.user_id}`, nowUtc()]
  );
  const c = await one("SELECT * FROM contributions WHERE id=?", [id]);
  const u = await one("SELECT name FROM users WHERE id=?", [c.user_id]);
  res.json({
    id: c.id, user_id: c.user_id, user_name: u.name, amount: c.amount,
    description: c.description, contribution_date: c.contribution_date,
    is_auto: !!c.is_auto, month_id: c.month_id, created_at: c.created_at,
  });
}));

api.get("/houses/:id/contributions", auth, wrap(async (req, res) => {
  await ensureAnyPermission(req.params.id, req.user.id, ["view_statement", "view_reports", "manage_contributions"]);
  const params = [req.params.id];
  let sql = `SELECT c.*, u.name AS user_name FROM contributions c
             JOIN users u ON u.id=c.user_id WHERE c.house_id=?`;
  if (req.query.month_id) { sql += " AND c.month_id=?"; params.push(req.query.month_id); }
  sql += " ORDER BY c.contribution_date DESC, c.created_at DESC";
  const rows = await query(sql, params);
  res.json(rows.map((c) => ({
    id: c.id, user_id: c.user_id, user_name: c.user_name, amount: c.amount,
    description: c.description, contribution_date: c.contribution_date,
    is_auto: !!c.is_auto, month_id: c.month_id, created_at: c.created_at,
  })));
}));

api.delete("/houses/:id/contributions/:cid", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_contributions");
  const contribution = await one("SELECT amount FROM contributions WHERE id=? AND house_id=?",
    [req.params.cid, req.params.id]);
  await query("DELETE FROM contributions WHERE id=? AND house_id=?",
    [req.params.cid, req.params.id]);
  if (contribution) {
    await query(
      `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), req.params.id, req.user.id, "contribution.deleted", String(contribution.amount), nowUtc()]
    );
  }
  res.json({ ok: true });
}));

// PAYMENTS
api.post("/houses/:id/payments", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_payments");
  const p = req.body || {};
  await ensureMember(req.params.id, p.from_user_id);
  await ensureMember(req.params.id, p.to_user_id);
  const id = uuidv4();
  await query(
    `INSERT INTO payments (id,house_id,from_user_id,to_user_id,amount,note,payment_date,created_by_user_id,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, req.params.id, p.from_user_id, p.to_user_id, round2(p.amount), p.note || null, today(), req.user.id, nowUtc()]
  );
  await query(
    `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
    [uuidv4(), req.params.id, req.user.id, "payment.created", String(round2(p.amount)), nowUtc()]
  );
  res.json({ ok: true, id });
}));

// STATEMENT
api.get("/houses/:id/statement", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "view_statement");
  const params = [req.params.id];
  let monthFilter = "";
  let selectedMonth = null;
  if (req.query.month_id) {
    selectedMonth = await one("SELECT * FROM months WHERE id=? AND house_id=?", [req.query.month_id, req.params.id]);
    if (!selectedMonth) return res.status(404).json({ detail: "Mês não encontrado" });
    monthFilter = " AND month_id=?";
    params.push(req.query.month_id);
  }

  const expenses = await query(
    `SELECT e.*, u.name AS user_name, c.name AS category_name
     FROM expenses e
     JOIN users u ON u.id=e.payer_id
     LEFT JOIN categories c ON c.id=e.category_id
     WHERE e.house_id=?${monthFilter}`,
    params
  );
  const contributions = await query(
    `SELECT co.*, u.name AS user_name
     FROM contributions co JOIN users u ON u.id=co.user_id
     WHERE co.house_id=?${monthFilter}`,
    params
  );
  const payParams = [req.params.id];
  let payFilter = "";
  if (selectedMonth) {
    payFilter = " AND p.payment_date >= ? AND p.payment_date < ?";
    payParams.push(selectedMonth.start_date, selectedMonth.end_date);
  }
  const payments = await query(
    `SELECT p.*, fu.name AS from_name, tu.name AS to_name
     FROM payments p
     JOIN users fu ON fu.id=p.from_user_id
     JOIN users tu ON tu.id=p.to_user_id
     WHERE p.house_id=?${payFilter}`,
    payParams
  );

  const rows = [
    ...expenses.map((e) => ({
      id: e.id,
      type: "expense",
      direction: "out",
      date: e.expense_date,
      amount: e.amount,
      title: e.description,
      subtitle: `${e.user_name}${e.category_name ? ` • ${e.category_name}` : ""}`,
      user_id: e.payer_id,
      created_at: e.created_at,
    })),
    ...contributions.map((c) => ({
      id: c.id,
      type: "contribution",
      direction: "in",
      date: c.contribution_date,
      amount: c.amount,
      title: c.description || "Contribuição",
      subtitle: c.user_name,
      user_id: c.user_id,
      created_at: c.created_at,
    })),
    ...payments.map((p) => ({
      id: p.id,
      type: "payment",
      direction: "transfer",
      date: p.payment_date,
      amount: p.amount,
      title: p.note || "Acerto de contas",
      subtitle: `${p.from_name} pagou ${p.to_name}`,
      user_id: p.from_user_id,
      created_at: p.created_at,
    })),
  ].sort((a, b) => String(b.date + b.created_at).localeCompare(String(a.date + a.created_at)));

  res.json(rows);
}));

// SHOPPING LIST
api.get("/houses/:id/shopping-items", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_shopping_list");
  const rows = await query(
    `SELECT s.*, u.name AS created_by_name, cu.name AS checked_by_name
     FROM shopping_list_items s
     LEFT JOIN users u ON u.id=s.created_by_user_id
     LEFT JOIN users cu ON cu.id=s.checked_by_user_id
     WHERE s.house_id=?
     ORDER BY s.is_checked ASC, s.created_at DESC`,
    [req.params.id]
  );
  res.json(rows.map((s) => ({
    id: s.id,
    name: s.name,
    quantity: s.quantity,
    unit: s.unit,
    notes: s.notes,
    is_checked: !!s.is_checked,
    created_by_user_id: s.created_by_user_id,
    created_by_name: s.created_by_name,
    checked_by_user_id: s.checked_by_user_id,
    checked_by_name: s.checked_by_name,
    checked_at: s.checked_at,
    created_at: s.created_at,
    updated_at: s.updated_at,
  })));
}));

api.post("/houses/:id/shopping-items", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_shopping_list");
  const name = String(req.body?.name || "").trim();
  if (name.length < 2) return res.status(400).json({ detail: "Nome do item inválido" });
  const id = uuidv4();
  await query(
    `INSERT INTO shopping_list_items
     (id,house_id,created_by_user_id,name,quantity,unit,notes,is_checked,checked_by_user_id,checked_at,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, req.params.id, req.user.id, name,
      Math.max(0.01, Number(req.body?.quantity) || 1),
      req.body?.unit ? String(req.body.unit).slice(0, 30) : null,
      req.body?.notes ? String(req.body.notes).slice(0, 255) : null,
      req.body?.is_checked ? 1 : 0,
      req.body?.is_checked ? req.user.id : null,
      req.body?.is_checked ? nowUtc() : null,
      nowUtc(),
    ]
  );
  await query(
    `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
    [uuidv4(), req.params.id, req.user.id, "shopping.created", name, nowUtc()]
  );
  const rows = await query("SELECT * FROM shopping_list_items WHERE id=?", [id]);
  res.json({ ...rows[0], is_checked: !!rows[0].is_checked });
}));

api.put("/houses/:id/shopping-items/:itemId", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_shopping_list");
  const current = await one("SELECT * FROM shopping_list_items WHERE id=? AND house_id=?",
    [req.params.itemId, req.params.id]);
  if (!current) return res.status(404).json({ detail: "Item não encontrado" });
  const name = req.body?.name != null ? String(req.body.name).trim() : current.name;
  if (name.length < 2) return res.status(400).json({ detail: "Nome do item inválido" });
  const nextChecked = req.body?.is_checked != null ? (req.body.is_checked ? 1 : 0) : current.is_checked;
  const changedToChecked = !current.is_checked && nextChecked === 1;
  const changedToOpen = current.is_checked && nextChecked === 0;
  await query(
    `UPDATE shopping_list_items
     SET name=?, quantity=?, unit=?, notes=?, is_checked=?, checked_by_user_id=?, checked_at=?, updated_at=?
     WHERE id=? AND house_id=?`,
    [
      name,
      req.body?.quantity != null ? Math.max(0.01, Number(req.body.quantity) || 1) : current.quantity,
      req.body?.unit != null ? String(req.body.unit).slice(0, 30) : current.unit,
      req.body?.notes != null ? String(req.body.notes).slice(0, 255) : current.notes,
      nextChecked,
      changedToChecked ? req.user.id : changedToOpen ? null : current.checked_by_user_id,
      changedToChecked ? nowUtc() : changedToOpen ? null : current.checked_at,
      nowUtc(),
      req.params.itemId,
      req.params.id,
    ]
  );
  if (changedToChecked || changedToOpen) {
    await query(
      `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), req.params.id, req.user.id, changedToChecked ? "shopping.checked" : "shopping.unchecked", name, nowUtc()]
    );
  }
  const fresh = await one("SELECT * FROM shopping_list_items WHERE id=?", [req.params.itemId]);
  res.json({ ...fresh, is_checked: !!fresh.is_checked });
}));

api.delete("/houses/:id/shopping-items/:itemId", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_shopping_list");
  const item = await one("SELECT name FROM shopping_list_items WHERE id=? AND house_id=?", [req.params.itemId, req.params.id]);
  await query("DELETE FROM shopping_list_items WHERE id=? AND house_id=?", [req.params.itemId, req.params.id]);
  if (item) {
    await query(
      `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), req.params.id, req.user.id, "shopping.deleted", item.name, nowUtc()]
    );
  }
  res.json({ ok: true });
}));

// BILLS (accounts payable / receivable)
function serializeBill(b) {
  return {
    id: b.id,
    bill_type: b.bill_type,
    title: b.title,
    description: b.description,
    amount: b.amount,
    paid_amount: b.paid_amount,
    due_date: b.due_date,
    paid_at: b.paid_at,
    status: b.status,
    party_name: b.party_name,
    category_id: b.category_id,
    category_name: b.category_name || null,
    user_id: b.user_id,
    user_name: b.user_name || null,
    created_at: b.created_at,
    updated_at: b.updated_at,
  };
}

api.get("/houses/:id/bills", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_bills");
  const params = [req.params.id];
  let sql = `SELECT b.*, c.name AS category_name, u.name AS user_name
             FROM bills b
             LEFT JOIN categories c ON c.id=b.category_id
             LEFT JOIN users u ON u.id=b.user_id
             WHERE b.house_id=?`;
  if (req.query.bill_type) {
    sql += " AND b.bill_type=?";
    params.push(req.query.bill_type);
  }
  if (req.query.status) {
    sql += " AND b.status=?";
    params.push(req.query.status);
  }
  sql += " ORDER BY b.status='paid' ASC, b.due_date ASC, b.created_at DESC LIMIT 500";
  const rows = await query(sql, params);
  res.json(rows.map(serializeBill));
}));

api.post("/houses/:id/bills", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_bills");
  const p = req.body || {};
  const title = String(p.title || "").trim();
  const billType = ["payable", "receivable"].includes(p.bill_type) ? p.bill_type : "payable";
  if (!title || !(Number(p.amount) > 0) || !p.due_date) {
    return res.status(400).json({ detail: "Informe título, valor e vencimento" });
  }
  if (p.user_id) await ensureMember(req.params.id, p.user_id);
  const id = uuidv4();
  await query(
    `INSERT INTO bills
     (id,house_id,user_id,category_id,bill_type,title,description,amount,paid_amount,due_date,status,party_name,created_by_user_id,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, req.params.id, p.user_id || null, p.category_id || null, billType,
      title, p.description || null, round2(p.amount), 0, p.due_date,
      p.status || "open", p.party_name || null, req.user.id, nowUtc(),
    ]
  );
  await query(
    `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
    [uuidv4(), req.params.id, req.user.id, billType === "payable" ? "bill.payable.created" : "bill.receivable.created", title, nowUtc()]
  );
  const row = await one(
    `SELECT b.*, c.name AS category_name, u.name AS user_name
     FROM bills b
     LEFT JOIN categories c ON c.id=b.category_id
     LEFT JOIN users u ON u.id=b.user_id WHERE b.id=?`,
    [id]
  );
  res.json(serializeBill(row));
}));

api.put("/houses/:id/bills/:billId", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_bills");
  const current = await one("SELECT * FROM bills WHERE id=? AND house_id=?", [req.params.billId, req.params.id]);
  if (!current) return res.status(404).json({ detail: "Conta não encontrada" });
  const p = req.body || {};
  const status = p.status || current.status;
  const paidAmount = p.paid_amount != null ? round2(p.paid_amount) : current.paid_amount;
  await query(
    `UPDATE bills SET title=?, description=?, amount=?, paid_amount=?, due_date=?,
       status=?, party_name=?, paid_at=?, updated_at=?
     WHERE id=? AND house_id=?`,
    [
      p.title != null ? String(p.title).trim() : current.title,
      p.description != null ? p.description : current.description,
      p.amount != null ? round2(p.amount) : current.amount,
      paidAmount,
      p.due_date || current.due_date,
      status,
      p.party_name != null ? p.party_name : current.party_name,
      status === "paid" ? (current.paid_at || nowUtc()) : null,
      nowUtc(),
      req.params.billId,
      req.params.id,
    ]
  );
  await query(
    `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
    [uuidv4(), req.params.id, req.user.id, status === "paid" ? "bill.paid" : "bill.updated", p.title || current.title, nowUtc()]
  );
  const row = await one(
    `SELECT b.*, c.name AS category_name, u.name AS user_name
     FROM bills b
     LEFT JOIN categories c ON c.id=b.category_id
     LEFT JOIN users u ON u.id=b.user_id WHERE b.id=?`,
    [req.params.billId]
  );
  res.json(serializeBill(row));
}));

api.delete("/houses/:id/bills/:billId", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_bills");
  const bill = await one("SELECT title FROM bills WHERE id=? AND house_id=?", [req.params.billId, req.params.id]);
  await query("DELETE FROM bills WHERE id=? AND house_id=?", [req.params.billId, req.params.id]);
  if (bill) {
    await query(
      `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), req.params.id, req.user.id, "bill.deleted", bill.title, nowUtc()]
    );
  }
  res.json({ ok: true });
}));

// CHORES
function sqlDateTimeFromDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function addMonthsSafe(date, count) {
  const next = new Date(date.getTime());
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + count);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

function nextChoreDueAt(dueAt, recurrence) {
  const value = String(recurrence || "none");
  if (!value || value === "none") return null;
  const parts = value.split(":");
  const base = dueAt ? new Date(String(dueAt).replace(" ", "T")) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  if (parts[0] === "daily") {
    const timesPerDay = Math.max(1, Math.min(Number(parts[1] || 1), 12));
    base.setHours(base.getHours() + Math.round(24 / timesPerDay));
    return sqlDateTimeFromDate(base);
  }
  if (parts[0] === "weekly") {
    base.setDate(base.getDate() + 7);
    return sqlDateTimeFromDate(base);
  }
  if (parts[0] === "biweekly") {
    base.setDate(base.getDate() + 14);
    return sqlDateTimeFromDate(base);
  }
  if (parts[0] === "monthly") {
    return sqlDateTimeFromDate(addMonthsSafe(base, 1));
  }
  if (parts[0] === "every") {
    const interval = Math.max(1, Math.min(Number(parts[1] || 1), 365));
    const unit = parts[2] || "days";
    if (unit === "weeks") base.setDate(base.getDate() + interval * 7);
    else if (unit === "months") return sqlDateTimeFromDate(addMonthsSafe(base, interval));
    else base.setDate(base.getDate() + interval);
    return sqlDateTimeFromDate(base);
  }
  return null;
}

async function createNextRecurringChore(conn, chore, assignments) {
  const nextDueAt = nextChoreDueAt(chore.due_at, chore.recurrence);
  if (!nextDueAt) return null;
  const nextId = uuidv4();
  await conn.execute(
    `INSERT INTO house_chores
     (id,house_id,title,description,due_at,recurrence,status,created_by_user_id,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      nextId,
      chore.house_id,
      chore.title,
      chore.description || null,
      nextDueAt,
      chore.recurrence,
      "open",
      chore.created_by_user_id,
      nowUtc(),
    ]
  );
  for (const a of assignments) {
    await conn.execute(
      `INSERT INTO house_chore_assignments (id,chore_id,user_id,status,created_at)
       VALUES (?,?,?,?,?)`,
      [uuidv4(), nextId, a.user_id, "pending", nowUtc()]
    );
  }
  return nextId;
}

async function serializeChore(row) {
  const assignments = await query(
    `SELECT a.*, u.name AS user_name, u.email
     FROM house_chore_assignments a
     JOIN users u ON u.id=a.user_id
     WHERE a.chore_id=?
     ORDER BY u.name`,
    [row.id]
  );
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    due_at: row.due_at,
    recurrence: row.recurrence,
    status: row.status,
    created_by_user_id: row.created_by_user_id,
    created_by_name: row.created_by_name || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    assignments: assignments.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      user_name: a.user_name,
      email: a.email,
      status: a.status,
      completed_at: a.completed_at,
      completed_by_user_id: a.completed_by_user_id,
    })),
  };
}

async function canCompleteChore(choreId, userId, houseId) {
  const assignedCount = await one(
    `SELECT COUNT(*) AS total FROM house_chore_assignments WHERE chore_id=?`,
    [choreId]
  );
  if (Number(assignedCount?.total || 0) === 0) {
    await ensureMember(houseId, userId);
    return true;
  }
  const assignment = await one(
    `SELECT a.id FROM house_chore_assignments a
     JOIN house_chores c ON c.id=a.chore_id
     WHERE a.chore_id=? AND c.house_id=? AND a.user_id=?`,
    [choreId, houseId, userId]
  );
  if (assignment) return true;
  const member = await ensureMember(houseId, userId);
  const h = await one("SELECT * FROM houses WHERE id=?", [houseId]);
  return canMember(member, h, "manage_chores");
}

api.get("/houses/:id/chores", auth, wrap(async (req, res) => {
  await ensureMember(req.params.id, req.user.id);
  const rows = await query(
    `SELECT c.*, u.name AS created_by_name
     FROM house_chores c
     LEFT JOIN users u ON u.id=c.created_by_user_id
     WHERE c.house_id=?
     ORDER BY c.status='done' ASC, c.due_at IS NULL ASC, c.due_at ASC, c.created_at DESC`,
    [req.params.id]
  );
  const out = [];
  for (const row of rows) out.push(await serializeChore(row));
  res.json(out);
}));

api.post("/houses/:id/chores", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_chores");
  const title = String(req.body?.title || "").trim();
  if (title.length < 2) return res.status(400).json({ detail: "Título inválido" });
  const assignees = Array.isArray(req.body?.assignee_user_ids) ? req.body.assignee_user_ids : [];
  for (const uid of assignees) await ensureMember(req.params.id, uid);
  const id = uuidv4();
  await tx(async (c) => {
    await c.execute(
      `INSERT INTO house_chores
       (id,house_id,title,description,due_at,recurrence,status,created_by_user_id,created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        id,
        req.params.id,
        title,
        req.body?.description || null,
        req.body?.due_at || null,
        req.body?.recurrence || "none",
        "open",
        req.user.id,
        nowUtc(),
      ]
    );
    for (const uid of assignees) {
      await c.execute(
        `INSERT INTO house_chore_assignments (id,chore_id,user_id,status,created_at)
         VALUES (?,?,?,?,?)`,
        [uuidv4(), id, uid, "pending", nowUtc()]
      );
    }
    await c.execute(
      `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), req.params.id, req.user.id, "chore.created", title, nowUtc()]
    );
  });
  const row = await one(
    `SELECT c.*, u.name AS created_by_name
     FROM house_chores c LEFT JOIN users u ON u.id=c.created_by_user_id WHERE c.id=?`,
    [id]
  );
  res.json(await serializeChore(row));
}));

api.post("/houses/:id/chores/:choreId/claim", auth, wrap(async (req, res) => {
  await ensureMember(req.params.id, req.user.id);
  const chore = await one("SELECT * FROM house_chores WHERE id=? AND house_id=?",
    [req.params.choreId, req.params.id]);
  if (!chore) return res.status(404).json({ detail: "Afazer não encontrado" });
  if (chore.status === "done") return res.status(400).json({ detail: "Este afazer já foi concluído" });
  const existing = await one(
    "SELECT id FROM house_chore_assignments WHERE chore_id=? AND user_id=?",
    [req.params.choreId, req.user.id]
  );
  if (!existing) {
    await query(
      `INSERT INTO house_chore_assignments (id,chore_id,user_id,status,created_at)
       VALUES (?,?,?,?,?)`,
      [uuidv4(), req.params.choreId, req.user.id, "pending", nowUtc()]
    );
    await query(
      `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), req.params.id, req.user.id, "chore.claimed", chore.title, nowUtc()]
    );
  }
  const row = await one(
    `SELECT c.*, u.name AS created_by_name
     FROM house_chores c LEFT JOIN users u ON u.id=c.created_by_user_id WHERE c.id=?`,
    [req.params.choreId]
  );
  res.json(await serializeChore(row));
}));

api.post("/houses/:id/chores/:choreId/complete", auth, wrap(async (req, res) => {
  await ensureMember(req.params.id, req.user.id);
  const chore = await one("SELECT * FROM house_chores WHERE id=? AND house_id=?",
    [req.params.choreId, req.params.id]);
  if (!chore) return res.status(404).json({ detail: "Afazer não encontrado" });
  if (chore.status === "done") {
    const doneRow = await one(
      `SELECT c.*, u.name AS created_by_name
       FROM house_chores c LEFT JOIN users u ON u.id=c.created_by_user_id WHERE c.id=?`,
      [req.params.choreId]
    );
    return res.json(await serializeChore(doneRow));
  }
  if (!(await canCompleteChore(req.params.choreId, req.user.id, req.params.id))) {
    return res.status(403).json({ detail: "Apenas responsáveis ou gestores podem concluir" });
  }
  await tx(async (c) => {
    const [assignmentRows] = await c.execute(
      "SELECT id FROM house_chore_assignments WHERE chore_id=? AND user_id=?",
      [req.params.choreId, req.user.id]
    );
    const assignment = assignmentRows[0];
    if (!assignment) {
      await c.execute(
        `INSERT INTO house_chore_assignments (id,chore_id,user_id,status,created_at)
         VALUES (?,?,?,?,?)`,
        [uuidv4(), req.params.choreId, req.user.id, "pending", nowUtc()]
      );
    }
    await c.execute(
      `UPDATE house_chore_assignments
       SET status='done', completed_at=?, completed_by_user_id=?
       WHERE chore_id=? AND user_id=?`,
      [nowUtc(), req.user.id, req.params.choreId, req.user.id]
    );
    const [pendingRows] = await c.execute(
      "SELECT id FROM house_chore_assignments WHERE chore_id=? AND status<>'done' LIMIT 1",
      [req.params.choreId]
    );
    const pending = pendingRows[0];
    const [nextAssignments] = await c.execute(
      "SELECT DISTINCT user_id FROM house_chore_assignments WHERE chore_id=?",
      [req.params.choreId]
    );
    await c.execute(
      "UPDATE house_chores SET status=?, updated_at=? WHERE id=?",
      [pending ? "open" : "done", nowUtc(), req.params.choreId]
    );
    if (!pending) {
      await createNextRecurringChore(c, chore, nextAssignments);
    }
    await c.execute(
      `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), req.params.id, req.user.id, "chore.completed", chore.title, nowUtc()]
    );
  });
  const row = await one(
    `SELECT c.*, u.name AS created_by_name
     FROM house_chores c LEFT JOIN users u ON u.id=c.created_by_user_id WHERE c.id=?`,
    [req.params.choreId]
  );
  res.json(await serializeChore(row));
}));

api.delete("/houses/:id/chores/:choreId", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_chores");
  const chore = await one("SELECT title FROM house_chores WHERE id=? AND house_id=?", [req.params.choreId, req.params.id]);
  await query("DELETE FROM house_chores WHERE id=? AND house_id=?", [req.params.choreId, req.params.id]);
  if (chore) {
    await query(
      `INSERT INTO activity_logs (id,house_id,user_id,action,details,created_at) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), req.params.id, req.user.id, "chore.deleted", chore.title, nowUtc()]
    );
  }
  res.json({ ok: true });
}));

// REPORTS
const REPORT_ACTION_LABELS = {
  "house.created": "Casa criada",
  "member.joined": "Morador entrou na casa",
  "month.closed": "Mês fechado",
  "expense.created": "Gasto cadastrado",
  "expense.deleted": "Gasto removido",
  "contribution.created": "Contribuição cadastrada",
  "contribution.deleted": "Contribuição removida",
  "payment.created": "Acerto registrado",
  "shopping.created": "Item criado na lista de compras",
  "shopping.checked": "Item marcado como comprado",
  "shopping.unchecked": "Item voltou para pendente",
  "shopping.deleted": "Item removido da lista de compras",
  "bill.payable.created": "Conta a pagar criada",
  "bill.receivable.created": "Conta a receber criada",
  "bill.paid": "Conta marcada como paga",
  "bill.updated": "Conta atualizada",
  "bill.deleted": "Conta removida",
  "chore.created": "Afazer criado",
  "chore.claimed": "Afazer assumido",
  "chore.completed": "Afazer concluído",
  "chore.deleted": "Afazer removido",
  "house.owner_transferred": "Dono da casa alterado",
};

function queryDate(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function firstRow(rows, fallback = {}) {
  return rows && rows[0] ? rows[0] : fallback;
}

api.get("/houses/:id/reports", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "view_reports");
  const h = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  if (!h) return res.status(404).json({ detail: "Casa não encontrada" });
  const current = await currentMonth(h.id, h.month_start_day);
  const from = queryDate(req.query.from) || current.start_date;
  const to = queryDate(req.query.to) || current.end_date;

  const expenseSummary = firstRow(await query(
    `SELECT COUNT(*) AS total_count, COALESCE(SUM(amount),0) AS total_amount
     FROM expenses WHERE house_id=? AND expense_date BETWEEN ? AND ?`,
    [req.params.id, from, to]
  ), { total_count: 0, total_amount: 0 });
  const contributionSummary = firstRow(await query(
    `SELECT COUNT(*) AS total_count, COALESCE(SUM(amount),0) AS total_amount
     FROM contributions WHERE house_id=? AND contribution_date BETWEEN ? AND ?`,
    [req.params.id, from, to]
  ), { total_count: 0, total_amount: 0 });
  const shoppingSummary = firstRow(await query(
    `SELECT COUNT(*) AS total_count,
            COALESCE(SUM(CASE WHEN is_checked=1 THEN 1 ELSE 0 END),0) AS checked_count
     FROM shopping_list_items WHERE house_id=? AND DATE(created_at) BETWEEN ? AND ?`,
    [req.params.id, from, to]
  ), { total_count: 0, checked_count: 0 });
  const choreSummary = firstRow(await query(
    `SELECT COUNT(*) AS total_count,
            COALESCE(SUM(CASE WHEN status='done' THEN 1 ELSE 0 END),0) AS done_count
     FROM house_chores WHERE house_id=? AND DATE(created_at) BETWEEN ? AND ?`,
    [req.params.id, from, to]
  ), { total_count: 0, done_count: 0 });
  const billsByStatus = await query(
    `SELECT bill_type, status, COUNT(*) AS total_count, COALESCE(SUM(amount),0) AS total_amount
     FROM bills WHERE house_id=? AND due_date BETWEEN ? AND ?
     GROUP BY bill_type, status`,
    [req.params.id, from, to]
  );

  const expensesByPerson = await query(
    `SELECT e.payer_id AS user_id, u.name, COUNT(*) AS purchase_count,
            COALESCE(SUM(e.amount),0) AS total_paid
     FROM expenses e JOIN users u ON u.id=e.payer_id
     WHERE e.house_id=? AND e.expense_date BETWEEN ? AND ?
     GROUP BY e.payer_id, u.name
     ORDER BY total_paid DESC`,
    [req.params.id, from, to]
  );
  const expensesRegisteredBy = await query(
    `SELECT e.created_by_user_id AS user_id, u.name, COUNT(*) AS registered_count,
            COALESCE(SUM(e.amount),0) AS total_amount
     FROM expenses e LEFT JOIN users u ON u.id=e.created_by_user_id
     WHERE e.house_id=? AND e.expense_date BETWEEN ? AND ?
     GROUP BY e.created_by_user_id, u.name
     ORDER BY registered_count DESC`,
    [req.params.id, from, to]
  );
  const contributionsByPerson = await query(
    `SELECT c.user_id, u.name, COUNT(*) AS contribution_count,
            COALESCE(SUM(c.amount),0) AS total_contributed
     FROM contributions c JOIN users u ON u.id=c.user_id
     WHERE c.house_id=? AND c.contribution_date BETWEEN ? AND ?
     GROUP BY c.user_id, u.name
     ORDER BY total_contributed DESC`,
    [req.params.id, from, to]
  );
  const shoppingAddedBy = await query(
    `SELECT s.created_by_user_id AS user_id, u.name, COUNT(*) AS added_count
     FROM shopping_list_items s LEFT JOIN users u ON u.id=s.created_by_user_id
     WHERE s.house_id=? AND DATE(s.created_at) BETWEEN ? AND ?
     GROUP BY s.created_by_user_id, u.name
     ORDER BY added_count DESC`,
    [req.params.id, from, to]
  );
  const shoppingCheckedBy = await query(
    `SELECT s.checked_by_user_id AS user_id, u.name, COUNT(*) AS checked_count
     FROM shopping_list_items s LEFT JOIN users u ON u.id=s.checked_by_user_id
     WHERE s.house_id=? AND s.is_checked=1 AND s.checked_at IS NOT NULL AND DATE(s.checked_at) BETWEEN ? AND ?
     GROUP BY s.checked_by_user_id, u.name
     ORDER BY checked_count DESC`,
    [req.params.id, from, to]
  );
  const choresByPerson = await query(
    `SELECT a.user_id, u.name, COUNT(*) AS assigned_count,
            COALESCE(SUM(CASE WHEN a.status='done' THEN 1 ELSE 0 END),0) AS completed_count,
            MAX(a.completed_at) AS last_completed_at
     FROM house_chore_assignments a
     JOIN house_chores c ON c.id=a.chore_id
     JOIN users u ON u.id=a.user_id
     WHERE c.house_id=? AND (DATE(c.created_at) BETWEEN ? AND ? OR DATE(a.completed_at) BETWEEN ? AND ?)
     GROUP BY a.user_id, u.name
     ORDER BY completed_count DESC, assigned_count DESC`,
    [req.params.id, from, to, from, to]
  );
  const activity = await query(
    `SELECT al.*, u.name AS user_name
     FROM activity_logs al LEFT JOIN users u ON u.id=al.user_id
     WHERE al.house_id=? AND DATE(al.created_at) BETWEEN ? AND ?
     ORDER BY al.created_at DESC LIMIT 80`,
    [req.params.id, from, to]
  );

  res.json({
    house_id: h.id,
    house_name: h.name,
    period: { from, to },
    summary: {
      expenses_count: Number(expenseSummary.total_count || 0),
      expenses_total: round2(expenseSummary.total_amount || 0),
      contributions_count: Number(contributionSummary.total_count || 0),
      contributions_total: round2(contributionSummary.total_amount || 0),
      shopping_items_count: Number(shoppingSummary.total_count || 0),
      shopping_items_checked: Number(shoppingSummary.checked_count || 0),
      chores_count: Number(choreSummary.total_count || 0),
      chores_done: Number(choreSummary.done_count || 0),
      house_balance: round2((contributionSummary.total_amount || 0) - (expenseSummary.total_amount || 0)),
    },
    bills_by_status: billsByStatus.map((b) => ({
      bill_type: b.bill_type,
      status: b.status,
      total_count: Number(b.total_count || 0),
      total_amount: round2(b.total_amount || 0),
    })),
    expenses_by_person: expensesByPerson.map((r) => ({
      user_id: r.user_id,
      name: r.name,
      purchase_count: Number(r.purchase_count || 0),
      total_paid: round2(r.total_paid || 0),
    })),
    expenses_registered_by: expensesRegisteredBy.map((r) => ({
      user_id: r.user_id,
      name: r.name || "Sem registro",
      registered_count: Number(r.registered_count || 0),
      total_amount: round2(r.total_amount || 0),
    })),
    contributions_by_person: contributionsByPerson.map((r) => ({
      user_id: r.user_id,
      name: r.name,
      contribution_count: Number(r.contribution_count || 0),
      total_contributed: round2(r.total_contributed || 0),
    })),
    shopping_added_by: shoppingAddedBy.map((r) => ({
      user_id: r.user_id,
      name: r.name || "Sem registro",
      added_count: Number(r.added_count || 0),
    })),
    shopping_checked_by: shoppingCheckedBy.map((r) => ({
      user_id: r.user_id,
      name: r.name || "Sem registro",
      checked_count: Number(r.checked_count || 0),
    })),
    chores_by_person: choresByPerson.map((r) => ({
      user_id: r.user_id,
      name: r.name,
      assigned_count: Number(r.assigned_count || 0),
      completed_count: Number(r.completed_count || 0),
      last_completed_at: r.last_completed_at,
    })),
    activity: activity.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      user_name: a.user_name || "Sistema",
      action: a.action,
      action_label: REPORT_ACTION_LABELS[a.action] || a.action,
      details: a.details,
      created_at: a.created_at,
    })),
  });
}));

// RECURRING
api.get("/houses/:id/recurring", auth, wrap(async (req, res) => {
  await ensureAnyPermission(req.params.id, req.user.id, ["view_statement", "view_reports", "manage_recurring"]);
  const rows = await query(
    `SELECT r.*, c.name AS category_name, u.name AS payer_name
     FROM recurring_expenses r
     LEFT JOIN categories c ON c.id=r.category_id
     JOIN users u ON u.id=r.payer_id
     WHERE r.house_id=? ORDER BY r.name`,
    [req.params.id]
  );
  res.json(rows.map((r) => ({
    id: r.id, name: r.name, amount: r.amount, category_id: r.category_id,
    category_name: r.category_name, payer_id: r.payer_id, payer_name: r.payer_name,
    frequency: r.frequency, day_of_month: r.day_of_month,
    expense_type: r.expense_type, split_type: r.split_type,
    is_active: !!r.is_active, last_generated_month: r.last_generated_month,
  })));
}));

api.post("/houses/:id/recurring", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_recurring");
  const p = req.body || {};
  await ensureMember(req.params.id, p.payer_id);
  const id = uuidv4();
  await query(
    `INSERT INTO recurring_expenses
     (id,house_id,name,amount,category_id,payer_id,frequency,day_of_month,expense_type,split_type,is_active,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, req.params.id, p.name, round2(p.amount), p.category_id || null,
      p.payer_id, p.frequency || "monthly", Number(p.day_of_month) || 1,
      p.expense_type || "collective", p.split_type || "equal",
      p.is_active === false ? 0 : 1, nowUtc(),
    ]
  );
  const r = await one(
    `SELECT r.*, c.name AS category_name, u.name AS payer_name
     FROM recurring_expenses r
     LEFT JOIN categories c ON c.id=r.category_id
     JOIN users u ON u.id=r.payer_id WHERE r.id=?`,
    [id]
  );
  res.json({
    id: r.id, name: r.name, amount: r.amount, category_id: r.category_id,
    category_name: r.category_name, payer_id: r.payer_id, payer_name: r.payer_name,
    frequency: r.frequency, day_of_month: r.day_of_month,
    expense_type: r.expense_type, split_type: r.split_type,
    is_active: !!r.is_active, last_generated_month: r.last_generated_month,
  });
}));

api.put("/houses/:id/recurring/:rid", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_recurring");
  const p = req.body || {};
  await query(
    `UPDATE recurring_expenses SET
       name=?, amount=?, category_id=?, payer_id=?, frequency=?,
       day_of_month=?, expense_type=?, split_type=?, is_active=?
     WHERE id=? AND house_id=?`,
    [
      p.name, round2(p.amount), p.category_id || null, p.payer_id,
      p.frequency || "monthly", Number(p.day_of_month) || 1,
      p.expense_type || "collective", p.split_type || "equal",
      p.is_active === false ? 0 : 1, req.params.rid, req.params.id,
    ]
  );
  const r = await one(
    `SELECT r.*, c.name AS category_name, u.name AS payer_name
     FROM recurring_expenses r
     LEFT JOIN categories c ON c.id=r.category_id
     JOIN users u ON u.id=r.payer_id WHERE r.id=?`,
    [req.params.rid]
  );
  if (!r) return res.status(404).json({ detail: "Não encontrada" });
  res.json({
    id: r.id, name: r.name, amount: r.amount, category_id: r.category_id,
    category_name: r.category_name, payer_id: r.payer_id, payer_name: r.payer_name,
    frequency: r.frequency, day_of_month: r.day_of_month,
    expense_type: r.expense_type, split_type: r.split_type,
    is_active: !!r.is_active, last_generated_month: r.last_generated_month,
  });
}));

api.delete("/houses/:id/recurring/:rid", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_recurring");
  await query("DELETE FROM recurring_expenses WHERE id=? AND house_id=?",
    [req.params.rid, req.params.id]);
  res.json({ ok: true });
}));

// CONTRIBUTION PLANS
api.get("/houses/:id/contribution-plans", auth, wrap(async (req, res) => {
  await ensureAnyPermission(req.params.id, req.user.id, ["view_statement", "view_reports", "manage_contributions"]);
  const rows = await query(
    `SELECT p.*, u.name AS user_name FROM contribution_plans p
     JOIN users u ON u.id=p.user_id WHERE p.house_id=?`,
    [req.params.id]
  );
  res.json(rows.map((p) => ({
    id: p.id, user_id: p.user_id, user_name: p.user_name, amount: p.amount,
    is_active: !!p.is_active, last_generated_month: p.last_generated_month,
  })));
}));

api.post("/houses/:id/contribution-plans", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_contributions");
  const p = req.body || {};
  await ensureMember(req.params.id, p.user_id);
  const existing = await one(
    "SELECT id FROM contribution_plans WHERE house_id=? AND user_id=?",
    [req.params.id, p.user_id]
  );
  let id;
  if (existing) {
    id = existing.id;
    await query(
      "UPDATE contribution_plans SET amount=?, is_active=? WHERE id=?",
      [round2(p.amount), p.is_active === false ? 0 : 1, id]
    );
  } else {
    id = uuidv4();
    await query(
      `INSERT INTO contribution_plans (id,house_id,user_id,amount,is_active,created_at)
       VALUES (?,?,?,?,?,?)`,
      [id, req.params.id, p.user_id, round2(p.amount), p.is_active === false ? 0 : 1, nowUtc()]
    );
  }
  const pl = await one("SELECT * FROM contribution_plans WHERE id=?", [id]);
  const u = await one("SELECT name FROM users WHERE id=?", [pl.user_id]);
  res.json({
    id: pl.id, user_id: pl.user_id, user_name: u.name, amount: pl.amount,
    is_active: !!pl.is_active, last_generated_month: pl.last_generated_month,
  });
}));

api.delete("/houses/:id/contribution-plans/:pid", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_contributions");
  await query("DELETE FROM contribution_plans WHERE id=? AND house_id=?",
    [req.params.pid, req.params.id]);
  res.json({ ok: true });
}));

// GENERATE CURRENT MONTH (recurring + plans)
api.post("/houses/:id/months/current/generate", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "manage_recurring");
  const h = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  const month = await currentMonth(h.id, h.month_start_day);
  const tag = `${month.year}-${String(month.month_number).padStart(2, "0")}`;

  let created_expenses = 0;
  let created_contributions = 0;
  let skipped_non_monthly = 0;

  const recs = await query(
    "SELECT * FROM recurring_expenses WHERE house_id=? AND is_active=1",
    [req.params.id]
  );
  for (const r of recs) {
    if (r.frequency !== "monthly") { skipped_non_monthly++; continue; }
    if (r.last_generated_month === tag) continue;
    const targetDay = Math.min(Math.max(1, r.day_of_month || 1), 28);
    const dateStr = month.start_date.slice(0, 7) + `-${String(targetDay).padStart(2, "0")}`;
    const id = uuidv4();
    const shares = await computeShares(h.id, {
      payer_id: r.payer_id, expense_type: r.expense_type,
      split_type: r.split_type, participants: [],
    }, r.amount);
    await tx(async (c) => {
      await c.execute(
        `INSERT INTO expenses
         (id,house_id,month_id,payer_id,category_id,description,amount,expense_date,expense_type,split_type,has_items,is_paid,is_recurring_instance,recurring_source_id,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,0,0,1,?,?)`,
        [id, h.id, month.id, r.payer_id, r.category_id, r.name, r.amount,
         dateStr, r.expense_type, r.split_type, r.id, nowUtc()]
      );
      for (const s of shares) {
        await c.execute(
          "INSERT INTO expense_participants (id,expense_id,user_id,share_amount) VALUES (?,?,?,?)",
          [uuidv4(), id, s.user_id, s.share_amount]
        );
      }
      await c.execute(
        "UPDATE recurring_expenses SET last_generated_month=? WHERE id=?",
        [tag, r.id]
      );
    });
    created_expenses++;
  }

  const plans = await query(
    "SELECT * FROM contribution_plans WHERE house_id=? AND is_active=1",
    [req.params.id]
  );
  for (const pl of plans) {
    if (pl.last_generated_month === tag) continue;
    await tx(async (c) => {
      await c.execute(
        `INSERT INTO contributions
         (id,house_id,month_id,user_id,amount,description,contribution_date,is_auto,plan_id,created_at)
         VALUES (?,?,?,?,?,?,?,1,?,?)`,
        [uuidv4(), h.id, month.id, pl.user_id, pl.amount,
         "Contribuição mensal (automática)", month.start_date, pl.id, nowUtc()]
      );
      await c.execute("UPDATE contribution_plans SET last_generated_month=? WHERE id=?",
        [tag, pl.id]);
    });
    created_contributions++;
  }

  res.json({ ok: true, created_expenses, created_contributions, skipped_non_monthly, month_id: month.id });
}));

// DASHBOARD
api.get("/houses/:id/dashboard", auth, wrap(async (req, res) => {
  await ensurePermission(req.params.id, req.user.id, "view_dashboard");
  const h = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  if (!h) return res.status(404).json({ detail: "Casa não encontrada" });

  let mo;
  if (req.query.month_id) {
    mo = await one("SELECT * FROM months WHERE id=? AND house_id=?",
      [req.query.month_id, req.params.id]);
    if (!mo) return res.status(404).json({ detail: "Mês não encontrado" });
  } else {
    mo = await currentMonth(h.id, h.month_start_day);
  }

  const members = await query(
    `SELECT hm.*, u.id AS user_id, u.name, u.avatar_url, u.email
     FROM house_members hm JOIN users u ON u.id=hm.user_id WHERE hm.house_id=?`,
    [req.params.id]
  );
  const names = {};
  members.forEach((m) => { names[m.user_id] = m.name; });

  // Month-scoped
  const exps = await query("SELECT * FROM expenses WHERE house_id=? AND month_id=?",
    [req.params.id, mo.id]);
  const contribs = await query("SELECT * FROM contributions WHERE house_id=? AND month_id=?",
    [req.params.id, mo.id]);
  const total_expenses_month = round2(exps.filter(e => e.expense_type === "collective")
    .reduce((s, e) => s + e.amount, 0));
  const total_fixed_expenses = round2(exps.filter(e => e.expense_type === "collective" && e.is_recurring_instance)
    .reduce((s, e) => s + e.amount, 0));
  const total_variable_expenses = round2(total_expenses_month - total_fixed_expenses);
  const total_contributions_month = round2(contribs.reduce((s, c) => s + c.amount, 0));

  // All-time balances for debts
  const allExps = await query("SELECT * FROM expenses WHERE house_id=?", [req.params.id]);
  const allPartsRaw = await query(
    `SELECT ep.*, e.expense_type FROM expense_participants ep
     JOIN expenses e ON e.id=ep.expense_id WHERE e.house_id=?`,
    [req.params.id]
  );
  const allPays = await query("SELECT * FROM payments WHERE house_id=?", [req.params.id]);

  const paid = {}, share = {};
  for (const e of allExps) {
    if (e.expense_type === "collective") paid[e.payer_id] = (paid[e.payer_id] || 0) + e.amount;
  }
  for (const p of allPartsRaw) {
    if (p.expense_type === "collective") share[p.user_id] = (share[p.user_id] || 0) + p.share_amount;
  }
  const balance = {};
  Object.keys(names).forEach((uid) => {
    balance[uid] = round2((paid[uid] || 0) - (share[uid] || 0));
  });
  for (const p of allPays) {
    balance[p.from_user_id] = round2((balance[p.from_user_id] || 0) + p.amount);
    balance[p.to_user_id] = round2((balance[p.to_user_id] || 0) - p.amount);
  }

  // Month summaries
  const mPaid = {}, mShare = {}, mContr = {};
  for (const e of exps) {
    if (e.expense_type === "collective") mPaid[e.payer_id] = (mPaid[e.payer_id] || 0) + e.amount;
  }
  const monthPartsRaw = await query(
    `SELECT ep.*, e.expense_type FROM expense_participants ep
     JOIN expenses e ON e.id=ep.expense_id WHERE e.house_id=? AND e.month_id=?`,
    [req.params.id, mo.id]
  );
  for (const p of monthPartsRaw) {
    if (p.expense_type === "collective") mShare[p.user_id] = (mShare[p.user_id] || 0) + p.share_amount;
  }
  for (const c of contribs) {
    mContr[c.user_id] = (mContr[c.user_id] || 0) + c.amount;
  }

  const members_summary = members.map((m) => ({
    user_id: m.user_id, name: m.name, avatar_url: m.avatar_url,
    total_paid: round2(mPaid[m.user_id] || 0),
    total_share: round2(mShare[m.user_id] || 0),
    total_contributed: round2(mContr[m.user_id] || 0),
    balance: round2(balance[m.user_id] || 0),
  }));

  const debts = optimizeDebts(balance, names);

  const catMap = {};
  for (const e of exps) {
    if (e.expense_type !== "collective") continue;
    const cat = e.category_id ? await one("SELECT * FROM categories WHERE id=?", [e.category_id]) : null;
    const key = cat ? cat.id : "_none";
    if (!catMap[key]) {
      catMap[key] = {
        category_id: cat ? cat.id : null,
        name: cat ? cat.name : "Sem categoria",
        icon: cat ? cat.icon : "tag",
        color: cat ? cat.color : "#6b7280",
        total: 0,
      };
    }
    catMap[key].total = round2(catMap[key].total + e.amount);
  }
  const expenses_by_category = Object.values(catMap).sort((a, b) => b.total - a.total);

  const recentRows = await query(
    `SELECT * FROM expenses WHERE house_id=? AND month_id=?
     ORDER BY expense_date DESC, created_at DESC LIMIT 10`,
    [req.params.id, mo.id]
  );
  const recent_expenses = [];
  for (const e of recentRows) recent_expenses.push(await serializeExpense(e));

  res.json({
    house_id: h.id, house_name: h.name, currency: h.currency,
    current_month: {
      id: mo.id, year: mo.year, month_number: mo.month_number, status: mo.status,
      start_date: mo.start_date, end_date: mo.end_date,
      carried_balance: mo.carried_balance, closed_at: mo.closed_at,
    },
    total_expenses_month,
    total_fixed_expenses,
    total_variable_expenses,
    total_contributions_month,
    carried_balance: mo.carried_balance || 0,
    house_balance: round2(total_contributions_month + (mo.carried_balance || 0) - total_expenses_month),
    members_summary,
    debts,
    expenses_by_category,
    recent_expenses,
  });
}));

api.use((_req, res) => {
  res.status(404).json({ detail: "Rota não encontrada" });
});

app.use("/api", api);

// ---------- start ----------
(async () => {
  try {
    await runMigrations();
    startupState.migrations = "ok";
  } catch (e) {
    startupState.migrations = "failed";
    startupState.migrations_error_code = e?.code || "UNKNOWN";
    console.error("[startup] migrations failed; API will stay online:", e);
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] JCIP House Finance API listening on port ${PORT}`);
  }).on("error", (e) => {
    console.error("[fatal] listen failed:", e);
    process.exit(1);
  });
})();
