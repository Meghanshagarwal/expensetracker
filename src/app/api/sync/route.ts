import { NextResponse } from 'next/server';
import dbConnect, { isMockMode, getMockData, saveMockData } from '@/lib/mongodb';
import Person from '@/models/Person';
import Expense from '@/models/Expense';

export async function POST(request: Request) {
  try {
    const { items } = await request.json();

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    if (isMockMode) {
      const data = getMockData();
      const personIdMap = new Map<string, string>();

      for (const item of items) {
        if (item.type === 'person') {
          const { action, data: pData, tempId } = item;
          if (action === 'create') {
            let existingPerson = data.persons.find((p: any) => p.name === pData.name);
            if (!existingPerson) {
              existingPerson = {
                _id: `mock_per_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                name: pData.name.trim(),
                createdAt: new Date().toISOString()
              };
              data.persons.push(existingPerson);
            }
            personIdMap.set(tempId, existingPerson._id);
          } else if (action === 'update') {
            const id = pData._id.startsWith('temp_') ? personIdMap.get(pData._id) : pData._id;
            const idx = data.persons.findIndex((p: any) => p._id === id);
            if (idx !== -1) {
              data.persons[idx].name = pData.name.trim();
            }
          }
        }
      }

      for (const item of items) {
        if (item.type === 'expense') {
          const { action, data: eData } = item;

          let resolvedPersonId = eData.personId;
          if (eData.personId.startsWith('temp_')) {
            resolvedPersonId = personIdMap.get(eData.personId);
            if (!resolvedPersonId) {
              let defaultPerson = data.persons.find((p: any) => p.name === 'Self');
              if (!defaultPerson) {
                defaultPerson = {
                  _id: `mock_per_${Date.now()}`,
                  name: 'Self',
                  createdAt: new Date().toISOString()
                };
                data.persons.push(defaultPerson);
              }
              resolvedPersonId = defaultPerson._id;
            }
          }

          if (action === 'create') {
            const { _id, isPendingSync, personId, ...expenseToCreate } = eData;
            data.expenses.push({
              _id: `mock_exp_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              ...expenseToCreate,
              personId: resolvedPersonId,
              createdAt: new Date().toISOString()
            });
          } else if (action === 'update') {
            const { _id, isPendingSync, personId, ...expenseToUpdate } = eData;
            const idx = data.expenses.findIndex((e: any) => e._id === _id);
            if (idx !== -1) {
              data.expenses[idx] = {
                ...data.expenses[idx],
                ...expenseToUpdate,
                personId: resolvedPersonId
              };
            }
          } else if (action === 'delete') {
            const idx = data.expenses.findIndex((e: any) => e._id === eData._id);
            if (idx !== -1) {
              data.expenses.splice(idx, 1);
            }
          }
        }
      }

      saveMockData(data);
      return NextResponse.json({ success: true });
    }

    await dbConnect();
    const personIdMap = new Map<string, string>();

    for (const item of items) {
      if (item.type === 'person') {
        const { action, data: pData, tempId } = item;

        if (action === 'create') {
          let existingPerson = await Person.findOne({ name: pData.name });
          if (!existingPerson) {
            existingPerson = await Person.create({ name: pData.name });
          }
          personIdMap.set(tempId, existingPerson._id.toString());
        } else if (action === 'update') {
          const id = pData._id.startsWith('temp_') ? personIdMap.get(pData._id) : pData._id;
          if (id) {
            await Person.findByIdAndUpdate(id, { name: pData.name });
          }
        }
      }
    }

    for (const item of items) {
      if (item.type === 'expense') {
        const { action, data: eData } = item;

        let resolvedPersonId = eData.personId;
        if (eData.personId.startsWith('temp_')) {
          resolvedPersonId = personIdMap.get(eData.personId);
          if (!resolvedPersonId) {
            let defaultPerson = await Person.findOne({ name: 'Self' });
            if (!defaultPerson) {
              defaultPerson = await Person.create({ name: 'Self' });
            }
            resolvedPersonId = defaultPerson._id.toString();
          }
        }

        if (action === 'create') {
          const { _id, isPendingSync, personId, ...expenseToCreate } = eData;
          await Expense.create({
            ...expenseToCreate,
            personId: resolvedPersonId,
          });
        } else if (action === 'update') {
          const { _id, isPendingSync, personId, ...expenseToUpdate } = eData;
          await Expense.findByIdAndUpdate(_id, {
            ...expenseToUpdate,
            personId: resolvedPersonId,
          });
        } else if (action === 'delete') {
          await Expense.findByIdAndDelete(eData._id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
