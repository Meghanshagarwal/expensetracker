import { NextResponse } from 'next/server';
import dbConnect, { isMockMode, getMockData, saveMockData } from '@/lib/mongodb';
import Expense from '@/models/Expense';

export async function GET() {
  try {
    if (isMockMode) {
      const { expenses } = getMockData();
      const sorted = [...expenses].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return NextResponse.json(sorted);
    }
    await dbConnect();
    const expenses = await Expense.find({}).sort({ date: -1 });
    return NextResponse.json(expenses);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (isMockMode) {
      const data = getMockData();
      const newExpense = {
        _id: `mock_exp_${Date.now()}`,
        ...body,
        createdAt: new Date().toISOString()
      };
      data.expenses.push(newExpense);
      saveMockData(data);
      return NextResponse.json(newExpense, { status: 201 });
    }
    await dbConnect();
    const newExpense = await Expense.create(body);
    return NextResponse.json(newExpense, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, ...updateData } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Identify conditional fields that should be $unset when undefined
    // (e.g., petrol fields when category changes away from Petrol)
    const conditionalFields = [
      'vehicle', 'litres', 'petrolPrice', 'km', 'mileage',
      'upiApp', 'upiLinkedAccount', 'creditCardIssuer',
    ];
    const fieldsToUnset: Record<string, 1> = {};
    for (const field of conditionalFields) {
      if (field in updateData && (updateData[field] === undefined || updateData[field] === null)) {
        fieldsToUnset[field] = 1;
        delete updateData[field];
      }
    }

    if (isMockMode) {
      const data = getMockData();
      const idx = data.expenses.findIndex((e: any) => e._id === id);
      if (idx === -1) {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
      }
      // Apply updates and remove unset fields
      data.expenses[idx] = { ...data.expenses[idx], ...updateData };
      for (const field of Object.keys(fieldsToUnset)) {
        delete data.expenses[idx][field];
      }
      saveMockData(data);
      return NextResponse.json(data.expenses[idx]);
    }
    await dbConnect();

    const mongoUpdate: Record<string, any> = { $set: updateData };
    if (Object.keys(fieldsToUnset).length > 0) {
      mongoUpdate.$unset = fieldsToUnset;
    }

    const updatedExpense = await Expense.findByIdAndUpdate(
      id,
      mongoUpdate,
      { new: true, runValidators: true }
    );
    if (!updatedExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    return NextResponse.json(updatedExpense);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    if (isMockMode) {
      const data = getMockData();
      const idx = data.expenses.findIndex((e: any) => e._id === id);
      if (idx === -1) {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
      }
      data.expenses.splice(idx, 1);
      saveMockData(data);
      return NextResponse.json({ message: 'Expense deleted successfully' });
    }
    await dbConnect();
    const deletedExpense = await Expense.findByIdAndDelete(id);
    if (!deletedExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Expense deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
