import type { Ipo, IpoContribution, IpoRepayment } from '@/types';

export const IPO_REFUND_ACCOUNTS = ['Mummy', 'Papa', 'Anshshikha'] as const;
type RefundAccount = typeof IPO_REFUND_ACCOUNTS[number];

export function ipoProfit(withdrawnAmount: number, applicationAmount: number) {
  return (Math.round(withdrawnAmount * 100) - Math.round(applicationAmount * 100)) / 100;
}

export function ipoReturnRemaining(amountTaken: number, amountReturned: number) {
  return Math.max(0, ipoProfit(amountTaken, amountReturned));
}

function fundingPerson(name: string) {
  const key = name.trim().toLowerCase();
  if (key === 'my salaried account' || key === 'my salary account' || key === 'my self') return 'me';
  return key === 'anshu' ? 'anshshikha' : key;
}

function refundAccount(name: string) {
  return IPO_REFUND_ACCOUNTS.find(account => account.toLowerCase() === fundingPerson(name));
}

const paise = (amount: number) => Math.max(0, Math.round(amount * 100));

function storedDay(date: string | Date) {
  return (date instanceof Date ? date.toISOString() : date).slice(0, 10);
}

export function ipoRepayments(contribution: IpoContribution): IpoRepayment[] {
  if (contribution.repayments) {
    return contribution.repayments.map(row => ({ amount: row.amount, date: storedDay(row.date) }));
  }
  const amount = contribution.returnAmount ?? contribution.amount;
  return contribution.returnDate && amount > 0 ? [{ amount, date: storedDay(contribution.returnDate) }] : [];
}

export function ipoRepaymentTotal(repayments: IpoRepayment[]) {
  return repayments.reduce((total, row) => total + paise(row.amount), 0) / 100;
}

export function ipoRepaymentFields(repayments: IpoRepayment[]) {
  const returnDate = repayments.reduce((latest, row) => row.date > latest ? row.date : latest, '');
  return {
    repayments,
    returnAmount: repayments.length ? ipoRepaymentTotal(repayments) : undefined,
    returnDate: returnDate || undefined,
  };
}

export function ipoRefundBalances(ipos: Ipo[]): Partial<Record<string, number>> {
  const balances: Record<RefundAccount, number> = { Mummy: 0, Papa: 0, Anshshikha: 0 };
  const sorted = [...ipos].sort((a, b) =>
    Date.parse(a.applyDate) - Date.parse(b.applyDate) || Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );

  for (const ipo of sorted) {
    const funding = ipo.contributions ?? [];
    const applied = paise(ipo.amount);
    const applicant = refundAccount(ipo.appliedFrom);
    if (applicant) {
      const freshFunding = funding
        .filter(row => fundingPerson(row.from) !== fundingPerson(applicant))
        .reduce((sum, row) => sum + paise(row.amount), 0);
      balances[applicant] = Math.max(0, balances[applicant] - Math.max(0, applied - freshFunding));
    }

    const recovered = ipo.status === 'Allotted' ? ipo.withdrawnAmount
      : ipo.status === 'Not Allotted' && !ipo.returnDate ? ipo.returnAmount
      : undefined;
    if (!recovered || recovered <= 0) continue;

    let totalPaid = 0;
    let totalFunded = 0;
    const shares: { account?: RefundAccount; remaining: number }[] = [];
    for (const row of funding) {
      const taken = paise(row.amount);
      const paid = paise(ipoRepaymentTotal(ipoRepayments(row)));
      totalFunded += taken;
      totalPaid += paid;
      shares.push({ account: refundAccount(row.from) ?? applicant, remaining: Math.max(0, taken - paid) });
    }
    // Any untracked part of the original investment belongs to the applying account.
    shares.push({ account: applicant, remaining: Math.max(0, applied - totalFunded) });

    let pending = shares.reduce((sum, share) => sum + share.remaining, 0);
    let available = Math.min(pending, Math.max(0, paise(recovered) - totalPaid));
    // When an IPO sells at a loss, distribute the available cash across outstanding shares.
    for (const share of shares) {
      if (!pending || !available) break;
      const credit = Math.round(available * share.remaining / pending);
      if (share.account) balances[share.account] += credit;
      available -= credit;
      pending -= share.remaining;
    }
  }

  return Object.fromEntries(IPO_REFUND_ACCOUNTS.map(account => [account, balances[account] / 100]));
}
