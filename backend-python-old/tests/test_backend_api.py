"""Comprehensive backend tests for JCIP House Finance API."""
import os
import random
import string
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://jcip-house.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def rand_suffix(n=6):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


@pytest.fixture(scope="module")
def ctx():
    """Set up two users (alice, bob) + a shared house. Reuses or registers."""
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"

    def register_or_login(email, password, name):
        r = s.post(f"{API}/auth/register", json={"email": email, "password": password, "name": name})
        if r.status_code == 200:
            return r.json()
        # already exists -> login
        r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
        assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
        return r.json()

    suffix = rand_suffix()
    alice_email = f"TEST_alice_{suffix}@test.com"
    bob_email = f"TEST_bob_{suffix}@test.com"
    alice = register_or_login(alice_email, "senha123", "Alice Silva")
    bob = register_or_login(bob_email, "senha123", "Bob Costa")

    return {
        "alice": alice,  # {token, user:{id,...}}
        "bob": bob,
    }


def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- HEALTH / AUTH ----------------
class TestHealthAuth:
    def test_health(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "online"

    def test_register_returns_token_and_user(self):
        email = f"TEST_user_{rand_suffix()}@test.com"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "senha123", "name": "Test U"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["token"]
        assert data["user"]["email"] == email.lower()
        assert "id" in data["user"]

    def test_register_duplicate_fails(self, ctx):
        email = ctx["alice"]["user"]["email"]
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "senha123", "name": "XX"})
        assert r.status_code == 400

    def test_login_success(self, ctx):
        r = requests.post(f"{API}/auth/login", json={
            "email": ctx["alice"]["user"]["email"], "password": "senha123"
        })
        assert r.status_code == 200
        assert r.json()["user"]["id"] == ctx["alice"]["user"]["id"]

    def test_login_invalid_password(self, ctx):
        r = requests.post(f"{API}/auth/login", json={
            "email": ctx["alice"]["user"]["email"], "password": "wrong"
        })
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)


# ---------------- HOUSES ----------------
class TestHouses:
    def test_create_house(self, ctx):
        r = requests.post(f"{API}/houses", json={"name": "Casa JCIP TEST", "currency": "BRL"},
                          headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200, r.text
        h = r.json()
        assert h["name"] == "Casa JCIP TEST"
        assert len(h["invite_code"]) >= 6
        assert h["owner_id"] == ctx["alice"]["user"]["id"]
        assert len(h["members"]) == 1
        ctx["house"] = h

    def test_join_house_bob(self, ctx):
        code = ctx["house"]["invite_code"]
        r = requests.post(f"{API}/houses/join", json={"invite_code": code},
                          headers=auth(ctx["bob"]["token"]))
        assert r.status_code == 200, r.text
        h = r.json()
        member_uids = [m["user_id"] for m in h["members"]]
        assert ctx["alice"]["user"]["id"] in member_uids
        assert ctx["bob"]["user"]["id"] in member_uids

    def test_join_invalid_code(self, ctx):
        r = requests.post(f"{API}/houses/join", json={"invite_code": "NOTEXIST"},
                          headers=auth(ctx["bob"]["token"]))
        assert r.status_code == 404

    def test_list_my_houses(self, ctx):
        r = requests.get(f"{API}/houses", headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200
        ids = [h["id"] for h in r.json()]
        assert ctx["house"]["id"] in ids
        # Bob also sees it
        r2 = requests.get(f"{API}/houses", headers=auth(ctx["bob"]["token"]))
        assert ctx["house"]["id"] in [h["id"] for h in r2.json()]

    def test_update_member_weight(self, ctx):
        r = requests.put(
            f"{API}/houses/{ctx['house']['id']}/members/weight",
            json={"user_id": ctx["bob"]["user"]["id"], "weight": 2.0},
            headers=auth(ctx["alice"]["token"]),
        )
        assert r.status_code == 200, r.text
        bob_m = [m for m in r.json()["members"] if m["user_id"] == ctx["bob"]["user"]["id"]][0]
        assert bob_m["weight"] == 2.0
        # reset to 1.0 to keep math simple for later tests
        requests.put(
            f"{API}/houses/{ctx['house']['id']}/members/weight",
            json={"user_id": ctx["bob"]["user"]["id"], "weight": 1.0},
            headers=auth(ctx["alice"]["token"]),
        )


# ---------------- EXPENSES ----------------
class TestExpenses:
    def _get_category(self, ctx):
        r = requests.get(f"{API}/houses/{ctx['house']['id']}/categories",
                         headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) >= 8
        return cats[0]["id"]

    def test_expense_equal_split(self, ctx):
        cat = self._get_category(ctx)
        a_id = ctx["alice"]["user"]["id"]
        b_id = ctx["bob"]["user"]["id"]
        r = requests.post(
            f"{API}/houses/{ctx['house']['id']}/expenses",
            json={
                "description": "Mercado", "amount": 100.0, "payer_id": a_id,
                "category_id": cat, "expense_type": "collective", "split_type": "equal",
                "participants": [{"user_id": a_id}, {"user_id": b_id}],
            },
            headers=auth(ctx["alice"]["token"]),
        )
        assert r.status_code == 200, r.text
        e = r.json()
        shares = {p["user_id"]: p["share_amount"] for p in e["participants"]}
        assert round(shares[a_id] + shares[b_id], 2) == 100.0
        assert shares[a_id] == 50.0 and shares[b_id] == 50.0
        ctx["exp_equal_id"] = e["id"]

    def test_expense_weight_split(self, ctx):
        # Set weights 2:1
        requests.put(f"{API}/houses/{ctx['house']['id']}/members/weight",
                     json={"user_id": ctx["alice"]["user"]["id"], "weight": 2.0},
                     headers=auth(ctx["alice"]["token"]))
        a_id = ctx["alice"]["user"]["id"]
        b_id = ctx["bob"]["user"]["id"]
        r = requests.post(
            f"{API}/houses/{ctx['house']['id']}/expenses",
            json={
                "description": "Aluguel", "amount": 300.0, "payer_id": a_id,
                "expense_type": "collective", "split_type": "weight",
                "participants": [{"user_id": a_id}, {"user_id": b_id}],
            },
            headers=auth(ctx["alice"]["token"]),
        )
        assert r.status_code == 200, r.text
        shares = {p["user_id"]: p["share_amount"] for p in r.json()["participants"]}
        assert round(shares[a_id] + shares[b_id], 2) == 300.0
        assert abs(shares[a_id] - 200.0) < 0.05  # 2/3 of 300
        assert abs(shares[b_id] - 100.0) < 0.05
        # reset
        requests.put(f"{API}/houses/{ctx['house']['id']}/members/weight",
                     json={"user_id": ctx["alice"]["user"]["id"], "weight": 1.0},
                     headers=auth(ctx["alice"]["token"]))

    def test_expense_custom_valid(self, ctx):
        a_id = ctx["alice"]["user"]["id"]
        b_id = ctx["bob"]["user"]["id"]
        r = requests.post(
            f"{API}/houses/{ctx['house']['id']}/expenses",
            json={
                "description": "Pizza", "amount": 50.0, "payer_id": b_id,
                "expense_type": "collective", "split_type": "custom",
                "participants": [
                    {"user_id": a_id, "share_amount": 20.0},
                    {"user_id": b_id, "share_amount": 30.0},
                ],
            },
            headers=auth(ctx["bob"]["token"]),
        )
        assert r.status_code == 200, r.text
        shares = {p["user_id"]: p["share_amount"] for p in r.json()["participants"]}
        assert shares[a_id] == 20.0 and shares[b_id] == 30.0

    def test_expense_custom_invalid_sum(self, ctx):
        a_id = ctx["alice"]["user"]["id"]
        b_id = ctx["bob"]["user"]["id"]
        r = requests.post(
            f"{API}/houses/{ctx['house']['id']}/expenses",
            json={
                "description": "BadSum", "amount": 100.0, "payer_id": a_id,
                "split_type": "custom",
                "participants": [
                    {"user_id": a_id, "share_amount": 30.0},
                    {"user_id": b_id, "share_amount": 30.0},
                ],
            },
            headers=auth(ctx["alice"]["token"]),
        )
        assert r.status_code == 400

    def test_expense_individual(self, ctx):
        a_id = ctx["alice"]["user"]["id"]
        r = requests.post(
            f"{API}/houses/{ctx['house']['id']}/expenses",
            json={
                "description": "Remédio pessoal", "amount": 40.0, "payer_id": a_id,
                "expense_type": "individual", "split_type": "individual",
                "participants": [],
            },
            headers=auth(ctx["alice"]["token"]),
        )
        assert r.status_code == 200, r.text
        e = r.json()
        assert len(e["participants"]) == 1
        assert e["participants"][0]["user_id"] == a_id
        assert e["participants"][0]["share_amount"] == 40.0


# ---------------- CONTRIBUTIONS ----------------
class TestContributions:
    def test_create_contribution(self, ctx):
        r = requests.post(
            f"{API}/houses/{ctx['house']['id']}/contributions",
            json={"user_id": ctx["alice"]["user"]["id"], "amount": 500.0, "description": "Aporte mensal"},
            headers=auth(ctx["alice"]["token"]),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["amount"] == 500.0
        assert data["user_name"]


# ---------------- DASHBOARD ----------------
class TestDashboard:
    def test_dashboard_structure_and_debts(self, ctx):
        r = requests.get(f"{API}/houses/{ctx['house']['id']}/dashboard",
                         headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        # structure
        for k in ["house_id", "house_name", "members_summary", "debts",
                  "expenses_by_category", "total_expenses_month", "total_contributions_month"]:
            assert k in d, f"missing {k}"
        # Summary 2 members
        assert len(d["members_summary"]) == 2
        # Expenses so far (collective):
        # Mercado 100 (alice paid, both share 50/50) => alice +50, bob -50
        # Aluguel 300 (alice paid, weight split 2:1 => alice share 200, bob 100) => alice +100, bob -100
        # Pizza 50 (bob paid, alice:20 bob:30) => alice -20, bob +20
        # => alice balance: +130, bob: -130
        balances = {m["user_id"]: m["balance"] for m in d["members_summary"]}
        a = ctx["alice"]["user"]["id"]
        b = ctx["bob"]["user"]["id"]
        assert abs(balances[a] - 130.0) < 0.05, f"alice balance {balances[a]}"
        assert abs(balances[b] - (-130.0)) < 0.05, f"bob balance {balances[b]}"
        # Debts: bob -> alice 130
        assert len(d["debts"]) == 1
        debt = d["debts"][0]
        assert debt["from_user_id"] == b and debt["to_user_id"] == a
        assert abs(debt["amount"] - 130.0) < 0.05
        # totals: collective expenses only = 100+300+50 = 450
        assert abs(d["total_expenses_month"] - 450.0) < 0.05
        assert abs(d["total_contributions_month"] - 500.0) < 0.05

    def test_payment_affects_balance(self, ctx):
        # Bob pays Alice 50 -> Alice balance drops to 80, Bob -80
        r = requests.post(
            f"{API}/houses/{ctx['house']['id']}/payments",
            json={"from_user_id": ctx["bob"]["user"]["id"],
                  "to_user_id": ctx["alice"]["user"]["id"],
                  "amount": 50.0, "note": "parcial"},
            headers=auth(ctx["bob"]["token"]),
        )
        assert r.status_code == 200
        r2 = requests.get(f"{API}/houses/{ctx['house']['id']}/dashboard",
                          headers=auth(ctx["alice"]["token"]))
        balances = {m["user_id"]: m["balance"] for m in r2.json()["members_summary"]}
        a = ctx["alice"]["user"]["id"]; b = ctx["bob"]["user"]["id"]
        assert abs(balances[a] - 80.0) < 0.05
        assert abs(balances[b] - (-80.0)) < 0.05

    def test_delete_expense_recalcs(self, ctx):
        eid = ctx["exp_equal_id"]
        r = requests.delete(f"{API}/houses/{ctx['house']['id']}/expenses/{eid}",
                            headers=auth(ctx["alice"]["token"]))
        assert r.status_code == 200
        # After delete, Mercado (100, +50/-50) removed.
        # remaining: Aluguel +100/-100, Pizza -20/+20, Payment(+50/-50)
        # Alice: +100 -20 +50 = +130 - 50 = ... wait recompute.
        # paid_by: alice=300, bob=50. share_by: alice=220, bob=130.
        # pre-payment: alice = 300-220=80, bob = 50-130=-80.
        # + payment from bob->alice 50 => alice = 80-50=30, bob = -80+50=-30.
        r2 = requests.get(f"{API}/houses/{ctx['house']['id']}/dashboard",
                          headers=auth(ctx["alice"]["token"]))
        balances = {m["user_id"]: m["balance"] for m in r2.json()["members_summary"]}
        a = ctx["alice"]["user"]["id"]; b = ctx["bob"]["user"]["id"]
        assert abs(balances[a] - 30.0) < 0.05, f"alice {balances[a]}"
        assert abs(balances[b] - (-30.0)) < 0.05, f"bob {balances[b]}"


class TestAccessControl:
    def test_non_member_forbidden(self, ctx):
        # new user
        email = f"TEST_outsider_{rand_suffix()}@test.com"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "senha123", "name": "Out"})
        tok = r.json()["token"]
        r2 = requests.get(f"{API}/houses/{ctx['house']['id']}/dashboard", headers=auth(tok))
        assert r2.status_code == 403
