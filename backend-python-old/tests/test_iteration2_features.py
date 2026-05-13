"""Backend tests for Iteration 2 features of JCIP House Finance.

Covers:
- House month_start_day create + PUT /settings
- GET /months auto-creates current month, respects start_day
- Close month + carried_balance + reopen
- Creating/deleting expenses in closed month -> 400
- Expense items -> amount computed; missing amount+items -> 400
- Default 'Supermercado' category with is_market_style=true
- Subcategories via parent_id
- CRUD /recurring + /contribution-plans
- /months/current/generate is idempotent
- Dashboard new fields (carried_balance, fixed/variable, current_month, house_balance)
- Recurring-generated expenses flagged is_recurring_instance=True & is_paid=False
"""
import os
import random
import string
from datetime import date

import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE}/api"


def rs(n=6):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def auth(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def ctx():
    """Fresh alice+bob+house with custom month_start_day=5."""
    suf = rs()
    alice_email = f"TEST_it2_alice_{suf}@test.com"
    bob_email = f"TEST_it2_bob_{suf}@test.com"

    a = requests.post(f"{API}/auth/register", json={
        "email": alice_email, "password": "senha123", "name": "Alice It2"}).json()
    b = requests.post(f"{API}/auth/register", json={
        "email": bob_email, "password": "senha123", "name": "Bob It2"}).json()

    # Create house with month_start_day=5
    r = requests.post(f"{API}/houses",
                      json={"name": f"TEST_Casa_It2_{suf}", "currency": "BRL", "month_start_day": 5},
                      headers=auth(a["token"]))
    assert r.status_code == 200, r.text
    h = r.json()
    assert h["month_start_day"] == 5, f"month_start_day expected 5, got {h.get('month_start_day')}"

    # Bob joins
    requests.post(f"{API}/houses/join", json={"invite_code": h["invite_code"]},
                  headers=auth(b["token"]))

    return {"alice": a, "bob": b, "house": h}


# ---------- Houses / Settings ----------
class TestHouseSettings:
    def test_month_start_day_persisted(self, ctx):
        r = requests.get(f"{API}/houses/{ctx['house']['id']}",
                         headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200
        assert r.json()["month_start_day"] == 5

    def test_update_settings_owner_only(self, ctx):
        # Bob (not owner) -> 403
        r = requests.put(f"{API}/houses/{ctx['house']['id']}/settings",
                         json={"month_start_day": 10},
                         headers=auth(ctx["bob"]["token"]))
        assert r.status_code == 403

    def test_update_settings_alice(self, ctx):
        r = requests.put(f"{API}/houses/{ctx['house']['id']}/settings",
                         json={"name": "TEST_Casa_Renamed",
                               "month_start_day": 10,
                               "gamification_enabled": False},
                         headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200, r.text
        h = r.json()
        assert h["name"] == "TEST_Casa_Renamed"
        assert h["month_start_day"] == 10
        assert h["gamification_enabled"] is False
        # reset to 5 for later tests
        requests.put(f"{API}/houses/{ctx['house']['id']}/settings",
                     json={"month_start_day": 5},
                     headers=auth(ctx["alice"]["token"]))


# ---------- Categories ----------
class TestCategories:
    def test_default_supermarket_market_style(self, ctx):
        r = requests.get(f"{API}/houses/{ctx['house']['id']}/categories",
                         headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200
        cats = r.json()
        supers = [c for c in cats if c["name"] == "Supermercado"]
        assert len(supers) == 1, "Default category 'Supermercado' missing"
        assert supers[0]["is_market_style"] is True
        ctx["super_cat_id"] = supers[0]["id"]
        # pick a non-market cat for generic
        non = [c for c in cats if not c["is_market_style"]]
        assert non, "Expected at least 1 non-market default category"
        ctx["generic_cat_id"] = non[0]["id"]

    def test_create_subcategory(self, ctx):
        r = requests.post(f"{API}/houses/{ctx['house']['id']}/categories",
                          json={"name": "Hortifruti", "icon": "leaf",
                                "color": "#22c55e",
                                "parent_id": ctx["super_cat_id"],
                                "is_market_style": True},
                          headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["parent_id"] == ctx["super_cat_id"]
        assert c["is_market_style"] is True


# ---------- Months ----------
class TestMonths:
    def test_list_months_auto_creates(self, ctx):
        r = requests.get(f"{API}/houses/{ctx['house']['id']}/months",
                         headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200, r.text
        ms = r.json()
        assert len(ms) >= 1
        m0 = ms[0]
        # With month_start_day=5, the month should begin on day 5.
        assert int(m0["start_date"].split("-")[2]) == 5, \
            f"Expected start_date day=5 (start_day=5), got {m0['start_date']}"
        assert m0["status"] == "open"
        assert m0["carried_balance"] == 0
        ctx["month"] = m0

    def test_close_and_reopen_month_carry_balance(self, ctx):
        # Add 100 contribution + 40 expense so balance=60 after close
        aid = ctx["alice"]["user"]["id"]
        r = requests.post(f"{API}/houses/{ctx['house']['id']}/contributions",
                          json={"user_id": aid, "amount": 100.0, "description": "TEST"},
                          headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200, r.text

        r = requests.post(f"{API}/houses/{ctx['house']['id']}/expenses",
                          json={"description": "TEST exp", "amount": 40.0,
                                "payer_id": aid, "expense_type": "collective",
                                "split_type": "equal",
                                "participants": [{"user_id": aid}]},
                          headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200, r.text
        ctx["tmp_expense_id"] = r.json()["id"]

        # Close with carry_balance=true
        mid = ctx["month"]["id"]
        r = requests.post(f"{API}/houses/{ctx['house']['id']}/months/{mid}/close",
                          json={"carry_balance": True},
                          headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["status"] == "closed"
        assert abs(m["carried_balance"] - 60.0) < 0.05, \
            f"carried_balance expected 60, got {m['carried_balance']}"

    def test_create_expense_closed_month_400(self, ctx):
        aid = ctx["alice"]["user"]["id"]
        r = requests.post(f"{API}/houses/{ctx['house']['id']}/expenses",
                          json={"description": "should fail", "amount": 10.0,
                                "payer_id": aid, "expense_type": "collective",
                                "split_type": "equal",
                                "participants": [{"user_id": aid}]},
                          headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 400

    def test_delete_expense_closed_month_400(self, ctx):
        r = requests.delete(
            f"{API}/houses/{ctx['house']['id']}/expenses/{ctx['tmp_expense_id']}",
            headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 400

    def test_reopen(self, ctx):
        mid = ctx["month"]["id"]
        r = requests.post(f"{API}/houses/{ctx['house']['id']}/months/{mid}/reopen",
                          headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "open"


# ---------- Expenses (items + validation) ----------
class TestExpensesV2:
    def test_expense_with_items_amount_auto(self, ctx):
        aid = ctx["alice"]["user"]["id"]
        bid = ctx["bob"]["user"]["id"]
        r = requests.post(f"{API}/houses/{ctx['house']['id']}/expenses",
                          json={"description": "Compras mercado",
                                "payer_id": aid,
                                "category_id": ctx["super_cat_id"],
                                "expense_type": "collective",
                                "split_type": "equal",
                                "participants": [{"user_id": aid},
                                                 {"user_id": bid}],
                                "items": [
                                    {"name": "Arroz", "quantity": 2, "unit_price": 15.0},
                                    {"name": "Feijão", "quantity": 1, "unit_price": 10.0}
                                ]},
                          headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200, r.text
        e = r.json()
        # 2*15 + 1*10 = 40
        assert abs(e["amount"] - 40.0) < 0.01
        assert e["has_items"] is True
        assert len(e["items"]) == 2

    def test_expense_without_items_no_amount_400(self, ctx):
        aid = ctx["alice"]["user"]["id"]
        r = requests.post(f"{API}/houses/{ctx['house']['id']}/expenses",
                          json={"description": "bad", "payer_id": aid,
                                "expense_type": "collective",
                                "split_type": "equal",
                                "participants": [{"user_id": aid}]},
                          headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 400


# ---------- Recurring ----------
class TestRecurring:
    def test_create_recurring(self, ctx):
        aid = ctx["alice"]["user"]["id"]
        r = requests.post(f"{API}/houses/{ctx['house']['id']}/recurring",
                          json={"name": "Aluguel TEST", "amount": 1200.0,
                                "category_id": ctx["generic_cat_id"],
                                "payer_id": aid, "frequency": "monthly",
                                "day_of_month": 5,
                                "expense_type": "collective",
                                "split_type": "equal",
                                "is_active": True},
                          headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["name"] == "Aluguel TEST"
        assert rec["amount"] == 1200.0
        ctx["rec_id"] = rec["id"]

    def test_list_and_update_recurring(self, ctx):
        r = requests.get(f"{API}/houses/{ctx['house']['id']}/recurring",
                         headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200
        assert any(x["id"] == ctx["rec_id"] for x in r.json())

        aid = ctx["alice"]["user"]["id"]
        r = requests.put(f"{API}/houses/{ctx['house']['id']}/recurring/{ctx['rec_id']}",
                         json={"name": "Aluguel TEST", "amount": 1300.0,
                               "category_id": ctx["generic_cat_id"],
                               "payer_id": aid, "frequency": "monthly",
                               "day_of_month": 5,
                               "expense_type": "collective",
                               "split_type": "equal",
                               "is_active": True},
                         headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200, r.text
        assert r.json()["amount"] == 1300.0


# ---------- Contribution Plans ----------
class TestContribPlans:
    def test_upsert_plan(self, ctx):
        aid = ctx["alice"]["user"]["id"]
        r = requests.post(f"{API}/houses/{ctx['house']['id']}/contribution-plans",
                          json={"user_id": aid, "amount": 500.0,
                                "is_active": True},
                          headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["amount"] == 500.0
        ctx["plan_id"] = p["id"]

        # Upsert same user -> should update same plan, not duplicate
        r2 = requests.post(f"{API}/houses/{ctx['house']['id']}/contribution-plans",
                           json={"user_id": aid, "amount": 750.0,
                                 "is_active": True},
                           headers=auth(ctx["alice"]["token"]))
        assert r2.status_code == 200
        assert r2.json()["id"] == p["id"]
        assert r2.json()["amount"] == 750.0

        # List should have exactly 1 plan for alice
        r3 = requests.get(f"{API}/houses/{ctx['house']['id']}/contribution-plans",
                          headers=auth(ctx["alice"]["token"]))
        plans_alice = [x for x in r3.json() if x["user_id"] == aid]
        assert len(plans_alice) == 1


# ---------- Generate ----------
class TestGenerate:
    def test_generate_creates_and_is_idempotent(self, ctx):
        url = f"{API}/houses/{ctx['house']['id']}/months/current/generate"
        r1 = requests.post(url, headers=auth(ctx["alice"]["token"]))
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["created_expenses"] >= 1, f"Expected >=1 recurring expense, got {d1}"
        assert d1["created_contributions"] >= 1, f"Expected >=1 contribution, got {d1}"

        # Second call -> idempotent
        r2 = requests.post(url, headers=auth(ctx["alice"]["token"]))
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["created_expenses"] == 0
        assert d2["created_contributions"] == 0

    def test_generated_expense_flags(self, ctx):
        r = requests.get(f"{API}/houses/{ctx['house']['id']}/expenses",
                         headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200
        rec_exps = [e for e in r.json() if e["is_recurring_instance"]]
        assert rec_exps, "No expense marked is_recurring_instance after generate"
        assert all(e["is_paid"] is False for e in rec_exps), \
            "Recurring-generated expenses should be is_paid=False"


# ---------- Dashboard ----------
class TestDashboardV2:
    def test_dashboard_new_fields(self, ctx):
        r = requests.get(f"{API}/houses/{ctx['house']['id']}/dashboard",
                         headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("current_month", "carried_balance",
                  "total_fixed_expenses", "total_variable_expenses",
                  "house_balance"):
            assert k in d, f"dashboard missing '{k}'"
        assert d["current_month"]["id"]
        # fixed should include the 1300 rent generated
        assert d["total_fixed_expenses"] >= 1300.0 - 0.01, \
            f"total_fixed_expenses expected >=1300, got {d['total_fixed_expenses']}"
        # variable should include the mercado=40 from earlier
        assert d["total_variable_expenses"] >= 40.0 - 0.01
        # house_balance = contribs + carried - expenses (carried=0 currently since month reopen)
        expected = round(d["total_contributions_month"] + d["carried_balance"]
                         - d["total_expenses_month"], 2)
        assert abs(d["house_balance"] - expected) < 0.05
