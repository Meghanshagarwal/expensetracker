import mongoose from "mongoose";
import fs from "fs";
import path from "path";

const MONGODB_URI = process.env.MONGODB_URI;

export const isMockMode = !MONGODB_URI;

const MOCK_FILE_PATH = path.join(process.cwd(), 'db-mock.json');

export function getMockData() {
  if (!fs.existsSync(MOCK_FILE_PATH)) {
    const defaultData = {
      expenses: [
        {
          _id: "mock_exp_1",
          title: "Petrol Refuel",
          amount: 1500,
          category: "Petrol",
          personId: "mock_per_1",
          paymentMethod: "UPI",
          date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          notes: "Full tank",
          createdAt: new Date().toISOString()
        },
        {
          _id: "mock_exp_2",
          title: "Dinner with Team",
          amount: 3200,
          category: "Food",
          personId: "mock_per_2",
          paymentMethod: "Credit Card",
          date: new Date().toISOString(),
          notes: "Barbeque Nation",
          createdAt: new Date().toISOString()
        },
        {
          _id: "mock_exp_3",
          title: "Office Commute",
          amount: 450,
          category: "Travel",
          personId: "mock_per_1",
          paymentMethod: "Cash",
          date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
          notes: "Uber ride",
          createdAt: new Date().toISOString()
        }
      ],
      persons: [
        { _id: "mock_per_1", name: "Self", createdAt: new Date().toISOString() },
        { _id: "mock_per_2", name: "Office Colleague", createdAt: new Date().toISOString() },
        { _id: "mock_per_3", name: "Family", createdAt: new Date().toISOString() }
      ]
    };
    fs.writeFileSync(MOCK_FILE_PATH, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  return JSON.parse(fs.readFileSync(MOCK_FILE_PATH, 'utf-8'));
}

export function saveMockData(data: any) {
  fs.writeFileSync(MOCK_FILE_PATH, JSON.stringify(data, null, 2));
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (isMockMode) {
    console.warn("⚠️ MONGODB_URI is not set. Running in Local Mock-JSON Database Mode.");
    return null;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
