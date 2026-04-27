export function simplifyDebts(balances) {
  const debtors = balances
    .filter((item) => item.balance < -0.009)
    .map((item) => ({ ...item, remaining: Math.abs(item.balance) }));
  const creditors = balances
    .filter((item) => item.balance > 0.009)
    .map((item) => ({ ...item, remaining: item.balance }));

  const settlements = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Number(Math.min(debtor.remaining, creditor.remaining).toFixed(2));

    settlements.push({
      fromUserId: debtor.userId,
      fromUserName: debtor.userName,
      toUserId: creditor.userId,
      toUserName: creditor.userName,
      amount,
    });

    debtor.remaining = Number((debtor.remaining - amount).toFixed(2));
    creditor.remaining = Number((creditor.remaining - amount).toFixed(2));

    if (debtor.remaining <= 0.009) i += 1;
    if (creditor.remaining <= 0.009) j += 1;
  }

  return settlements;
}

export function computeBalances(members, expenses) {
  const totals = {};
  for (const member of members) totals[member.id] = 0;

  for (const expense of expenses) {
    if (!(expense.payer_id in totals) || !(expense.borrower_id in totals)) continue;
    totals[expense.borrower_id] -= Number(expense.amount);
    totals[expense.payer_id] += Number(expense.amount);
  }

  return members
    .map((member) => ({
      userId: member.id,
      userName: member.name,
      balance: Number(Number(totals[member.id] || 0).toFixed(2)),
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName));
}

