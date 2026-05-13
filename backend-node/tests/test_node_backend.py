"""
JCIP House Finance - Node.js backend regression (iteration 3)
Covers: auth, houses (create+settings+join), expenses (equal/weight/custom/individual + items + default split),
contributions, months (auto-create + close + create-expense-after-close=400),
recurring CRUD, contribution plan upsert, generate idempotency, dashboard, payments.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

# ---------- fixtures ----------
@pytest.fixture(scope="module")
def suf():
    return uuid.uuid4().hex[:8]

@pytest.fixture(scope="module")
def alice(suf):
    em = f"TEST_alice_{suf}@test.com"
    r = requests.post(f"{API}/auth/register", json={"email": em, "name": "Alice T", "password": "senha123"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "email": em}

@pytest.fixture(scope="module")
def bob(suf):
    em = f"TEST_bob_{suf}@test.com"
    r = requests.post(f"{API}/auth/register", json={"email": em, "name": "Bob T", "password": "senha123"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "email": em}

def H(t): return {"Authorization": f"Bearer {t}"}

@pytest.fixture(scope="module")
def house(alice, bob):
    # Create house with month_start_day=5
    r = requests.post(f"{API}/houses", headers=H(alice["token"]),
                      json={"name": f"TEST_Casa_{uuid.uuid4().hex[:6]}", "month_start_day": 5})
    assert r.status_code == 200, r.text
    h = r.json()
    assert h["month_start_day"] == 5
    assert "invite_code" in h
    # Bob joins
    r2 = requests.post(f"{API}/houses/join", headers=H(bob["token"]),
                       json={"invite_code": h["invite_code"]})
    assert r2.status_code == 200, r2.text
    h2 = r2.json()
    assert len(h2["members"]) == 2
    # get categories
    cats = requests.get(f"{API}/houses/{h['id']}/categories", headers=H(alice["token"])).json()
    h["categories"] = cats
    return h

# ---------- AUTH ----------
class TestAuth:
    def test_register_returns_token_user(self, alice):
        assert alice["token"] and alice["user"]["id"]
        assert alice["user"]["email"].startswith("test_alice_")

    def test_login_valid(self, alice):
        r = requests.post(f"{API}/auth/login", json={"email": alice["email"], "password": "senha123"})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_invalid(self, alice):
        r = requests.post(f"{API}/auth/login", json={"email": alice["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, alice):
        r = requests.get(f"{API}/auth/me", headers=H(alice["token"]))
        assert r.status_code == 200
        assert r.json()["id"] == alice["user"]["id"]

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

# ---------- HOUSES ----------
class TestHouses:
    def test_create_accepts_month_start_day_and_invite_code(self, house):
        assert house["month_start_day"] == 5 and len(house["invite_code"]) >= 4

    def test_join_idempotent(self, house, bob):
        r = requests.post(f"{API}/houses/join", headers=H(bob["token"]),
                          json={"invite_code": house["invite_code"]})
        assert r.status_code == 200
        assert len(r.json()["members"]) == 2

    def test_settings_owner_updates(self, house, alice):
        r = requests.put(f"{API}/houses/{house['id']}/settings", headers=H(alice["token"]),
                         json={"name": "TEST_Renamed", "month_start_day": 10,
                               "gamification_enabled": False})
        assert r.status_code == 200
        j = r.json()
        assert j["name"] == "TEST_Renamed"
        assert j["month_start_day"] == 10
        assert j["gamification_enabled"] is False
        # restore start day
        requests.put(f"{API}/houses/{house['id']}/settings", headers=H(alice["token"]),
                     json={"month_start_day": 5})

    def test_settings_non_owner_forbidden(self, house, bob):
        r = requests.put(f"{API}/houses/{house['id']}/settings", headers=H(bob["token"]),
                         json={"name": "HackAttempt"})
        assert r.status_code == 403

# ---------- MONTHS ----------
class TestMonths:
    def test_list_auto_creates_current(self, house, alice):
        r = requests.get(f"{API}/houses/{house['id']}/months", headers=H(alice["token"]))
        assert r.status_code == 200
        ms = r.json()
        assert len(ms) >= 1
        m0 = ms[0]
        # month_start_day=5 -> start_date day is 05
        assert m0["start_date"].endswith("-05") or m0["start_date"][-2:] == "05"
        house["current_month"] = m0

# ---------- EXPENSES ----------
class TestExpenses:
    def _cat(self, house, name):
        for c in house["categories"]:
            if c["name"] == name: return c
        return None

    def test_expense_equal_default_split(self, house, alice, bob):
        # Omit split_type → should default to equal
        r = requests.post(f"{API}/houses/{house['id']}/expenses",
                          headers=H(alice["token"]),
                          json={"payer_id": alice["user"]["id"],
                                "amount": 100, "description": "TEST eq default",
                                "category_id": self._cat(house, "Contas")["id"]})
        assert r.status_code == 200, r.text
        e = r.json()
        assert e["split_type"] == "equal"
        assert e["amount"] == 100
        assert len(e["participants"]) == 2
        total = round(sum(p["share_amount"] for p in e["participants"]), 2)
        assert total == 100.0

    def test_expense_weight(self, house, alice, bob):
        r = requests.post(f"{API}/houses/{house['id']}/expenses",
                          headers=H(alice["token"]),
                          json={"payer_id": alice["user"]["id"],
                                "amount": 300, "description": "TEST weight",
                                "split_type": "weight"})
        assert r.status_code == 200
        e = r.json()
        # default weights 1/1 → 150/150
        amounts = sorted(p["share_amount"] for p in e["participants"])
        assert amounts == [150.0, 150.0]

    def test_expense_custom_ok(self, house, alice, bob):
        r = requests.post(f"{API}/houses/{house['id']}/expenses",
                          headers=H(alice["token"]),
                          json={"payer_id": alice["user"]["id"],
                                "amount": 100, "description": "TEST custom",
                                "split_type": "custom",
                                "participants": [
                                    {"user_id": alice["user"]["id"], "share_amount": 70},
                                    {"user_id": bob["user"]["id"], "share_amount": 30}]})
        assert r.status_code == 200
        shares = {p["user_id"]: p["share_amount"] for p in r.json()["participants"]}
        assert shares[alice["user"]["id"]] == 70
        assert shares[bob["user"]["id"]] == 30

    def test_expense_custom_mismatch_400(self, house, alice, bob):
        r = requests.post(f"{API}/houses/{house['id']}/expenses",
                          headers=H(alice["token"]),
                          json={"payer_id": alice["user"]["id"],
                                "amount": 100, "description": "TEST bad custom",
                                "split_type": "custom",
                                "participants": [{"user_id": alice["user"]["id"], "share_amount": 50}]})
        assert r.status_code == 400

    def test_expense_individual(self, house, alice):
        r = requests.post(f"{API}/houses/{house['id']}/expenses",
                          headers=H(alice["token"]),
                          json={"payer_id": alice["user"]["id"],
                                "amount": 50, "description": "TEST indiv",
                                "split_type": "individual"})
        assert r.status_code == 200
        e = r.json()
        assert len(e["participants"]) == 1
        assert e["participants"][0]["user_id"] == alice["user"]["id"]

    def test_expense_market_items_auto_amount(self, house, alice):
        sup = self._cat(house, "Supermercado")
        assert sup and sup["is_market_style"] is True
        r = requests.post(f"{API}/houses/{house['id']}/expenses",
                          headers=H(alice["token"]),
                          json={"payer_id": alice["user"]["id"],
                                "description": "TEST mercado",
                                "category_id": sup["id"],
                                "items": [
                                    {"name": "Arroz", "quantity": 2, "unit_price": 15},
                                    {"name": "Feijão", "quantity": 1, "unit_price": 10}]})
        assert r.status_code == 200
        e = r.json()
        assert e["amount"] == 40
        assert e["has_items"] is True
        assert len(e["items"]) == 2

    def test_expense_missing_amount_400(self, house, alice):
        r = requests.post(f"{API}/houses/{house['id']}/expenses",
                          headers=H(alice["token"]),
                          json={"payer_id": alice["user"]["id"], "description": "no amount"})
        assert r.status_code == 400

# ---------- CONTRIBUTIONS + CLOSE MONTH ----------
class TestContributionsAndClose:
    def test_contribution_create(self, house, alice):
        r = requests.post(f"{API}/houses/{house['id']}/contributions",
                          headers=H(alice["token"]),
                          json={"user_id": alice["user"]["id"], "amount": 500,
                                "description": "TEST contrib"})
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["amount"] == 500
        assert c["month_id"]

    def test_close_month_then_expense_400(self, house, alice):
        mid = house["current_month"]["id"]
        r = requests.post(f"{API}/houses/{house['id']}/months/{mid}/close",
                          headers=H(alice["token"]),
                          json={"carry_balance": False})
        assert r.status_code == 200
        assert r.json()["status"] == "closed"
        # Creating expense now should 400
        r2 = requests.post(f"{API}/houses/{house['id']}/expenses",
                           headers=H(alice["token"]),
                           json={"payer_id": alice["user"]["id"],
                                 "amount": 10, "description": "TEST after close"})
        assert r2.status_code == 400
        # reopen
        r3 = requests.post(f"{API}/houses/{house['id']}/months/{mid}/reopen",
                           headers=H(alice["token"]))
        assert r3.status_code == 200
        assert r3.json()["status"] == "open"

# ---------- RECURRING + PLANS + GENERATE ----------
class TestRecurringAndGenerate:
    def test_recurring_crud(self, house, alice):
        r = requests.post(f"{API}/houses/{house['id']}/recurring",
                          headers=H(alice["token"]),
                          json={"name": "TEST Aluguel", "amount": 1000,
                                "payer_id": alice["user"]["id"],
                                "frequency": "monthly", "day_of_month": 5,
                                "split_type": "equal"})
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        # update
        u = requests.put(f"{API}/houses/{house['id']}/recurring/{rid}",
                         headers=H(alice["token"]),
                         json={"name": "TEST Aluguel2", "amount": 1200,
                               "payer_id": alice["user"]["id"],
                               "frequency": "monthly", "day_of_month": 10,
                               "split_type": "equal"})
        assert u.status_code == 200
        assert u.json()["amount"] == 1200
        lst = requests.get(f"{API}/houses/{house['id']}/recurring",
                           headers=H(alice["token"])).json()
        assert any(x["id"] == rid for x in lst)
        house["recurring_id"] = rid

    def test_contribution_plan_upsert(self, house, alice, bob):
        r1 = requests.post(f"{API}/houses/{house['id']}/contribution-plans",
                           headers=H(alice["token"]),
                           json={"user_id": alice["user"]["id"], "amount": 800})
        assert r1.status_code == 200
        id1 = r1.json()["id"]
        r2 = requests.post(f"{API}/houses/{house['id']}/contribution-plans",
                           headers=H(alice["token"]),
                           json={"user_id": alice["user"]["id"], "amount": 900})
        assert r2.status_code == 200
        assert r2.json()["id"] == id1  # upsert by user
        assert r2.json()["amount"] == 900
        # Bob plan
        rb = requests.post(f"{API}/houses/{house['id']}/contribution-plans",
                           headers=H(alice["token"]),
                           json={"user_id": bob["user"]["id"], "amount": 700})
        assert rb.status_code == 200

    def test_generate_current_month_idempotent(self, house, alice):
        r1 = requests.post(f"{API}/houses/{house['id']}/months/current/generate",
                           headers=H(alice["token"]))
        assert r1.status_code == 200, r1.text
        j1 = r1.json()
        assert j1["ok"] is True
        first_exp, first_contr = j1["created_expenses"], j1["created_contributions"]
        assert first_exp >= 1
        assert first_contr >= 2
        # Run 2x — must be 0/0
        r2 = requests.post(f"{API}/houses/{house['id']}/months/current/generate",
                           headers=H(alice["token"]))
        j2 = r2.json()
        assert j2["created_expenses"] == 0
        assert j2["created_contributions"] == 0

# ---------- DASHBOARD + PAYMENTS ----------
class TestDashboard:
    def test_dashboard_shape(self, house, alice):
        r = requests.get(f"{API}/houses/{house['id']}/dashboard", headers=H(alice["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["current_month", "total_fixed_expenses", "total_variable_expenses",
                  "carried_balance", "members_summary", "debts", "expenses_by_category"]:
            assert k in d, f"Missing {k}"
        assert d["total_fixed_expenses"] >= 1200  # from generated recurring
        assert isinstance(d["members_summary"], list) and len(d["members_summary"]) == 2

    def test_payment_affects_balance(self, house, alice, bob):
        # Get prior balance
        d0 = requests.get(f"{API}/houses/{house['id']}/dashboard",
                          headers=H(alice["token"])).json()
        bob_bal0 = next(m["balance"] for m in d0["members_summary"]
                        if m["user_id"] == bob["user"]["id"])
        r = requests.post(f"{API}/houses/{house['id']}/payments",
                          headers=H(bob["token"]),
                          json={"from_user_id": bob["user"]["id"],
                                "to_user_id": alice["user"]["id"], "amount": 50})
        assert r.status_code == 200
        d1 = requests.get(f"{API}/houses/{house['id']}/dashboard",
                          headers=H(alice["token"])).json()
        bob_bal1 = next(m["balance"] for m in d1["members_summary"]
                        if m["user_id"] == bob["user"]["id"])
        assert round(bob_bal1 - bob_bal0, 2) == 50.0
