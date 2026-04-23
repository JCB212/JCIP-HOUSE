"""Helpers for month-cycle management."""
from datetime import date, timedelta
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from models import Month


def month_range_for(year: int, month_number: int, start_day: int) -> Tuple[date, date]:
    """Return (start_date, end_date_exclusive) for a logical month starting at start_day.
    The 'month' labelled month_number/year starts at year-month_number-start_day and ends
    at the same day of the following month (exclusive).
    If start_day=1 (default) it matches calendar months.
    """
    start = date(year, month_number, min(start_day, 28))
    if month_number == 12:
        end = date(year + 1, 1, min(start_day, 28))
    else:
        end = date(year, month_number + 1, min(start_day, 28))
    return start, end


def find_logical_month(for_date: date, start_day: int) -> Tuple[int, int]:
    """Return (year, month_number) label for a given date, respecting start_day."""
    if for_date.day >= min(start_day, 28):
        return for_date.year, for_date.month
    # Before start_day → belongs to previous logical month
    m = for_date.month - 1 or 12
    y = for_date.year if for_date.month > 1 else for_date.year - 1
    return y, m


def ensure_month(db: Session, house_id: str, for_date: date, start_day: int) -> Month:
    year, mnum = find_logical_month(for_date, start_day)
    existing = (
        db.query(Month)
        .filter(Month.house_id == house_id, Month.year == year, Month.month_number == mnum)
        .first()
    )
    if existing:
        return existing
    start, end = month_range_for(year, mnum, start_day)
    m = Month(
        house_id=house_id,
        year=year,
        month_number=mnum,
        start_date=start,
        end_date=end,
        status="open",
    )
    db.add(m)
    db.flush()
    return m


def get_current_month(db: Session, house_id: str, start_day: int, today: Optional[date] = None) -> Month:
    today = today or date.today()
    return ensure_month(db, house_id, today, start_day)
