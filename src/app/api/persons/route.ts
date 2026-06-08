import { NextResponse } from 'next/server';
import dbConnect, { isMockMode, getMockData, saveMockData } from '@/lib/mongodb';
import Person from '@/models/Person';
import Expense from '@/models/Expense';

export async function GET() {
  try {
    if (isMockMode) {
      const { persons } = getMockData();
      const sorted = [...persons].sort((a: any, b: any) => a.name.localeCompare(b.name));
      return NextResponse.json(sorted);
    }
    await dbConnect();
    const persons = await Person.find({}).sort({ name: 1 });
    return NextResponse.json(persons);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (isMockMode) {
      const data = getMockData();
      const newPerson = {
        _id: `mock_per_${Date.now()}`,
        name: name.trim(),
        createdAt: new Date().toISOString()
      };
      data.persons.push(newPerson);
      saveMockData(data);
      return NextResponse.json(newPerson, { status: 201 });
    }
    await dbConnect();
    const newPerson = await Person.create({ name });
    return NextResponse.json(newPerson, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name } = await request.json();
    if (!id || !name) {
      return NextResponse.json({ error: 'ID and Name are required' }, { status: 400 });
    }
    if (isMockMode) {
      const data = getMockData();
      const idx = data.persons.findIndex((p: any) => p._id === id);
      if (idx === -1) {
        return NextResponse.json({ error: 'Person not found' }, { status: 404 });
      }
      data.persons[idx].name = name.trim();
      saveMockData(data);
      return NextResponse.json(data.persons[idx]);
    }
    await dbConnect();
    const updatedPerson = await Person.findByIdAndUpdate(
      id,
      { name },
      { new: true, runValidators: true }
    );
    if (!updatedPerson) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }
    return NextResponse.json(updatedPerson);
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
      
      const referenceCount = data.expenses.filter((e: any) => e.personId === id).length;
      if (referenceCount > 0) {
        return NextResponse.json({ 
          error: 'Cannot delete person: they have associated expenses. Please delete their expenses first.' 
        }, { status: 400 });
      }

      const idx = data.persons.findIndex((p: any) => p._id === id);
      if (idx === -1) {
        return NextResponse.json({ error: 'Person not found' }, { status: 404 });
      }
      data.persons.splice(idx, 1);
      saveMockData(data);
      return NextResponse.json({ message: 'Person deleted successfully' });
    }

    await dbConnect();
    const referenceCount = await Expense.countDocuments({ personId: id });
    if (referenceCount > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete person: they have associated expenses. Please delete their expenses first.' 
      }, { status: 400 });
    }

    const deletedPerson = await Person.findByIdAndDelete(id);
    if (!deletedPerson) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Person deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
