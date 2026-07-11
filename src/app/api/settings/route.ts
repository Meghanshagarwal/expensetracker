import { NextResponse } from 'next/server';
import dbConnect, { isMockMode, getMockData, saveMockData } from '@/lib/mongodb';
import Settings from '@/models/Settings';

const DEFAULT_SETTINGS = {
  categories: [
    "Petrol", "Food", "Tea/Coffee", "Travel", "Shopping", 
    "Bills", "Entertainment", "Education", "Medical", "Family", "Other"
  ],
  upiApps: ["GPay", "Amazon Pay", "Cred UPI"],
  sourceAccounts: ["Self Account", "Salary Account"],
  vehicles: ["Car", "Jupiter 125", "Maestro Edge"]
};

export async function GET() {
  try {
    if (isMockMode) {
      const data = getMockData();
      if (!data.settings) {
        data.settings = DEFAULT_SETTINGS;
        saveMockData(data);
      }
      return NextResponse.json(data.settings);
    }
    await dbConnect();
    let settings = await Settings.findOne({ key: 'app_settings' });
    if (!settings) {
      settings = await Settings.create({ key: 'app_settings', ...DEFAULT_SETTINGS });
    }
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { categories, upiApps, sourceAccounts, vehicles } = body;

    const updatePayload = {
      categories: Array.isArray(categories) ? categories.filter(Boolean).map((s: string) => s.trim()) : undefined,
      upiApps: Array.isArray(upiApps) ? upiApps.filter(Boolean).map((s: string) => s.trim()) : undefined,
      sourceAccounts: Array.isArray(sourceAccounts) ? sourceAccounts.filter(Boolean).map((s: string) => s.trim()) : undefined,
      vehicles: Array.isArray(vehicles) ? vehicles.filter(Boolean).map((s: string) => s.trim()) : undefined,
    };

    // Clean undefined fields
    Object.keys(updatePayload).forEach(key => {
      if ((updatePayload as any)[key] === undefined) {
        delete (updatePayload as any)[key];
      }
    });

    if (isMockMode) {
      const data = getMockData();
      data.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}), ...updatePayload };
      saveMockData(data);
      return NextResponse.json(data.settings);
    }

    await dbConnect();
    const settings = await Settings.findOneAndUpdate(
      { key: 'app_settings' },
      { $set: updatePayload },
      { new: true, upsert: true, runValidators: true }
    );
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
