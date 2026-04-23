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
    month_start_day: int = 1


class HouseJoin(BaseModel):
    invite_code: str


class HouseSettingsIn(BaseModel):
    name: Optional[str] = None
    month_start_day: Optional[int] = Field(default=None, ge=1, le=28)
    gamification_enabled: Optional[bool] = None


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
    month_start_day: int
    members: List[MemberOut] = []


class WeightUpdate(BaseModel):
    user_id: str
    weight: float


# ---------- Categories ----------
class CategoryIn(BaseModel):
    name: str
    icon: str = "tag"
    color: str = "#3b82f6"
    parent_id: Optional[str] = None
    is_market_style: bool = False


class CategoryOut(BaseModel):
    id: str
    name: str
    icon: str
    color: str
    parent_id: Optional[str] = None
    is_market_style: bool

    class Config:
        from_attributes = True


# ---------- Months ----------
class MonthOut(BaseModel):
    id: str
    year: int
    month_number: int
    status: str
    start_date: date
    end_date: date
    carried_balance: float
    closed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CloseMonthIn(BaseModel):
    carry_balance: bool = False


# ---------- Expenses ----------
class ParticipantIn(BaseModel):
    user_id: str
    share_amount: Optional[float] = None


class ExpenseItemIn(BaseModel):
    name: str
    quantity: float = 1.0
    unit_price: float


class ExpenseItemOut(BaseModel):
    id: str
    name: str
    quantity: float
    unit_price: float
    total: float

    class Config:
        from_attributes = True


class ExpenseCreate(BaseModel):
    description: str
    amount: Optional[float] = None  # if items provided, computed from items
    payer_id: str
    category_id: Optional[str] = None
    expense_date: Optional[date] = None
    expense_type: str = "collective"
    split_type: str = "equal"
    participants: List[ParticipantIn] = []
    items: List[ExpenseItemIn] = []
    is_paid: bool = True
    notes: Optional[str] = None


class ExpenseParticipantOut(BaseModel):
    user_id: str
    name: str
    share_amount: float


class ExpenseOut(BaseModel):
    id: str
    month_id: Optional[str] = None
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
    has_items: bool
    is_paid: bool
    is_recurring_instance: bool
    notes: Optional[str] = None
    participants: List[ExpenseParticipantOut]
    items: List[ExpenseItemOut] = []
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
    is_auto: bool
    month_id: Optional[str] = None
    created_at: datetime


# ---------- Recurring ----------
class RecurringIn(BaseModel):
    name: str
    amount: float = Field(gt=0)
    category_id: Optional[str] = None
    payer_id: str
    frequency: str = "monthly"  # monthly|weekly|yearly
    day_of_month: int = 1
    expense_type: str = "collective"
    split_type: str = "equal"
    is_active: bool = True


class RecurringOut(BaseModel):
    id: str
    name: str
    amount: float
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    payer_id: str
    payer_name: str
    frequency: str
    day_of_month: int
    expense_type: str
    split_type: str
    is_active: bool
    last_generated_month: Optional[str] = None


class ContribPlanIn(BaseModel):
    user_id: str
    amount: float = Field(gt=0)
    is_active: bool = True


class ContribPlanOut(BaseModel):
    id: str
    user_id: str
    user_name: str
    amount: float
    is_active: bool
    last_generated_month: Optional[str] = None


# ---------- Dashboard ----------
class MemberSummary(BaseModel):
    user_id: str
    name: str
    avatar_url: Optional[str] = None
    total_paid: float
    total_share: float
    total_contributed: float
    balance: float


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
    current_month: MonthOut
    total_expenses_month: float
    total_fixed_expenses: float
    total_variable_expenses: float
    total_contributions_month: float
    house_balance: float
    carried_balance: float
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
