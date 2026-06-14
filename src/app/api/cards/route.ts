import { NextResponse } from 'next/server';
import dbConnect, { isMockMode, getMockData, saveMockData } from '@/lib/mongodb';
import Card from '@/models/Card';

const defaultCards = [
  { _id: 'card_onecard', name: 'OneCard', cardNetwork: 'Visa', last4: '1001', colorTheme: 'charcoal', createdAt: new Date(2026, 0, 1).toISOString() },
  { _id: 'card_icici', name: 'ICICI', cardNetwork: 'Visa', last4: '4004', colorTheme: 'coral', createdAt: new Date(2026, 0, 2).toISOString() },
  { _id: 'card_yesbank', name: 'Yes Bank', cardNetwork: 'Mastercard', last4: '8008', colorTheme: 'cobalt', createdAt: new Date(2026, 0, 3).toISOString() }
];

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
    const { name, cardNetwork, last4, colorTheme } = await request.json();
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
      colorTheme: colorTheme || 'charcoal'
    });
    return NextResponse.json(newCard, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
