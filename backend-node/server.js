// JCIP House Finance — Node.js Backend (Express + MySQL)
// Compatible with Hostinger Node.js apps
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { query, one, tx, pool } = require("./db");
const { runMigrations } = require("./migrations");
const {
  uuidv4, nowUtc, today, genCode, round2,
  findLogicalMonth, monthRangeFor, optimizeDebts,
} = require("./utils");

const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const JWT_EXPIRE_DAYS = Number(process.env.JWT_EXPIRE_DAYS || 30);
const PORT = Number(process.env.PORT || 8001);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const api = express.Router();

// ---------- helpers ----------
function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: `${JWT_EXPIRE_DAYS}d` });
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

function sanitizeUser(u) {
  return { id: u.id, email: u.email, name: u.name, avatar_url: u.avatar_url || null };
}

function wrap(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((e) => {
      console.error(e);
      res.status(e.status || 500).json({ detail: e.message || "Erro interno" });
    });
  };
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
    members: members.map((m) => ({
      id: m.id, user_id: m.user_id, name: m.user_name, email: m.email,
      weight: m.weight, role: m.role, avatar_url: m.avatar_url,
    })),
  };
}

async function serializeExpense(e) {
  const payer = await one("SELECT name FROM users WHERE id=?", [e.payer_id]);
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

// AUTH
api.post("/auth/register", wrap(async (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || !name || !password || password.length < 6) {
    return res.status(400).json({ detail: "Dados inválidos (senha mín. 6 chars)" });
  }
  const em = String(email).toLowerCase().trim();
  const exists = await one("SELECT id FROM users WHERE email=?", [em]);
  if (exists) return res.status(400).json({ detail: "Este email já está cadastrado" });
  const hash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  const n = nowUtc();
  await query(
    `INSERT INTO users (id,email,name,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
    [id, em, String(name).trim(), hash, n, n]
  );
  const u = await one("SELECT * FROM users WHERE id=?", [id]);
  res.json({ token: signToken(id), user: sanitizeUser(u) });
}));

api.post("/auth/login", wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const u = await one("SELECT * FROM users WHERE email=?", [String(email || "").toLowerCase().trim()]);
  if (!u || !(await bcrypt.compare(password || "", u.password_hash))) {
    return res.status(401).json({ detail: "Email ou senha inválidos" });
  }
  res.json({ token: signToken(u.id), user: sanitizeUser(u) });
}));

api.get("/auth/me", auth, wrap(async (req, res) => res.json(sanitizeUser(req.user))));

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
  await ensureMember(req.params.id, req.user.id);
  const h = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  if (!h) return res.status(404).json({ detail: "Casa não encontrada" });
  if (h.owner_id !== req.user.id) return res.status(403).json({ detail: "Apenas o dono pode alterar" });
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
  await ensureMember(req.params.id, req.user.id);
  const ownerRow = await one("SELECT owner_id FROM houses WHERE id=?", [req.params.id]);
  if (!ownerRow || ownerRow.owner_id !== req.user.id) {
    return res.status(403).json({ detail: "Apenas o dono pode alterar pesos" });
  }
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
  if (h.owner_id !== req.user.id && req.user.id !== req.params.userId) {
    return res.status(403).json({ detail: "Apenas o dono remove outros" });
  }
  if (req.params.userId === h.owner_id) {
    return res.status(400).json({ detail: "Não pode remover o dono" });
  }
  await query("DELETE FROM house_members WHERE house_id=? AND user_id=?",
    [req.params.id, req.params.userId]);
  res.json({ ok: true });
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
  await ensureMember(req.params.id, req.user.id);
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
  await ensureMember(req.params.id, req.user.id);
  await query("DELETE FROM categories WHERE id=? AND house_id=?", [req.params.cat, req.params.id]);
  res.json({ ok: true });
}));

// MONTHS
api.get("/houses/:id/months", auth, wrap(async (req, res) => {
  await ensureMember(req.params.id, req.user.id);
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
  await ensureMember(req.params.id, req.user.id);
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
  await ensureMember(req.params.id, req.user.id);
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
  await ensureMember(req.params.id, req.user.id);
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
       (id,house_id,month_id,payer_id,category_id,description,amount,expense_date,expense_type,split_type,has_items,is_paid,is_recurring_instance,notes,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`,
      [
        id, h.id, month.id, p.payer_id, p.category_id || null,
        p.description, amount, expDate, p.expense_type || "collective",
        p.split_type || "equal", items.length > 0 ? 1 : 0,
        p.is_paid === false ? 0 : 1, p.notes || null, nowUtc(),
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
  await ensureMember(req.params.id, req.user.id);
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
  await ensureMember(req.params.id, req.user.id);
  const e = await one("SELECT * FROM expenses WHERE id=? AND house_id=?",
    [req.params.eid, req.params.id]);
  if (!e) return res.status(404).json({ detail: "Não encontrada" });
  if (e.month_id) {
    const m = await one("SELECT status FROM months WHERE id=?", [e.month_id]);
    if (m && m.status === "closed") return res.status(400).json({ detail: "Mês fechado" });
  }
  await query("DELETE FROM expenses WHERE id=?", [req.params.eid]);
  res.json({ ok: true });
}));

// CONTRIBUTIONS
api.post("/houses/:id/contributions", auth, wrap(async (req, res) => {
  await ensureMember(req.params.id, req.user.id);
  const p = req.body || {};
  await ensureMember(req.params.id, p.user_id);
  const h = await one("SELECT * FROM houses WHERE id=?", [req.params.id]);
  const cdate = p.contribution_date || today();
  const m = await ensureMonth(h.id, cdate, h.month_start_day);
  if (m.status === "closed") return res.status(400).json({ detail: "Mês fechado" });
  const id = uuidv4();
  await query(
    `INSERT INTO contributions (id,house_id,month_id,user_id,amount,description,contribution_date,is_auto,created_at)
     VALUES (?,?,?,?,?,?,?,0,?)`,
    [id, h.id, m.id, p.user_id, round2(p.amount), p.description || null, cdate, nowUtc()]
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
  await ensureMember(req.params.id, req.user.id);
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
  await ensureMember(req.params.id, req.user.id);
  await query("DELETE FROM contributions WHERE id=? AND house_id=?",
    [req.params.cid, req.params.id]);
  res.json({ ok: true });
}));

// PAYMENTS
api.post("/houses/:id/payments", auth, wrap(async (req, res) => {
  await ensureMember(req.params.id, req.user.id);
  const p = req.body || {};
  await ensureMember(req.params.id, p.from_user_id);
  await ensureMember(req.params.id, p.to_user_id);
  const id = uuidv4();
  await query(
    `INSERT INTO payments (id,house_id,from_user_id,to_user_id,amount,note,payment_date,created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, req.params.id, p.from_user_id, p.to_user_id, round2(p.amount), p.note || null, today(), nowUtc()]
  );
  res.json({ ok: true, id });
}));

// RECURRING
api.get("/houses/:id/recurring", auth, wrap(async (req, res) => {
  await ensureMember(req.params.id, req.user.id);
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
  await ensureMember(req.params.id, req.user.id);
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
  await ensureMember(req.params.id, req.user.id);
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
  await ensureMember(req.params.id, req.user.id);
  await query("DELETE FROM recurring_expenses WHERE id=? AND house_id=?",
    [req.params.rid, req.params.id]);
  res.json({ ok: true });
}));

// CONTRIBUTION PLANS
api.get("/houses/:id/contribution-plans", auth, wrap(async (req, res) => {
  await ensureMember(req.params.id, req.user.id);
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
  await ensureMember(req.params.id, req.user.id);
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
  await ensureMember(req.params.id, req.user.id);
  await query("DELETE FROM contribution_plans WHERE id=? AND house_id=?",
    [req.params.pid, req.params.id]);
  res.json({ ok: true });
}));

// GENERATE CURRENT MONTH (recurring + plans)
api.post("/houses/:id/months/current/generate", auth, wrap(async (req, res) => {
  await ensureMember(req.params.id, req.user.id);
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
  await ensureMember(req.params.id, req.user.id);
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

app.use("/api", api);

// ---------- start ----------
(async () => {
  try {
    await runMigrations();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[server] JCIP House Finance API listening on port ${PORT}`);
    });
  } catch (e) {
    console.error("[fatal] startup failed:", e);
    process.exit(1);
  }
})();
