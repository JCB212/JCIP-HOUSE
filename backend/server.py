"""JCIP House Finance — FastAPI backend."""
import logging
import os
import secrets
import string
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from auth import create_token, get_current_user, hash_password, verify_password  # noqa: E402
from database import Base, engine, get_db  # noqa: E402
from debt_calc import optimize_debts  # noqa: E402
from month_utils import ensure_month, get_current_month, month_range_for  # noqa: E402
from models import (  # noqa: E402
    ActivityLog, Category, Contribution, ContributionPlan, Expense, ExpenseItem,
    ExpenseParticipant, House, HouseMember, Month, Payment, RecurringExpense, User,
)
from schemas import (  # noqa: E402
    AuthOut, CategoryIn, CategoryOut, CloseMonthIn, ContribPlanIn, ContribPlanOut,
    ContributionCreate, ContributionOut, DashboardOut, ExpenseCreate, ExpenseItemOut,
    ExpenseOut, ExpenseParticipantOut, HouseCreate, HouseJoin, HouseOut,
    HouseSettingsIn, LoginIn, MemberOut, MemberSummary, MonthOut, PaymentCreate,
    RecurringIn, RecurringOut, RegisterIn, UserOut, WeightUpdate,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="JCIP House Finance API")
api = APIRouter(prefix="/api")

DEFAULT_CATEGORIES = [
    {"name": "Alimentação", "icon": "utensils", "color": "#f97316", "is_market_style": False},
    {"name": "Supermercado", "icon": "shopping-cart", "color": "#10b981", "is_market_style": True},
    {"name": "Moradia", "icon": "home", "color": "#3b82f6", "is_market_style": False},
    {"name": "Contas", "icon": "zap", "color": "#eab308", "is_market_style": False},
    {"name": "Transporte", "icon": "car", "color": "#8b5cf6", "is_market_style": False},
    {"name": "Lazer", "icon": "film", "color": "#ec4899", "is_market_style": False},
    {"name": "Saúde", "icon": "heart", "color": "#ef4444", "is_market_style": False},
    {"name": "Outros", "icon": "tag", "color": "#6b7280", "is_market_style": False},
]


def gen_code(n=8):
    return "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(n))


def ensure_member(db: Session, house_id: str, user_id: str) -> HouseMember:
    m = (
        db.query(HouseMember)
        .filter(HouseMember.house_id == house_id, HouseMember.user_id == user_id)
        .first()
    )
    if not m:
        raise HTTPException(403, "Você não pertence a esta casa")
    return m


def ensure_member_open_month(db: Session, house_id: str, user_id: str, month_id: Optional[str]):
    ensure_member(db, house_id, user_id)
    if month_id:
        mo = db.query(Month).filter(Month.id == month_id).first()
        if mo and mo.status == "closed":
            raise HTTPException(400, "Este mês está fechado")


def serialize_house(db: Session, h: House) -> HouseOut:
    members = (
        db.query(HouseMember, User).join(User, User.id == HouseMember.user_id)
        .filter(HouseMember.house_id == h.id).all()
    )
    return HouseOut(
        id=h.id, name=h.name, invite_code=h.invite_code, currency=h.currency,
        owner_id=h.owner_id, gamification_enabled=h.gamification_enabled,
        month_start_day=h.month_start_day,
        members=[MemberOut(id=m.id, user_id=u.id, name=u.name, email=u.email,
                            weight=m.weight, role=m.role, avatar_url=u.avatar_url)
                 for m, u in members],
    )


def serialize_expense(db: Session, e: Expense) -> ExpenseOut:
    payer = db.query(User).filter(User.id == e.payer_id).first()
    cat = db.query(Category).filter(Category.id == e.category_id).first() if e.category_id else None
    parts = (
        db.query(ExpenseParticipant, User).join(User, User.id == ExpenseParticipant.user_id)
        .filter(ExpenseParticipant.expense_id == e.id).all()
    )
    items = db.query(ExpenseItem).filter(ExpenseItem.expense_id == e.id).all()
    return ExpenseOut(
        id=e.id, month_id=e.month_id, description=e.description, amount=e.amount,
        payer_id=e.payer_id, payer_name=payer.name if payer else "",
        category_id=e.category_id, category_name=cat.name if cat else None,
        category_icon=cat.icon if cat else None, category_color=cat.color if cat else None,
        expense_date=e.expense_date, expense_type=e.expense_type, split_type=e.split_type,
        has_items=e.has_items, is_paid=e.is_paid, is_recurring_instance=e.is_recurring_instance,
        notes=e.notes,
        participants=[ExpenseParticipantOut(user_id=u.id, name=u.name, share_amount=p.share_amount)
                      for p, u in parts],
        items=[ExpenseItemOut.model_validate(it) for it in items],
        created_at=e.created_at,
    )


# ===== AUTH =====
@api.get("/")
def root():
    return {"message": "JCIP House Finance API", "status": "online"}


@api.post("/auth/register", response_model=AuthOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(400, "Este email já está cadastrado")
    u = User(email=payload.email.lower(), name=payload.name.strip(),
             password_hash=hash_password(payload.password))
    db.add(u); db.commit(); db.refresh(u)
    return AuthOut(token=create_token(u.id), user=UserOut.model_validate(u))


@api.post("/auth/login", response_model=AuthOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == payload.email.lower()).first()
    if not u or not verify_password(payload.password, u.password_hash):
        raise HTTPException(401, "Email ou senha inválidos")
    return AuthOut(token=create_token(u.id), user=UserOut.model_validate(u))


@api.get("/auth/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    return UserOut.model_validate(current)


# ===== HOUSES =====
@api.post("/houses", response_model=HouseOut)
def create_house(p: HouseCreate, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for _ in range(10):
        code = gen_code()
        if not db.query(House).filter(House.invite_code == code).first():
            break
    h = House(name=p.name, currency=p.currency, owner_id=current.id, invite_code=code,
              month_start_day=max(1, min(p.month_start_day or 1, 28)))
    db.add(h); db.flush()
    db.add(HouseMember(house_id=h.id, user_id=current.id, role="owner", weight=1.0))
    for c in DEFAULT_CATEGORIES:
        db.add(Category(house_id=h.id, **c))
    db.add(ActivityLog(house_id=h.id, user_id=current.id, action="house.created", details=p.name))
    db.commit(); db.refresh(h)
    return serialize_house(db, h)


@api.post("/houses/join", response_model=HouseOut)
def join_house(p: HouseJoin, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    h = db.query(House).filter(House.invite_code == p.invite_code.strip().upper()).first()
    if not h:
        raise HTTPException(404, "Código de convite inválido")
    if not db.query(HouseMember).filter(HouseMember.house_id == h.id, HouseMember.user_id == current.id).first():
        db.add(HouseMember(house_id=h.id, user_id=current.id, role="member", weight=1.0))
        db.add(ActivityLog(house_id=h.id, user_id=current.id, action="member.joined"))
        db.commit()
    return serialize_house(db, h)


@api.get("/houses", response_model=List[HouseOut])
def list_houses(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    hs = db.query(House).join(HouseMember, HouseMember.house_id == House.id)\
        .filter(HouseMember.user_id == current.id).all()
    return [serialize_house(db, h) for h in hs]


@api.get("/houses/{house_id}", response_model=HouseOut)
def get_house(house_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    h = db.query(House).filter(House.id == house_id).first()
    if not h:
        raise HTTPException(404, "Casa não encontrada")
    return serialize_house(db, h)


@api.put("/houses/{house_id}/settings", response_model=HouseOut)
def update_settings(house_id: str, p: HouseSettingsIn,
                    current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    h = db.query(House).filter(House.id == house_id).first()
    if not h: raise HTTPException(404, "Casa não encontrada")
    if h.owner_id != current.id:
        raise HTTPException(403, "Apenas o dono pode alterar configurações")
    if p.name is not None: h.name = p.name
    if p.month_start_day is not None: h.month_start_day = p.month_start_day
    if p.gamification_enabled is not None: h.gamification_enabled = p.gamification_enabled
    db.commit(); db.refresh(h)
    return serialize_house(db, h)


@api.put("/houses/{house_id}/members/weight", response_model=HouseOut)
def update_weight(house_id: str, p: WeightUpdate,
                  current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    m = db.query(HouseMember).filter(HouseMember.house_id == house_id,
                                      HouseMember.user_id == p.user_id).first()
    if not m: raise HTTPException(404, "Membro não encontrado")
    m.weight = max(0.1, p.weight)
    db.commit()
    return serialize_house(db, db.query(House).filter(House.id == house_id).first())


@api.delete("/houses/{house_id}/members/{user_id}")
def remove_member(house_id: str, user_id: str,
                  current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    h = db.query(House).filter(House.id == house_id).first()
    if not h: raise HTTPException(404, "Casa não encontrada")
    if h.owner_id != current.id and current.id != user_id:
        raise HTTPException(403, "Apenas o dono remove outros membros")
    if user_id == h.owner_id: raise HTTPException(400, "Não é possível remover o dono")
    m = db.query(HouseMember).filter(HouseMember.house_id == house_id, HouseMember.user_id == user_id).first()
    if m: db.delete(m); db.commit()
    return {"ok": True}


# ===== CATEGORIES =====
@api.get("/houses/{house_id}/categories", response_model=List[CategoryOut])
def list_cats(house_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    cats = db.query(Category).filter(Category.house_id == house_id).order_by(Category.name).all()
    return [CategoryOut.model_validate(c) for c in cats]


@api.post("/houses/{house_id}/categories", response_model=CategoryOut)
def create_cat(house_id: str, p: CategoryIn,
               current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    c = Category(house_id=house_id, **p.model_dump())
    db.add(c); db.commit(); db.refresh(c)
    return CategoryOut.model_validate(c)


@api.delete("/houses/{house_id}/categories/{cat_id}")
def del_cat(house_id: str, cat_id: str,
            current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    c = db.query(Category).filter(Category.id == cat_id, Category.house_id == house_id).first()
    if c: db.delete(c); db.commit()
    return {"ok": True}


# ===== MONTHS =====
@api.get("/houses/{house_id}/months", response_model=List[MonthOut])
def list_months(house_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    h = db.query(House).filter(House.id == house_id).first()
    # Ensure current month exists
    get_current_month(db, house_id, h.month_start_day)
    db.commit()
    ms = db.query(Month).filter(Month.house_id == house_id)\
        .order_by(Month.year.desc(), Month.month_number.desc()).all()
    return [MonthOut.model_validate(m) for m in ms]


@api.post("/houses/{house_id}/months/{month_id}/close", response_model=MonthOut)
def close_month(house_id: str, month_id: str, p: CloseMonthIn,
                current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    m = db.query(Month).filter(Month.id == month_id, Month.house_id == house_id).first()
    if not m: raise HTTPException(404, "Mês não encontrado")
    if m.status == "closed": raise HTTPException(400, "Mês já está fechado")
    m.status = "closed"
    m.closed_at = datetime.utcnow()
    # Compute closing balance = contributions - collective expenses
    contribs = db.query(Contribution).filter(Contribution.house_id == house_id,
                                              Contribution.month_id == m.id).all()
    exps = db.query(Expense).filter(Expense.house_id == house_id, Expense.month_id == m.id,
                                     Expense.expense_type == "collective").all()
    balance = round(sum(c.amount for c in contribs) - sum(e.amount for e in exps), 2)
    m.carried_balance = balance if p.carry_balance else 0.0
    db.add(ActivityLog(house_id=house_id, user_id=current.id, action="month.closed",
                       details=f"{m.year}-{m.month_number:02d}"))
    db.commit(); db.refresh(m)
    return MonthOut.model_validate(m)


@api.post("/houses/{house_id}/months/{month_id}/reopen", response_model=MonthOut)
def reopen_month(house_id: str, month_id: str,
                 current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    m = db.query(Month).filter(Month.id == month_id, Month.house_id == house_id).first()
    if not m: raise HTTPException(404, "Mês não encontrado")
    m.status = "open"; m.closed_at = None
    db.commit(); db.refresh(m)
    return MonthOut.model_validate(m)


# ===== EXPENSES =====
def compute_shares(db: Session, house_id: str, p: ExpenseCreate, amount: float) -> List[ExpenseParticipant]:
    if p.expense_type == "individual" or p.split_type == "individual":
        return [ExpenseParticipant(user_id=p.payer_id, share_amount=round(amount, 2))]

    pids = [x.user_id for x in p.participants]
    if not pids:
        pids = [m.user_id for m in db.query(HouseMember).filter(HouseMember.house_id == house_id).all()]

    if p.split_type == "equal":
        share = round(amount / len(pids), 2)
        res = [ExpenseParticipant(user_id=uid, share_amount=share) for uid in pids]
        diff = round(amount - share * len(pids), 2)
        if res and abs(diff) > 0:
            res[0].share_amount = round(res[0].share_amount + diff, 2)
        return res

    if p.split_type == "weight":
        ms = db.query(HouseMember).filter(HouseMember.house_id == house_id,
                                           HouseMember.user_id.in_(pids)).all()
        wmap = {m.user_id: m.weight for m in ms}
        tw = sum(wmap.get(uid, 1.0) for uid in pids) or 1.0
        res = []; acc = 0.0
        for i, uid in enumerate(pids):
            w = wmap.get(uid, 1.0)
            share = round(amount - acc, 2) if i == len(pids) - 1 else round(amount * w / tw, 2)
            if i != len(pids) - 1: acc += share
            res.append(ExpenseParticipant(user_id=uid, share_amount=share))
        return res

    if p.split_type == "custom":
        total = round(sum((x.share_amount or 0) for x in p.participants), 2)
        if abs(total - amount) > 0.02:
            raise HTTPException(400, f"Soma das partes ({total}) ≠ total ({amount})")
        return [ExpenseParticipant(user_id=x.user_id, share_amount=round(x.share_amount or 0, 2))
                for x in p.participants]

    raise HTTPException(400, "split_type inválido")


@api.post("/houses/{house_id}/expenses", response_model=ExpenseOut)
def create_expense(house_id: str, p: ExpenseCreate,
                   current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    ensure_member(db, house_id, p.payer_id)

    h = db.query(House).filter(House.id == house_id).first()
    exp_date = p.expense_date or date.today()
    month = ensure_month(db, house_id, exp_date, h.month_start_day)
    if month.status == "closed":
        raise HTTPException(400, "Este mês está fechado")

    # amount: if items provided and amount not set, compute from items
    if p.items:
        amount = round(sum(it.quantity * it.unit_price for it in p.items), 2)
    else:
        if p.amount is None or p.amount <= 0:
            raise HTTPException(400, "Informe o valor")
        amount = round(p.amount, 2)

    e = Expense(
        house_id=house_id, month_id=month.id, payer_id=p.payer_id, category_id=p.category_id,
        description=p.description, amount=amount, expense_date=exp_date,
        expense_type=p.expense_type, split_type=p.split_type,
        has_items=bool(p.items), is_paid=p.is_paid, notes=p.notes,
    )
    db.add(e); db.flush()
    for s in compute_shares(db, house_id, p, amount):
        s.expense_id = e.id
        db.add(s)
    for it in p.items:
        total = round(it.quantity * it.unit_price, 2)
        db.add(ExpenseItem(expense_id=e.id, name=it.name, quantity=it.quantity,
                           unit_price=it.unit_price, total=total))
    db.add(ActivityLog(house_id=house_id, user_id=current.id, action="expense.created",
                       details=p.description))
    db.commit(); db.refresh(e)
    return serialize_expense(db, e)


@api.get("/houses/{house_id}/expenses", response_model=List[ExpenseOut])
def list_expenses(house_id: str, month_id: Optional[str] = None, limit: int = 500,
                  current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    q = db.query(Expense).filter(Expense.house_id == house_id)
    if month_id:
        q = q.filter(Expense.month_id == month_id)
    q = q.order_by(Expense.expense_date.desc(), Expense.created_at.desc()).limit(limit)
    return [serialize_expense(db, e) for e in q.all()]


@api.delete("/houses/{house_id}/expenses/{expense_id}")
def del_expense(house_id: str, expense_id: str,
                current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    e = db.query(Expense).filter(Expense.id == expense_id, Expense.house_id == house_id).first()
    if not e: raise HTTPException(404, "Despesa não encontrada")
    if e.month_id:
        mo = db.query(Month).filter(Month.id == e.month_id).first()
        if mo and mo.status == "closed":
            raise HTTPException(400, "Mês fechado, não pode excluir")
    db.delete(e)
    db.add(ActivityLog(house_id=house_id, user_id=current.id, action="expense.deleted", details=e.description))
    db.commit()
    return {"ok": True}


@api.patch("/houses/{house_id}/expenses/{expense_id}/paid")
def toggle_paid(house_id: str, expense_id: str, is_paid: bool,
                current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    e = db.query(Expense).filter(Expense.id == expense_id, Expense.house_id == house_id).first()
    if not e: raise HTTPException(404, "Despesa não encontrada")
    e.is_paid = is_paid
    db.commit()
    return {"ok": True, "is_paid": e.is_paid}


# ===== CONTRIBUTIONS =====
@api.post("/houses/{house_id}/contributions", response_model=ContributionOut)
def create_contrib(house_id: str, p: ContributionCreate,
                   current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    ensure_member(db, house_id, p.user_id)
    h = db.query(House).filter(House.id == house_id).first()
    cdate = p.contribution_date or date.today()
    month = ensure_month(db, house_id, cdate, h.month_start_day)
    if month.status == "closed":
        raise HTTPException(400, "Este mês está fechado")
    c = Contribution(house_id=house_id, month_id=month.id, user_id=p.user_id,
                     amount=round(p.amount, 2), description=p.description,
                     contribution_date=cdate, is_auto=False)
    db.add(c); db.commit(); db.refresh(c)
    u = db.query(User).filter(User.id == c.user_id).first()
    return ContributionOut(id=c.id, user_id=c.user_id, user_name=u.name, amount=c.amount,
                            description=c.description, contribution_date=c.contribution_date,
                            is_auto=c.is_auto, month_id=c.month_id, created_at=c.created_at)


@api.get("/houses/{house_id}/contributions", response_model=List[ContributionOut])
def list_contribs(house_id: str, month_id: Optional[str] = None,
                  current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    q = db.query(Contribution, User).join(User, User.id == Contribution.user_id)\
         .filter(Contribution.house_id == house_id)
    if month_id: q = q.filter(Contribution.month_id == month_id)
    q = q.order_by(Contribution.contribution_date.desc(), Contribution.created_at.desc())
    return [ContributionOut(id=c.id, user_id=c.user_id, user_name=u.name, amount=c.amount,
                             description=c.description, contribution_date=c.contribution_date,
                             is_auto=c.is_auto, month_id=c.month_id, created_at=c.created_at)
            for c, u in q.all()]


@api.delete("/houses/{house_id}/contributions/{contribution_id}")
def del_contrib(house_id: str, contribution_id: str,
                current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    c = db.query(Contribution).filter(Contribution.id == contribution_id,
                                        Contribution.house_id == house_id).first()
    if not c: raise HTTPException(404, "Não encontrada")
    db.delete(c); db.commit()
    return {"ok": True}


# ===== PAYMENTS =====
@api.post("/houses/{house_id}/payments")
def create_payment(house_id: str, p: PaymentCreate,
                   current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    pay = Payment(house_id=house_id, from_user_id=p.from_user_id, to_user_id=p.to_user_id,
                  amount=round(p.amount, 2), note=p.note, payment_date=date.today())
    db.add(pay); db.commit()
    return {"ok": True, "id": pay.id}


# ===== RECURRING =====
@api.get("/houses/{house_id}/recurring", response_model=List[RecurringOut])
def list_recurring(house_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    rs = db.query(RecurringExpense).filter(RecurringExpense.house_id == house_id).order_by(RecurringExpense.name).all()
    out = []
    for r in rs:
        cat = db.query(Category).filter(Category.id == r.category_id).first() if r.category_id else None
        payer = db.query(User).filter(User.id == r.payer_id).first()
        out.append(RecurringOut(
            id=r.id, name=r.name, amount=r.amount, category_id=r.category_id,
            category_name=cat.name if cat else None, payer_id=r.payer_id,
            payer_name=payer.name if payer else "", frequency=r.frequency,
            day_of_month=r.day_of_month, expense_type=r.expense_type, split_type=r.split_type,
            is_active=r.is_active, last_generated_month=r.last_generated_month,
        ))
    return out


@api.post("/houses/{house_id}/recurring", response_model=RecurringOut)
def create_recurring(house_id: str, p: RecurringIn,
                     current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    ensure_member(db, house_id, p.payer_id)
    r = RecurringExpense(house_id=house_id, **p.model_dump())
    db.add(r); db.commit(); db.refresh(r)
    return list_recurring.__wrapped__(house_id, current, db)[-1] if False else RecurringOut(
        id=r.id, name=r.name, amount=r.amount, category_id=r.category_id,
        category_name=(db.query(Category).filter(Category.id == r.category_id).first().name
                        if r.category_id else None),
        payer_id=r.payer_id,
        payer_name=db.query(User).filter(User.id == r.payer_id).first().name,
        frequency=r.frequency, day_of_month=r.day_of_month,
        expense_type=r.expense_type, split_type=r.split_type,
        is_active=r.is_active, last_generated_month=r.last_generated_month,
    )


@api.put("/houses/{house_id}/recurring/{rid}", response_model=RecurringOut)
def update_recurring(house_id: str, rid: str, p: RecurringIn,
                     current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    r = db.query(RecurringExpense).filter(RecurringExpense.id == rid,
                                            RecurringExpense.house_id == house_id).first()
    if not r: raise HTTPException(404, "Não encontrada")
    for k, v in p.model_dump().items(): setattr(r, k, v)
    db.commit(); db.refresh(r)
    payer = db.query(User).filter(User.id == r.payer_id).first()
    cat = db.query(Category).filter(Category.id == r.category_id).first() if r.category_id else None
    return RecurringOut(id=r.id, name=r.name, amount=r.amount, category_id=r.category_id,
                        category_name=cat.name if cat else None, payer_id=r.payer_id,
                        payer_name=payer.name if payer else "", frequency=r.frequency,
                        day_of_month=r.day_of_month, expense_type=r.expense_type,
                        split_type=r.split_type, is_active=r.is_active,
                        last_generated_month=r.last_generated_month)


@api.delete("/houses/{house_id}/recurring/{rid}")
def del_recurring(house_id: str, rid: str,
                  current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    r = db.query(RecurringExpense).filter(RecurringExpense.id == rid,
                                            RecurringExpense.house_id == house_id).first()
    if r: db.delete(r); db.commit()
    return {"ok": True}


# ===== CONTRIBUTION PLANS =====
@api.get("/houses/{house_id}/contribution-plans", response_model=List[ContribPlanOut])
def list_plans(house_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    plans = db.query(ContributionPlan, User).join(User, User.id == ContributionPlan.user_id)\
        .filter(ContributionPlan.house_id == house_id).all()
    return [ContribPlanOut(id=p.id, user_id=p.user_id, user_name=u.name, amount=p.amount,
                            is_active=p.is_active, last_generated_month=p.last_generated_month)
            for p, u in plans]


@api.post("/houses/{house_id}/contribution-plans", response_model=ContribPlanOut)
def upsert_plan(house_id: str, p: ContribPlanIn,
                current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    ensure_member(db, house_id, p.user_id)
    existing = db.query(ContributionPlan).filter(ContributionPlan.house_id == house_id,
                                                   ContributionPlan.user_id == p.user_id).first()
    if existing:
        existing.amount = p.amount; existing.is_active = p.is_active
        plan = existing
    else:
        plan = ContributionPlan(house_id=house_id, **p.model_dump())
        db.add(plan)
    db.commit(); db.refresh(plan)
    u = db.query(User).filter(User.id == plan.user_id).first()
    return ContribPlanOut(id=plan.id, user_id=plan.user_id, user_name=u.name, amount=plan.amount,
                           is_active=plan.is_active, last_generated_month=plan.last_generated_month)


@api.delete("/houses/{house_id}/contribution-plans/{pid}")
def del_plan(house_id: str, pid: str,
             current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    plan = db.query(ContributionPlan).filter(ContributionPlan.id == pid,
                                               ContributionPlan.house_id == house_id).first()
    if plan: db.delete(plan); db.commit()
    return {"ok": True}


@api.post("/houses/{house_id}/months/current/generate")
def generate_current_month(house_id: str,
                            current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Gera despesas recorrentes e contribuições planejadas para o mês atual."""
    ensure_member(db, house_id, current.id)
    h = db.query(House).filter(House.id == house_id).first()
    month = get_current_month(db, house_id, h.month_start_day)
    tag = f"{month.year}-{month.month_number:02d}"

    created_expenses = 0
    created_contribs = 0

    # Recurring expenses
    recs = db.query(RecurringExpense).filter(
        RecurringExpense.house_id == house_id,
        RecurringExpense.is_active.is_(True),
    ).all()
    for r in recs:
        if r.frequency != "monthly":
            continue  # weekly/yearly: keep simple for v1
        if r.last_generated_month == tag:
            continue
        target_day = max(1, min(r.day_of_month or month.start_date.day, 28))
        target_date = date(month.start_date.year, month.start_date.month, target_day)
        # clamp to month range
        if target_date < month.start_date: target_date = month.start_date
        if target_date >= month.end_date: target_date = month.end_date
        # Build expense
        pids = [m.user_id for m in db.query(HouseMember).filter(HouseMember.house_id == house_id).all()]
        parts = [ExpenseParticipant(user_id=uid) for uid in pids]  # placeholder
        amount = round(r.amount, 2)
        e = Expense(
            house_id=house_id, month_id=month.id, payer_id=r.payer_id,
            category_id=r.category_id, description=r.name, amount=amount,
            expense_date=target_date, expense_type=r.expense_type,
            split_type=r.split_type, has_items=False, is_paid=False,
            is_recurring_instance=True, recurring_source_id=r.id,
        )
        db.add(e); db.flush()
        # compute shares using equal/weight/individual
        fake = ExpenseCreate(
            description=r.name, amount=amount, payer_id=r.payer_id,
            category_id=r.category_id, expense_date=target_date,
            expense_type=r.expense_type, split_type=r.split_type,
            participants=[], items=[],
        )
        for s in compute_shares(db, house_id, fake, amount):
            s.expense_id = e.id
            db.add(s)
        r.last_generated_month = tag
        created_expenses += 1

    # Contribution plans
    plans = db.query(ContributionPlan).filter(
        ContributionPlan.house_id == house_id,
        ContributionPlan.is_active.is_(True),
    ).all()
    for pl in plans:
        if pl.last_generated_month == tag: continue
        c = Contribution(house_id=house_id, month_id=month.id, user_id=pl.user_id,
                         amount=round(pl.amount, 2), description="Contribuição mensal (automática)",
                         contribution_date=month.start_date, is_auto=True, plan_id=pl.id)
        db.add(c)
        pl.last_generated_month = tag
        created_contribs += 1

    db.commit()
    return {"ok": True, "created_expenses": created_expenses,
            "created_contributions": created_contribs, "month_id": month.id}


# ===== DASHBOARD =====
@api.get("/houses/{house_id}/dashboard", response_model=DashboardOut)
def dashboard(house_id: str, month_id: Optional[str] = None,
              current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    h = db.query(House).filter(House.id == house_id).first()
    if not h: raise HTTPException(404, "Casa não encontrada")

    if month_id:
        mo = db.query(Month).filter(Month.id == month_id, Month.house_id == house_id).first()
        if not mo: raise HTTPException(404, "Mês não encontrado")
    else:
        mo = get_current_month(db, house_id, h.month_start_day)
        db.commit(); db.refresh(mo)

    members = db.query(HouseMember, User).join(User, User.id == HouseMember.user_id)\
        .filter(HouseMember.house_id == house_id).all()
    names = {u.id: u.name for _, u in members}

    # Month-scoped expenses & contribs
    exps = db.query(Expense).filter(Expense.house_id == house_id, Expense.month_id == mo.id).all()
    contribs = db.query(Contribution).filter(Contribution.house_id == house_id,
                                               Contribution.month_id == mo.id).all()
    total_exp_month = round(sum(e.amount for e in exps if e.expense_type == "collective"), 2)
    total_fixed = round(sum(e.amount for e in exps if e.expense_type == "collective" and e.is_recurring_instance), 2)
    total_variable = round(total_exp_month - total_fixed, 2)
    total_contr_month = round(sum(c.amount for c in contribs), 2)

    # All-time balances for debts (across all months)
    all_exps = db.query(Expense).filter(Expense.house_id == house_id).all()
    all_parts = db.query(ExpenseParticipant)\
        .join(Expense, Expense.id == ExpenseParticipant.expense_id)\
        .filter(Expense.house_id == house_id).all()
    all_pays = db.query(Payment).filter(Payment.house_id == house_id).all()

    coll_ids = {e.id for e in all_exps if e.expense_type == "collective"}
    paid_by, share_by = {}, {}
    for e in all_exps:
        if e.expense_type == "collective":
            paid_by[e.payer_id] = paid_by.get(e.payer_id, 0) + e.amount
    for p in all_parts:
        if p.expense_id in coll_ids:
            share_by[p.user_id] = share_by.get(p.user_id, 0) + p.share_amount

    balance = {uid: round(paid_by.get(uid, 0) - share_by.get(uid, 0), 2) for uid in names.keys()}
    for pay in all_pays:
        balance[pay.from_user_id] = round(balance.get(pay.from_user_id, 0) + pay.amount, 2)
        balance[pay.to_user_id] = round(balance.get(pay.to_user_id, 0) - pay.amount, 2)

    # Member summary (month-scope paid/share/contributed, all-time balance)
    month_paid, month_share, month_contr = {}, {}, {}
    for e in exps:
        if e.expense_type == "collective":
            month_paid[e.payer_id] = month_paid.get(e.payer_id, 0) + e.amount
    month_parts = db.query(ExpenseParticipant)\
        .join(Expense, Expense.id == ExpenseParticipant.expense_id)\
        .filter(Expense.house_id == house_id, Expense.month_id == mo.id,
                Expense.expense_type == "collective").all()
    for p in month_parts:
        month_share[p.user_id] = month_share.get(p.user_id, 0) + p.share_amount
    for c in contribs:
        month_contr[c.user_id] = month_contr.get(c.user_id, 0) + c.amount

    summary = [MemberSummary(
        user_id=u.id, name=u.name, avatar_url=u.avatar_url,
        total_paid=round(month_paid.get(u.id, 0), 2),
        total_share=round(month_share.get(u.id, 0), 2),
        total_contributed=round(month_contr.get(u.id, 0), 2),
        balance=round(balance.get(u.id, 0), 2),
    ) for _, u in members]

    debts = optimize_debts(balance, names)

    cats = {}
    for e in exps:
        if e.expense_type != "collective": continue
        cat = db.query(Category).filter(Category.id == e.category_id).first() if e.category_id else None
        key = cat.id if cat else "_none"
        if key not in cats:
            cats[key] = {"category_id": cat.id if cat else None,
                         "name": cat.name if cat else "Sem categoria",
                         "icon": cat.icon if cat else "tag",
                         "color": cat.color if cat else "#6b7280",
                         "total": 0}
        cats[key]["total"] = round(cats[key]["total"] + e.amount, 2)

    recent = db.query(Expense).filter(Expense.house_id == house_id, Expense.month_id == mo.id)\
        .order_by(Expense.expense_date.desc(), Expense.created_at.desc()).limit(10).all()

    return DashboardOut(
        house_id=h.id, house_name=h.name, currency=h.currency,
        current_month=MonthOut.model_validate(mo),
        total_expenses_month=total_exp_month,
        total_fixed_expenses=total_fixed, total_variable_expenses=total_variable,
        total_contributions_month=total_contr_month,
        house_balance=round(total_contr_month + (mo.carried_balance or 0) - total_exp_month, 2),
        carried_balance=mo.carried_balance or 0.0,
        members_summary=summary, debts=debts,
        expenses_by_category=sorted(cats.values(), key=lambda x: -x["total"]),
        recent_expenses=[serialize_expense(db, e) for e in recent],
    )


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"],
                    allow_methods=["*"], allow_headers=["*"])
