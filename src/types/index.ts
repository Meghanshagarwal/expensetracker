export interface Person {
  _id: string;
  name: string;
  createdAt: string;
}

export interface Expense {
  _id: string;
  title: string;
  amount: number;
  category: string;
  personId: string; // references Person
  paymentMethod: string;
  date: string;
  notes?: string;
  createdAt: string;
  isPendingSync?: boolean; // For PWA offline queue tracking

  // Conditional Fields
  vehicle?: string;           // For Petrol: 'Car', 'Jupiter 125', 'Maestro Edge'
  sourceAccount?: string;     // 'Salary Account', 'Self Account'
  upiApp?: string;            // For UPI: 'GPay', 'Amazon Pay', 'Cred UPI'
  upiLinkedAccount?: string;  // For UPI Linked: 'ICICI Credit Card', 'Yes Bank'
  creditCardIssuer?: string;  // For Credit Card: 'ICICI', 'Yes Bank', 'OneCard'
}

export interface DashboardStats {
  totalMonth: number;
  totalYear: number;
  today: number;
  avgDaily: number;
  petrolExpenses: number;
  foodExpenses: number;
  travelExpenses: number;
  thisMonthExpenses: number;
  lastMonthExpenses: number;
  highestExpense: {
    title: string;
    amount: number;
    date: string;
  } | null;
}

export interface CategoryData {
  name: string;
  value: number;
}

export interface MonthlyTrendData {
  name: string;
  amount: number;
}

export interface SpendingByPersonData {
  name: string;
  amount: number;
}

export interface PaymentDistributionData {
  name: string;
  value: number;
}
