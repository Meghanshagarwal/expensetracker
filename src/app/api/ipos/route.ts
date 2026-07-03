import { NextResponse } from 'next/server';
import dbConnect, { isMockMode, getMockData, saveMockData } from '@/lib/mongodb';
import Ipo from '@/models/Ipo';

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
    status: ['Applied', 'Allotted', 'Not Allotted'].includes(body.status) ? body.status : 'Applied',
    applyDate: body.applyDate ? new Date(body.applyDate).toISOString() : new Date().toISOString(),
    contributions: sanitizeContributions(body.contributions),
    returnAmount: Math.max(0, Number(body.returnAmount) || 0),
    returnDate: body.returnDate ? new Date(body.returnDate).toISOString() : undefined,
    notes: body.notes ? String(body.notes).trim() : '',
  };
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
    const payload = buildPayload(body);
    if (!payload.ipoName) {
      return NextResponse.json({ error: 'IPO name is required' }, { status: 400 });
    }

    if (isMockMode) {
      const data = getMockData();
      if (!data.ipos) data.ipos = [];
      const idx = data.ipos.findIndex((i: any) => i._id === id);
      if (idx === -1) {
        return NextResponse.json({ error: 'IPO not found' }, { status: 404 });
      }
      data.ipos[idx] = { ...data.ipos[idx], ...payload };
      saveMockData(data);
      return NextResponse.json(data.ipos[idx]);
    }

    await dbConnect();
    const updated = await Ipo.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!updated) {
      return NextResponse.json({ error: 'IPO not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
