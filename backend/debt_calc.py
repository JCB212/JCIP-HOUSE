"""Debt optimization: minimize transfers between members."""
from typing import List, Dict


def optimize_debts(balances: Dict[str, float], names: Dict[str, str], epsilon: float = 0.01) -> List[dict]:
    """
    Given per-user net balances (positive = creditor, negative = debtor),
    return minimal list of transfers {from_user_id, to_user_id, amount}.
    Greedy algorithm.
    """
    debtors = sorted(
        [(uid, bal) for uid, bal in balances.items() if bal < -epsilon],
        key=lambda x: x[1],
    )  # most negative first
    creditors = sorted(
        [(uid, bal) for uid, bal in balances.items() if bal > epsilon],
        key=lambda x: -x[1],
    )  # most positive first

    transfers = []
    i = j = 0
    debtors = [list(d) for d in debtors]
    creditors = [list(c) for c in creditors]

    while i < len(debtors) and j < len(creditors):
        debtor_id, debt = debtors[i]
        creditor_id, credit = creditors[j]
        amount = min(-debt, credit)
        amount = round(amount, 2)
        if amount > epsilon:
            transfers.append({
                "from_user_id": debtor_id,
                "from_name": names.get(debtor_id, ""),
                "to_user_id": creditor_id,
                "to_name": names.get(creditor_id, ""),
                "amount": amount,
            })
        debtors[i][1] += amount
        creditors[j][1] -= amount
        if abs(debtors[i][1]) < epsilon:
            i += 1
        if abs(creditors[j][1]) < epsilon:
            j += 1
    return transfers
