import { NextResponse } from 'next/server';
import dbConnect, { isMockMode, getMockData, saveMockData } from '@/lib/mongodb';
import Person from '@/models/Person';
import Expense from '@/models/Expense';

export async function GET() {
  try {
    if (isMockMode) {
      const data = getMockData();
      return NextResponse.json(data);
    }
    await dbConnect();
    const [expenses, persons] = await Promise.all([
      Expense.find({}),
      Person.find({}),
    ]);
    return NextResponse.json({ expenses, persons });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { expenses, persons } = await request.json();

    if (!expenses || !persons || !Array.isArray(expenses) || !Array.isArray(persons)) {
      return NextResponse.json({ error: 'Invalid backup format' }, { status: 400 });
    }

    if (isMockMode) {
      saveMockData({ expenses, persons });
      return NextResponse.json({ success: true, message: 'Data restored successfully' });
    }

    await dbConnect();

    await Promise.all([
      Expense.deleteMany({}),
      Person.deleteMany({}),
    ]);

    if (persons.length > 0) {
      await Person.insertMany(persons);
    }

    if (expenses.length > 0) {
      await Expense.insertMany(expenses);
    }

    return NextResponse.json({ success: true, message: 'Data restored successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
