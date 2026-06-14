import { NextResponse } from 'next/server';
import dbConnect, { isMockMode, getMockData, saveMockData } from '@/lib/mongodb';
import PushSubscription from '@/models/PushSubscription';
import { isPushConfigured } from '@/lib/webpush';

// Lets the client know whether push is configured on the server.
export async function GET() {
  return NextResponse.json({
    configured: isPushConfigured,
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
  });
}

// Save (upsert) a browser push subscription.
export async function POST(request: Request) {
  try {
    const sub = await request.json();
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const record = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    };

    if (isMockMode) {
      const data = getMockData();
      if (!data.pushSubscriptions) data.pushSubscriptions = [];
      const idx = data.pushSubscriptions.findIndex((s: any) => s.endpoint === record.endpoint);
      if (idx === -1) data.pushSubscriptions.push({ ...record, createdAt: new Date().toISOString() });
      else data.pushSubscriptions[idx] = { ...data.pushSubscriptions[idx], ...record };
      saveMockData(data);
      return NextResponse.json({ success: true });
    }

    await dbConnect();
    await PushSubscription.findOneAndUpdate(
      { endpoint: record.endpoint },
      record,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Remove a subscription (when the user turns reminders off).
export async function DELETE(request: Request) {
  try {
    const { endpoint } = await request.json();
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }

    if (isMockMode) {
      const data = getMockData();
      data.pushSubscriptions = (data.pushSubscriptions || []).filter((s: any) => s.endpoint !== endpoint);
      saveMockData(data);
      return NextResponse.json({ success: true });
    }

    await dbConnect();
    await PushSubscription.deleteOne({ endpoint });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
