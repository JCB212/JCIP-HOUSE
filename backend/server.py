"""JCIP House Finance — FastAPI backend with MySQL (SQLAlchemy)."""
import logging
import os
import secrets
import string
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from auth import create_token, get_current_user, hash_password, verify_password  # noqa: E402
from database import Base, engine, get_db  # noqa: E402
from debt_calc import optimize_debts  # noqa: E402
from models import (  # noqa: E402
    ActivityLog,
    Category,
    Contribution,
    Expense,
    ExpenseParticipant,
    House,
    HouseMember,
    Payment,
    User,
)
from schemas import (  # noqa: E402
    AuthOut,
    CategoryIn,
    CategoryOut,
    ContributionCreate,
    ContributionOut,
    DashboardOut,
    ExpenseCreate,
    ExpenseOut,
    ExpenseParticipantOut,
    HouseCreate,
    HouseJoin,
    HouseOut,
    LoginIn,
    MemberOut,
    MemberSummary,
    PaymentCreate,
    RegisterIn,
    UserOut,
    WeightUpdate,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="JCIP House Finance API")
api = APIRouter(prefix="/api")

DEFAULT_CATEGORIES = [
    {"name": "Alimentação", "icon": "utensils", "color": "#f97316"},
    {"name": "Supermercado", "icon": "shopping-cart", "color": "#10b981"},
    {"name": "Moradia", "icon": "home", "color": "#3b82f6"},
    {"name": "Contas", "icon": "zap", "color": "#eab308"},
    {"name": "Transporte", "icon": "car", "color": "#8b5cf6"},
    {"name": "Lazer", "icon": "film", "color": "#ec4899"},
    {"name": "Saúde", "icon": "heart", "color": "#ef4444"},
    {"name": "Outros", "icon": "tag", "color": "#6b7280"},
]


def generate_invite_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def ensure_member(db: Session, house_id: str, user_id: str) -> HouseMember:
    m = (
        db.query(HouseMember)
        .filter(HouseMember.house_id == house_id, HouseMember.user_id == user_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=403, detail="Você não pertence a esta casa")
    return m


def serialize_house(db: Session, house: House) -> HouseOut:
    members = (
        db.query(HouseMember, User)
        .join(User, User.id == HouseMember.user_id)
        .filter(HouseMember.house_id == house.id)
        .all()
    )
    return HouseOut(
        id=house.id,
        name=house.name,
        invite_code=house.invite_code,
        currency=house.currency,
        owner_id=house.owner_id,
        gamification_enabled=house.gamification_enabled,
        members=[
            MemberOut(
                id=m.id,
                user_id=u.id,
                name=u.name,
                email=u.email,
                weight=m.weight,
                role=m.role,
                avatar_url=u.avatar_url,
            )
            for m, u in members
        ],
    )


def serialize_expense(db: Session, exp: Expense) -> ExpenseOut:
    payer = db.query(User).filter(User.id == exp.payer_id).first()
    cat = db.query(Category).filter(Category.id == exp.category_id).first() if exp.category_id else None
    parts = (
        db.query(ExpenseParticipant, User)
        .join(User, User.id == ExpenseParticipant.user_id)
        .filter(ExpenseParticipant.expense_id == exp.id)
        .all()
    )
    return ExpenseOut(
        id=exp.id,
        description=exp.description,
        amount=exp.amount,
        payer_id=exp.payer_id,
        payer_name=payer.name if payer else "",
        category_id=exp.category_id,
        category_name=cat.name if cat else None,
        category_icon=cat.icon if cat else None,
        category_color=cat.color if cat else None,
        expense_date=exp.expense_date,
        expense_type=exp.expense_type,
        split_type=exp.split_type,
        notes=exp.notes,
        participants=[
            ExpenseParticipantOut(user_id=u.id, name=u.name, share_amount=p.share_amount)
            for p, u in parts
        ],
        created_at=exp.created_at,
    )


# ========== AUTH ==========
@api.get("/")
async def root():
    return {"message": "JCIP House Finance API", "status": "online"}


@api.post("/auth/register", response_model=AuthOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.email == payload.email.lower()).first()
    if exists:
        raise HTTPException(status_code=400, detail="Este email já está cadastrado")
    user = User(
        email=payload.email.lower(),
        name=payload.name.strip(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id)
    return AuthOut(token=token, user=UserOut.model_validate(user))


@api.post("/auth/login", response_model=AuthOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")
    token = create_token(user.id)
    return AuthOut(token=token, user=UserOut.model_validate(user))


@api.get("/auth/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    return UserOut.model_validate(current)


# ========== HOUSES ==========
@api.post("/houses", response_model=HouseOut)
def create_house(payload: HouseCreate, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Ensure unique invite code
    for _ in range(10):
        code = generate_invite_code()
        if not db.query(House).filter(House.invite_code == code).first():
            break
    house = House(name=payload.name, currency=payload.currency, owner_id=current.id, invite_code=code)
    db.add(house)
    db.flush()

    member = HouseMember(house_id=house.id, user_id=current.id, role="owner", weight=1.0)
    db.add(member)

    for c in DEFAULT_CATEGORIES:
        db.add(Category(house_id=house.id, name=c["name"], icon=c["icon"], color=c["color"]))

    db.add(ActivityLog(house_id=house.id, user_id=current.id, action="house.created", details=payload.name))
    db.commit()
    db.refresh(house)
    return serialize_house(db, house)


@api.post("/houses/join", response_model=HouseOut)
def join_house(payload: HouseJoin, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    code = payload.invite_code.strip().upper()
    house = db.query(House).filter(House.invite_code == code).first()
    if not house:
        raise HTTPException(status_code=404, detail="Código de convite inválido")
    existing = (
        db.query(HouseMember)
        .filter(HouseMember.house_id == house.id, HouseMember.user_id == current.id)
        .first()
    )
    if not existing:
        db.add(HouseMember(house_id=house.id, user_id=current.id, role="member", weight=1.0))
        db.add(ActivityLog(house_id=house.id, user_id=current.id, action="member.joined"))
        db.commit()
    return serialize_house(db, house)


@api.get("/houses", response_model=List[HouseOut])
def list_my_houses(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    houses = (
        db.query(House)
        .join(HouseMember, HouseMember.house_id == House.id)
        .filter(HouseMember.user_id == current.id)
        .all()
    )
    return [serialize_house(db, h) for h in houses]


@api.get("/houses/{house_id}", response_model=HouseOut)
def get_house(house_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="Casa não encontrada")
    return serialize_house(db, house)


@api.put("/houses/{house_id}/members/weight", response_model=HouseOut)
def update_member_weight(
    house_id: str,
    payload: WeightUpdate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_member(db, house_id, current.id)
    m = (
        db.query(HouseMember)
        .filter(HouseMember.house_id == house_id, HouseMember.user_id == payload.user_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    m.weight = max(0.1, payload.weight)
    db.commit()
    house = db.query(House).filter(House.id == house_id).first()
    return serialize_house(db, house)


@api.delete("/houses/{house_id}/members/{user_id}")
def remove_member(
    house_id: str, user_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="Casa não encontrada")
    if house.owner_id != current.id and current.id != user_id:
        raise HTTPException(status_code=403, detail="Somente o dono pode remover outros membros")
    if user_id == house.owner_id:
        raise HTTPException(status_code=400, detail="Não é possível remover o dono")
    m = (
        db.query(HouseMember)
        .filter(HouseMember.house_id == house_id, HouseMember.user_id == user_id)
        .first()
    )
    if m:
        db.delete(m)
        db.commit()
    return {"ok": True}


# ========== CATEGORIES ==========
@api.get("/houses/{house_id}/categories", response_model=List[CategoryOut])
def list_categories(house_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_member(db, house_id, current.id)
    cats = db.query(Category).filter(Category.house_id == house_id).order_by(Category.name).all()
    return [CategoryOut.model_validate(c) for c in cats]


@api.post("/houses/{house_id}/categories", response_model=CategoryOut)
def create_category(
    house_id: str, payload: CategoryIn, current: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    ensure_member(db, house_id, current.id)
    c = Category(house_id=house_id, name=payload.name, icon=payload.icon, color=payload.color)
    db.add(c)
    db.commit()
    db.refresh(c)
    return CategoryOut.model_validate(c)


# ========== EXPENSES ==========
def compute_shares(
    db: Session, house_id: str, payload: ExpenseCreate
) -> List[ExpenseParticipant]:
    amount = round(payload.amount, 2)

    if payload.expense_type == "individual" or payload.split_type == "individual":
        return [ExpenseParticipant(user_id=payload.payer_id, share_amount=amount)]

    participant_ids = [p.user_id for p in payload.participants]
    if not participant_ids:
        members = db.query(HouseMember).filter(HouseMember.house_id == house_id).all()
        participant_ids = [m.user_id for m in members]

    if payload.split_type == "equal":
        share = round(amount / len(participant_ids), 2)
        result = [ExpenseParticipant(user_id=uid, share_amount=share) for uid in participant_ids]
        # fix rounding remainder on first
        diff = round(amount - share * len(participant_ids), 2)
        if result and abs(diff) > 0:
            result[0].share_amount = round(result[0].share_amount + diff, 2)
        return result

    if payload.split_type == "weight":
        members = (
            db.query(HouseMember)
            .filter(HouseMember.house_id == house_id, HouseMember.user_id.in_(participant_ids))
            .all()
        )
        weight_map = {m.user_id: m.weight for m in members}
        total_weight = sum(weight_map.get(uid, 1.0) for uid in participant_ids) or 1.0
        result = []
        accumulated = 0.0
        for i, uid in enumerate(participant_ids):
            w = weight_map.get(uid, 1.0)
            if i == len(participant_ids) - 1:
                share = round(amount - accumulated, 2)
            else:
                share = round(amount * w / total_weight, 2)
                accumulated += share
            result.append(ExpenseParticipant(user_id=uid, share_amount=share))
        return result

    if payload.split_type == "custom":
        total = round(sum((p.share_amount or 0) for p in payload.participants), 2)
        if abs(total - amount) > 0.02:
            raise HTTPException(
                status_code=400,
                detail=f"A soma das partes ({total}) deve ser igual ao valor total ({amount})",
            )
        return [
            ExpenseParticipant(user_id=p.user_id, share_amount=round(p.share_amount or 0, 2))
            for p in payload.participants
        ]

    raise HTTPException(status_code=400, detail="split_type inválido")


@api.post("/houses/{house_id}/expenses", response_model=ExpenseOut)
def create_expense(
    house_id: str,
    payload: ExpenseCreate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_member(db, house_id, current.id)
    ensure_member(db, house_id, payload.payer_id)

    exp = Expense(
        house_id=house_id,
        payer_id=payload.payer_id,
        category_id=payload.category_id,
        description=payload.description,
        amount=round(payload.amount, 2),
        expense_date=payload.expense_date or date.today(),
        expense_type=payload.expense_type,
        split_type=payload.split_type,
        notes=payload.notes,
    )
    db.add(exp)
    db.flush()

    shares = compute_shares(db, house_id, payload)
    for s in shares:
        s.expense_id = exp.id
        db.add(s)

    db.add(ActivityLog(house_id=house_id, user_id=current.id, action="expense.created", details=payload.description))
    db.commit()
    db.refresh(exp)
    return serialize_expense(db, exp)


@api.get("/houses/{house_id}/expenses", response_model=List[ExpenseOut])
def list_expenses(
    house_id: str,
    month: Optional[str] = None,  # YYYY-MM
    limit: int = 200,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_member(db, house_id, current.id)
    q = db.query(Expense).filter(Expense.house_id == house_id)
    if month:
        try:
            y, m = map(int, month.split("-"))
            start = date(y, m, 1)
            end = date(y + (m // 12), (m % 12) + 1, 1)
            q = q.filter(Expense.expense_date >= start, Expense.expense_date < end)
        except Exception:
            pass
    q = q.order_by(Expense.expense_date.desc(), Expense.created_at.desc()).limit(limit)
    return [serialize_expense(db, e) for e in q.all()]


@api.delete("/houses/{house_id}/expenses/{expense_id}")
def delete_expense(
    house_id: str, expense_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    ensure_member(db, house_id, current.id)
    exp = db.query(Expense).filter(Expense.id == expense_id, Expense.house_id == house_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    db.delete(exp)
    db.add(ActivityLog(house_id=house_id, user_id=current.id, action="expense.deleted", details=exp.description))
    db.commit()
    return {"ok": True}


# ========== CONTRIBUTIONS ==========
@api.post("/houses/{house_id}/contributions", response_model=ContributionOut)
def create_contribution(
    house_id: str,
    payload: ContributionCreate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_member(db, house_id, current.id)
    ensure_member(db, house_id, payload.user_id)
    c = Contribution(
        house_id=house_id,
        user_id=payload.user_id,
        amount=round(payload.amount, 2),
        description=payload.description,
        contribution_date=payload.contribution_date or date.today(),
    )
    db.add(c)
    db.add(ActivityLog(house_id=house_id, user_id=current.id, action="contribution.created"))
    db.commit()
    db.refresh(c)
    user = db.query(User).filter(User.id == c.user_id).first()
    return ContributionOut(
        id=c.id,
        user_id=c.user_id,
        user_name=user.name if user else "",
        amount=c.amount,
        description=c.description,
        contribution_date=c.contribution_date,
        created_at=c.created_at,
    )


@api.get("/houses/{house_id}/contributions", response_model=List[ContributionOut])
def list_contributions(
    house_id: str,
    month: Optional[str] = None,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_member(db, house_id, current.id)
    q = db.query(Contribution, User).join(User, User.id == Contribution.user_id).filter(
        Contribution.house_id == house_id
    )
    if month:
        try:
            y, m = map(int, month.split("-"))
            start = date(y, m, 1)
            end = date(y + (m // 12), (m % 12) + 1, 1)
            q = q.filter(Contribution.contribution_date >= start, Contribution.contribution_date < end)
        except Exception:
            pass
    q = q.order_by(Contribution.contribution_date.desc(), Contribution.created_at.desc())
    return [
        ContributionOut(
            id=c.id,
            user_id=c.user_id,
            user_name=u.name,
            amount=c.amount,
            description=c.description,
            contribution_date=c.contribution_date,
            created_at=c.created_at,
        )
        for c, u in q.all()
    ]


@api.delete("/houses/{house_id}/contributions/{contribution_id}")
def delete_contribution(
    house_id: str,
    contribution_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_member(db, house_id, current.id)
    c = (
        db.query(Contribution)
        .filter(Contribution.id == contribution_id, Contribution.house_id == house_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Contribuição não encontrada")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ========== PAYMENTS (settle debts) ==========
@api.post("/houses/{house_id}/payments")
def create_payment(
    house_id: str,
    payload: PaymentCreate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_member(db, house_id, current.id)
    p = Payment(
        house_id=house_id,
        from_user_id=payload.from_user_id,
        to_user_id=payload.to_user_id,
        amount=round(payload.amount, 2),
        note=payload.note,
        payment_date=date.today(),
    )
    db.add(p)
    db.commit()
    return {"ok": True, "id": p.id}


# ========== DASHBOARD ==========
@api.get("/houses/{house_id}/dashboard", response_model=DashboardOut)
def dashboard(
    house_id: str,
    month: Optional[str] = None,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_member(db, house_id, current.id)
    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="Casa não encontrada")

    today = date.today()
    if month:
        try:
            y, m = map(int, month.split("-"))
        except Exception:
            y, m = today.year, today.month
    else:
        y, m = today.year, today.month
    month_start = date(y, m, 1)
    next_month = date(y + (m // 12), (m % 12) + 1, 1)

    # Members
    members = (
        db.query(HouseMember, User).join(User, User.id == HouseMember.user_id).filter(
            HouseMember.house_id == house_id
        ).all()
    )
    names = {u.id: u.name for _, u in members}

    # Expenses of month
    exps = (
        db.query(Expense)
        .filter(
            Expense.house_id == house_id,
            Expense.expense_date >= month_start,
            Expense.expense_date < next_month,
        )
        .all()
    )
    total_expenses_month = round(sum(e.amount for e in exps if e.expense_type == "collective"), 2)

    # Contributions of month
    contribs = (
        db.query(Contribution)
        .filter(
            Contribution.house_id == house_id,
            Contribution.contribution_date >= month_start,
            Contribution.contribution_date < next_month,
        )
        .all()
    )
    total_contributions_month = round(sum(c.amount for c in contribs), 2)

    # ALL-TIME balances per user (for accurate "who owes whom")
    all_exps = db.query(Expense).filter(Expense.house_id == house_id).all()
    all_parts = (
        db.query(ExpenseParticipant)
        .join(Expense, Expense.id == ExpenseParticipant.expense_id)
        .filter(Expense.house_id == house_id)
        .all()
    )
    all_contribs = db.query(Contribution).filter(Contribution.house_id == house_id).all()
    all_payments = db.query(Payment).filter(Payment.house_id == house_id).all()

    paid_by = {}
    share_by = {}
    contrib_by = {}
    for e in all_exps:
        if e.expense_type == "collective":
            paid_by[e.payer_id] = paid_by.get(e.payer_id, 0) + e.amount
    for p in all_parts:
        # We need to know if the expense was collective
        pass
    # re-fetch participants only for collective expenses
    collective_ids = {e.id for e in all_exps if e.expense_type == "collective"}
    for p in all_parts:
        if p.expense_id in collective_ids:
            share_by[p.user_id] = share_by.get(p.user_id, 0) + p.share_amount
    for c in all_contribs:
        contrib_by[c.user_id] = contrib_by.get(c.user_id, 0) + c.amount

    # Payments between users
    balance_by = {}
    for uid in names.keys():
        paid = paid_by.get(uid, 0)
        share = share_by.get(uid, 0)
        contributed = contrib_by.get(uid, 0)
        # balance logic: paid + contributed used to cover expenses; share is what they owe.
        # Simplify: balance = (paid - share) for expense splits. Contributions reduce house pool and
        # are treated as personal credits (they offset share).
        balance_by[uid] = round(paid - share + contributed, 2)

    # Apply settled payments
    for pay in all_payments:
        balance_by[pay.from_user_id] = round(balance_by.get(pay.from_user_id, 0) + pay.amount, 2)
        balance_by[pay.to_user_id] = round(balance_by.get(pay.to_user_id, 0) - pay.amount, 2)

    # Subtract total contributions from creditor side so that house pool doesn't double-count?
    # Simpler model: contributions are treated as extra "payments into house pool" that don't belong to anyone.
    # Revert: don't include contributions in balance_by, treat separately for house_balance.
    balance_by = {}
    for uid in names.keys():
        balance_by[uid] = round(paid_by.get(uid, 0) - share_by.get(uid, 0), 2)
    for pay in all_payments:
        balance_by[pay.from_user_id] = round(balance_by.get(pay.from_user_id, 0) + pay.amount, 2)
        balance_by[pay.to_user_id] = round(balance_by.get(pay.to_user_id, 0) - pay.amount, 2)

    # Members summary (month-scope for paid/share/contributed, all-time balance)
    paid_month, share_month, contrib_month = {}, {}, {}
    for e in exps:
        if e.expense_type == "collective":
            paid_month[e.payer_id] = paid_month.get(e.payer_id, 0) + e.amount
    month_parts = (
        db.query(ExpenseParticipant)
        .join(Expense, Expense.id == ExpenseParticipant.expense_id)
        .filter(
            Expense.house_id == house_id,
            Expense.expense_date >= month_start,
            Expense.expense_date < next_month,
            Expense.expense_type == "collective",
        )
        .all()
    )
    for p in month_parts:
        share_month[p.user_id] = share_month.get(p.user_id, 0) + p.share_amount
    for c in contribs:
        contrib_month[c.user_id] = contrib_month.get(c.user_id, 0) + c.amount

    members_summary = []
    for m_obj, u in members:
        members_summary.append(
            MemberSummary(
                user_id=u.id,
                name=u.name,
                avatar_url=u.avatar_url,
                total_paid=round(paid_month.get(u.id, 0), 2),
                total_share=round(share_month.get(u.id, 0), 2),
                total_contributed=round(contrib_month.get(u.id, 0), 2),
                balance=round(balance_by.get(u.id, 0), 2),
            )
        )

    debts = optimize_debts(balance_by, names)

    # Expenses by category (month)
    cat_totals = {}
    for e in exps:
        if e.expense_type != "collective":
            continue
        cat = db.query(Category).filter(Category.id == e.category_id).first() if e.category_id else None
        key = cat.id if cat else "_none"
        if key not in cat_totals:
            cat_totals[key] = {
                "category_id": cat.id if cat else None,
                "name": cat.name if cat else "Sem categoria",
                "icon": cat.icon if cat else "tag",
                "color": cat.color if cat else "#6b7280",
                "total": 0,
            }
        cat_totals[key]["total"] = round(cat_totals[key]["total"] + e.amount, 2)
    expenses_by_category = sorted(cat_totals.values(), key=lambda x: -x["total"])

    # Recent expenses
    recent = (
        db.query(Expense)
        .filter(Expense.house_id == house_id)
        .order_by(Expense.expense_date.desc(), Expense.created_at.desc())
        .limit(10)
        .all()
    )

    return DashboardOut(
        house_id=house.id,
        house_name=house.name,
        currency=house.currency,
        total_expenses_month=total_expenses_month,
        total_contributions_month=total_contributions_month,
        house_balance=round(total_contributions_month - total_expenses_month, 2),
        members_summary=members_summary,
        debts=debts,
        expenses_by_category=expenses_by_category,
        recent_expenses=[serialize_expense(db, e) for e in recent],
    )


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
