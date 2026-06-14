import { NextResponse } from 'next/server';
import dbConnect, { isMockMode, getMockData, saveMockData } from '@/lib/mongodb';
import Card from '@/models/Card';

const defaultCards = [
  { _id: 'card_onecard', name: 'OneCard', cardNetwork: 'Visa', last4: '1001', colorTheme: 'charcoal', statementDate: 5, dueDate: 22, createdAt: new Date(2026, 0, 1).toISOString() },
  { _id: 'card_icici', name: 'ICICI', cardNetwork: 'Visa', last4: '4004', colorTheme: 'coral', statementDate: 18, dueDate: 7, createdAt: new Date(2026, 0, 2).toISOString() },
  { _id: 'card_yesbank', name: 'Yes Bank', cardNetwork: 'Mastercard', last4: '8008', colorTheme: 'cobalt', statementDate: 25, dueDate: 14, createdAt: new Date(2026, 0, 3).toISOString() }
];

// Returns an integer day-of-month (1-31) or undefined if not a valid day
function sanitizeDay(value: any): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Math.floor(Number(value));
  if (Number.isNaN(n) || n < 1 || n > 31) return undefined;
  return n;
}

export async function GET() {
  try {
    if (isMockMode) {
      const data = getMockData();
      if (!data.cards || data.cards.length === 0) {
        data.cards = [...defaultCards];
        saveMockData(data);
      }
      return NextResponse.json(data.cards);
    }
    await dbConnect();
    let cards = await Card.find({}).sort({ createdAt: 1 });
    if (cards.length === 0) {
      // Seed default cards
      await Card.insertMany(defaultCards.map(({ _id, ...c }) => c));
      cards = await Card.find({}).sort({ createdAt: 1 });
    }
    return NextResponse.json(cards);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, cardNetwork, last4, colorTheme, statementDate, dueDate } = await request.json();
    if (!name || !cardNetwork || !last4) {
      return NextResponse.json({ error: 'Name, network and last 4 digits are required' }, { status: 400 });
    }

    if (isMockMode) {
      const data = getMockData();
      if (!data.cards) data.cards = [...defaultCards];

      const exists = data.cards.some((c: any) => c.name.toLowerCase() === name.trim().toLowerCase());
      if (exists) {
        return NextResponse.json({ error: 'Card with this name already exists' }, { status: 400 });
      }

      const newCard = {
        _id: `mock_card_${Date.now()}`,
        name: name.trim(),
        cardNetwork,
        last4: last4.trim(),
        colorTheme: colorTheme || 'charcoal',
        statementDate: sanitizeDay(statementDate),
        dueDate: sanitizeDay(dueDate),
        createdAt: new Date().toISOString()
      };
      data.cards.push(newCard);
      saveMockData(data);
      return NextResponse.json(newCard, { status: 201 });
    }

    await dbConnect();
    const exists = await Card.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });
    if (exists) {
      return NextResponse.json({ error: 'Card with this name already exists' }, { status: 400 });
    }

    const newCard = await Card.create({
      name: name.trim(),
      cardNetwork,
      last4: last4.trim(),
      colorTheme: colorTheme || 'charcoal',
      statementDate: sanitizeDay(statementDate),
      dueDate: sanitizeDay(dueDate)
    });
    return NextResponse.json(newCard, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, cardNetwork, last4, colorTheme, statementDate, dueDate } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
    }
    if (!name || !cardNetwork || !last4) {
      return NextResponse.json({ error: 'Name, network and last 4 digits are required' }, { status: 400 });
    }

    const updates = {
      name: name.trim(),
      cardNetwork,
      last4: last4.trim(),
      colorTheme: colorTheme || 'charcoal',
      statementDate: sanitizeDay(statementDate),
      dueDate: sanitizeDay(dueDate),
    };

    if (isMockMode) {
      const data = getMockData();
      if (!data.cards) data.cards = [...defaultCards];

      const idx = data.cards.findIndex((c: any) => c._id === id);
      if (idx === -1) {
        return NextResponse.json({ error: 'Card not found' }, { status: 404 });
      }
      // Prevent renaming onto another existing card's name
      const clash = data.cards.some((c: any) => c._id !== id && c.name.toLowerCase() === updates.name.toLowerCase());
      if (clash) {
        return NextResponse.json({ error: 'Card with this name already exists' }, { status: 400 });
      }
      data.cards[idx] = { ...data.cards[idx], ...updates };
      saveMockData(data);
      return NextResponse.json(data.cards[idx]);
    }

    await dbConnect();
    const clash = await Card.findOne({ _id: { $ne: id }, name: new RegExp(`^${updates.name}$`, 'i') });
    if (clash) {
      return NextResponse.json({ error: 'Card with this name already exists' }, { status: 400 });
    }
    const updated = await Card.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!updated) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
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
      return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
    }

    if (isMockMode) {
      const data = getMockData();
      if (!data.cards) data.cards = [...defaultCards];
      const idx = data.cards.findIndex((c: any) => c._id === id);
      if (idx === -1) {
        return NextResponse.json({ error: 'Card not found' }, { status: 404 });
      }
      data.cards.splice(idx, 1);
      saveMockData(data);
      return NextResponse.json({ success: true });
    }

    await dbConnect();
    const deleted = await Card.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
