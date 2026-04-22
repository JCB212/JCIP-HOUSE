"""SQLAlchemy ORM models for JCIP House Finance."""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text, Date, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    password_hash = Column(String(255), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    memberships = relationship("HouseMember", back_populates="user", cascade="all, delete-orphan")


class House(Base):
    __tablename__ = "houses"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(120), nullable=False)
    invite_code = Column(String(12), unique=True, nullable=False, index=True)
    currency = Column(String(6), default="BRL", nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    gamification_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    members = relationship("HouseMember", back_populates="house", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="house", cascade="all, delete-orphan")
    contributions = relationship("Contribution", back_populates="house", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="house", cascade="all, delete-orphan")


class HouseMember(Base):
    __tablename__ = "house_members"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    house_id = Column(String(36), ForeignKey("houses.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    weight = Column(Float, default=1.0, nullable=False)
    role = Column(String(20), default="member", nullable=False)  # owner | admin | member
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("house_id", "user_id", name="uq_house_user"),)

    house = relationship("House", back_populates="members")
    user = relationship("User", back_populates="memberships")


class Category(Base):
    __tablename__ = "categories"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    house_id = Column(String(36), ForeignKey("houses.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(80), nullable=False)
    icon = Column(String(40), default="tag", nullable=False)
    color = Column(String(20), default="#3b82f6", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    house = relationship("House", back_populates="categories")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    house_id = Column(String(36), ForeignKey("houses.id", ondelete="CASCADE"), nullable=False, index=True)
    payer_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=True)
    description = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    expense_date = Column(Date, default=datetime.utcnow, nullable=False)
    expense_type = Column(String(20), default="collective", nullable=False)  # collective | individual
    split_type = Column(String(20), default="equal", nullable=False)  # equal | custom | weight | individual
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (Index("ix_expense_house_date", "house_id", "expense_date"),)

    house = relationship("House", back_populates="expenses")
    participants = relationship("ExpenseParticipant", back_populates="expense", cascade="all, delete-orphan")


class ExpenseParticipant(Base):
    __tablename__ = "expense_participants"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    expense_id = Column(String(36), ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    share_amount = Column(Float, nullable=False)  # how much this user owes

    expense = relationship("Expense", back_populates="participants")


class Contribution(Base):
    __tablename__ = "contributions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    house_id = Column(String(36), ForeignKey("houses.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String(255), nullable=True)
    contribution_date = Column(Date, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    house = relationship("House", back_populates="contributions")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    house_id = Column(String(36), ForeignKey("houses.id", ondelete="CASCADE"), nullable=False, index=True)
    from_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    to_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    note = Column(String(255), nullable=True)
    payment_date = Column(Date, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    house_id = Column(String(36), ForeignKey("houses.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    action = Column(String(80), nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
