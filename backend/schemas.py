"""Pydantic schemas."""
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class RegisterIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=6, max_length=100)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class AuthOut(BaseModel):
    token: str
    user: UserOut


# ---------- Houses ----------
class HouseCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    currency: str = "BRL"


class HouseJoin(BaseModel):
    invite_code: str


class MemberOut(BaseModel):
    id: str
    user_id: str
    name: str
    email: EmailStr
    weight: float
    role: str
    avatar_url: Optional[str] = None


class HouseOut(BaseModel):
    id: str
    name: str
    invite_code: str
    currency: str
    owner_id: str
    gamification_enabled: bool
    members: List[MemberOut] = []


class WeightUpdate(BaseModel):
    user_id: str
    weight: float


# ---------- Categories ----------
class CategoryIn(BaseModel):
    name: str
    icon: str = "tag"
    color: str = "#3b82f6"


class CategoryOut(CategoryIn):
    id: str

    class Config:
        from_attributes = True


# ---------- Expenses ----------
class ParticipantIn(BaseModel):
    user_id: str
    share_amount: Optional[float] = None  # used when split_type=custom


class ExpenseCreate(BaseModel):
    description: str
    amount: float = Field(gt=0)
    payer_id: str
    category_id: Optional[str] = None
    expense_date: Optional[date] = None
    expense_type: str = "collective"  # collective | individual
    split_type: str = "equal"  # equal | custom | weight | individual
    participants: List[ParticipantIn] = []
    notes: Optional[str] = None


class ExpenseParticipantOut(BaseModel):
    user_id: str
    name: str
    share_amount: float


class ExpenseOut(BaseModel):
    id: str
    description: str
    amount: float
    payer_id: str
    payer_name: str
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    expense_date: date
    expense_type: str
    split_type: str
    notes: Optional[str] = None
    participants: List[ExpenseParticipantOut]
    created_at: datetime


# ---------- Contributions ----------
class ContributionCreate(BaseModel):
    user_id: str
    amount: float = Field(gt=0)
    description: Optional[str] = None
    contribution_date: Optional[date] = None


class ContributionOut(BaseModel):
    id: str
    user_id: str
    user_name: str
    amount: float
    description: Optional[str] = None
    contribution_date: date
    created_at: datetime


# ---------- Dashboard ----------
class MemberSummary(BaseModel):
    user_id: str
    name: str
    avatar_url: Optional[str] = None
    total_paid: float
    total_share: float
    total_contributed: float
    balance: float  # positive = receives, negative = owes


class Debt(BaseModel):
    from_user_id: str
    from_name: str
    to_user_id: str
    to_name: str
    amount: float


class DashboardOut(BaseModel):
    house_id: str
    house_name: str
    currency: str
    total_expenses_month: float
    total_contributions_month: float
    house_balance: float  # contributions - expenses
    members_summary: List[MemberSummary]
    debts: List[Debt]
    expenses_by_category: List[dict]
    recent_expenses: List[ExpenseOut]


# ---------- Payments ----------
class PaymentCreate(BaseModel):
    from_user_id: str
    to_user_id: str
    amount: float = Field(gt=0)
    note: Optional[str] = None
