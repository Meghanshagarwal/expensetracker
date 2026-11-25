import { NextResponse } from 'next/server';
import dbConnect, { isMockMode, getMockData, saveMockData } from '@/lib/mongodb';
import Ipo from '@/models/Ipo';
import { indiaDate, ipoDate } from '@/lib/ipoDates';
import { ipoProfit, ipoRepaymentFields, ipoRepaymentTotal, ipoRepayments } from '@/lib/ipoSettlement';
import type { Ipo as IpoEntry, IpoRepayment } from '@/types';

const statuses = ['Applied', 'Allotted', 'Not Allotted'] as const;
type UpdateField = string | number | IpoRepayment[];
type ContributionReturn = { returnAmount?: number; returnDate?: string; repayments?: IpoRepayment[] };

class RepaymentUpdateError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function optionalAmount(value: unknown) {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 100) / 100;
}

function parseRepayments(rows: unknown): IpoRepayment[] {
  if (!Array.isArray(rows)) throw new RepaymentUpdateError('Repayments must be a list.', 400);
  return rows.map(row => {
    const amount = optionalAmount(row?.amount);
    const date = typeof row?.date === 'string' ? ipoDate(row.date) : undefined;
    if (!amount || !date || date > indiaDate()) {
      throw new RepaymentUpdateError('Enter a positive repayment and a valid date.', 400);
    }
    return { amount, date };
  });
}

// Normalise a contributions array coming from the client
function sanitizeContributions(list: any): any[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter(c => c && (c.from || c.amount))
    .map(c => ({
      from: String(c.from || 'Me').trim(),
      amount: Math.max(0, Number(c.amount) || 0),
      date: c.date ? new Date(c.date).toISOString() : new Date().toISOString(),
      returnDate: c.returnDate ? new Date(c.returnDate).toISOString() : undefined,
    }));
}

function buildPayload(body: any) {
  return {
    ipoName: String(body.ipoName || '').trim(),
    lots: Math.max(1, Math.floor(Number(body.lots) || 1)),
    amount: Math.max(0, Number(body.amount) || 0),
    appliedFrom: String(body.appliedFrom || 'Me').trim(),
    status: statuses.includes(body.status) ? body.status : 'Applied',
    applyDate: body.applyDate ? new Date(body.applyDate).toISOString() : new Date().toISOString(),
    openDate: body.openDate ? String(body.openDate).trim() : undefined,
    closeDate: body.closeDate ? String(body.closeDate).trim() : undefined,
    allotmentDate: typeof body.allotmentDate === 'string' ? ipoDate(body.allotmentDate) : undefined,
    contributions: sanitizeContributions(body.contributions),
    returnAmount: Math.max(0, Number(body.returnAmount) || 0),
    returnDate: body.returnDate ? new Date(body.returnDate).toISOString() : undefined,
    listingDate: typeof body.listingDate === 'string' ? ipoDate(body.listingDate) : undefined,
    profitAmount: Number(body.profitAmount) || 0,
    notes: body.notes ? String(body.notes).trim() : '',
  };
}

function resultUpdate(body: any, saved: IpoEntry) {
  const status = statuses.includes(body.status) ? body.status : saved.status;
  const withdrawnAmount = status === 'Allotted'
    ? 'withdrawnAmount' in body ? optionalAmount(body.withdrawnAmount) : saved.withdrawnAmount
    : undefined;
  const fields: Record<string, UpdateField | undefined> = {
    status,
    withdrawnAmount,
    profitAmount: withdrawnAmount !== undefined
      ? ipoProfit(withdrawnAmount, saved.amount)
      : status === 'Allotted' && saved.withdrawnAmount == null ? saved.profitAmount || 0 : 0,
    returnAmount: status === 'Not Allotted'
      ? saved.status === 'Not Allotted' ? saved.returnAmount : saved.amount
      : 0,
  };
  if (status !== 'Not Allotted') fields.returnDate = undefined;
  for (const field of ['allotmentDate', 'listingDate']) {
    if (field in body) fields[field] = typeof body[field] === 'string' ? ipoDate(body[field]) : undefined;
  }
  if (typeof body.notes === 'string') fields.notes = body.notes.trim();

  // Update only repayment fields. The original funding rows and their order are fixed.
  const repayments = new Map<number, ContributionReturn>();
  if (status !== 'Applied' && Array.isArray(body.contributionReturns)) {
    for (const item of body.contributionReturns) {
      if (!item || typeof item !== 'object' || !Number.isInteger(item.index)) continue;
      const contribution = saved.contributions?.[item.index];
      if (!contribution) continue;
      if ('repayments' in item) {
        const current = ipoRepayments(contribution);
        if (JSON.stringify(parseRepayments(item.previousRepayments)) !== JSON.stringify(current)) {
          throw new RepaymentUpdateError('Repayments changed since you opened this IPO. Reopen it to see the latest amounts.', 409);
        }
        const next = parseRepayments(item.repayments);
        if (ipoRepaymentTotal(next) > Math.max(contribution.amount, ipoRepaymentTotal(current))) {
          throw new RepaymentUpdateError('The repayment total is greater than the amount taken.', 400);
        }
        repayments.set(item.index, ipoRepaymentFields(next));
        continue;
      }
      if (contribution.repayments) continue;
      const returnAmount = optionalAmount(item.returnAmount);
      const date = typeof item.returnDate === 'string' ? ipoDate(item.returnDate) : undefined;
      repayments.set(item.index, { returnAmount, returnDate: returnAmount ? date : undefined });
    }
  }
  return { fields, repayments };
}

export async function GET() {
  try {
    if (isMockMode) {
      const data = getMockData();
      return NextResponse.json(data.ipos || []);
    }
    await dbConnect();
    const ipos = await Ipo.find({}).sort({ createdAt: -1 });
    return NextResponse.json(ipos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = buildPayload(body);
    if (!payload.ipoName) {
      return NextResponse.json({ error: 'IPO name is required' }, { status: 400 });
    }
    if (isMockMode) {
      const data = getMockData();
      if (!data.ipos) data.ipos = [];
      const newIpo = {
        _id: `mock_ipo_${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString(),
      };
      data.ipos.unshift(newIpo);
      saveMockData(data);
      return NextResponse.json(newIpo, { status: 201 });
    }

    await dbConnect();
    const newIpo = await Ipo.create(payload);
    return NextResponse.json(newIpo, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'IPO ID is required' }, { status: 400 });
    }

    if (isMockMode) {
      const data = getMockData();
      if (!data.ipos) data.ipos = [];
      const idx = data.ipos.findIndex((i: any) => i._id === id);
      if (idx === -1) {
        return NextResponse.json({ error: 'IPO not found' }, { status: 404 });
      }
      const saved: IpoEntry = data.ipos[idx];
      const { fields, repayments } = resultUpdate(body, saved);
      const contributions = (saved.contributions || []).map((row, index) => ({
        ...row, ...repayments.get(index),
      }));
      data.ipos[idx] = { ...saved, ...fields, contributions };
      saveMockData(data);
      return NextResponse.json(data.ipos[idx]);
    }

    await dbConnect();
    const saved = await Ipo.findById(id).lean<IpoEntry & { __v?: number }>();
    if (!saved) return NextResponse.json({ error: 'IPO not found' }, { status: 404 });
    const { fields, repayments } = resultUpdate(body, saved);
    for (const [index, payment] of repayments) {
      fields[`contributions.${index}.returnAmount`] = payment.returnAmount;
      fields[`contributions.${index}.returnDate`] = payment.returnDate;
      if (payment.repayments) fields[`contributions.${index}.repayments`] = payment.repayments;
    }
    const set: Record<string, UpdateField> = {};
    const unset: Record<string, 1> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) unset[key] = 1;
      else set[key] = value;
    }
    const updated = await Ipo.findOneAndUpdate(
      { _id: id, __v: saved.__v ?? { $exists: false } },
      { $set: set, $unset: unset, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );
    if (!updated) {
      return NextResponse.json({ error: 'The IPO changed while saving. Reopen it and try again.' }, { status: 409 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    const status = error instanceof RepaymentUpdateError ? error.status : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'IPO ID is required' }, { status: 400 });
    }

    if (isMockMode) {
      const data = getMockData();
      if (!data.ipos) data.ipos = [];
      const idx = data.ipos.findIndex((i: any) => i._id === id);
      if (idx === -1) {
        return NextResponse.json({ error: 'IPO not found' }, { status: 404 });
      }
      data.ipos.splice(idx, 1);
      saveMockData(data);
      return NextResponse.json({ success: true });
    }

    await dbConnect();
    const deleted = await Ipo.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'IPO not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
