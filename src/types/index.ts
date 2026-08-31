export interface Person {
  _id: string;
  name: string;
  createdAt: string;
}

export interface Repayment {
  _id?: string;
  amount: number;
  paymentMethod: 'Cash' | 'UPI';
  upiApp?: 'GPay' | 'Amazon Pay' | 'Cred UPI';
  date: string;
  notes?: string;
}

export interface Expense {
  _id: string;
  title: string;
  amount: number;
  category: string;
  transactionType?: 'expense' | 'lent' | 'borrowed' | 'received' | 'repaid';
  personId: string; // references Person
  paymentMethod: string;
  date: string;
  notes?: string;
  createdAt: string;
  isPendingSync?: boolean; // For PWA offline queue tracking
  repayments?: Repayment[];

  // Conditional Fields
  vehicle?: string;           // For Petrol: 'Car', 'Jupiter 125', 'Maestro Edge'
  sourceAccount?: string;     // 'Salary Account', 'Self Account'
  upiApp?: string;            // For UPI: 'GPay', 'Amazon Pay', 'Cred UPI'
  upiLinkedAccount?: string;  // For UPI Linked: 'ICICI Credit Card', 'Yes Bank'
  creditCardIssuer?: string;  // For Credit Card: 'ICICI', 'Yes Bank', 'OneCard'
  isCardPaid?: boolean;
  cardPaidDate?: string;
  cardPaidFrom?: string;
  litres?: number;
  petrolPrice?: number;
  km?: number;
  mileage?: number;
}

export interface IpoContribution {
  _id?: string;
  from: string;         // Whose money — 'Me' | 'Mummy' | 'Papa' | custom
  amount: number;       // Amount taken from that person
  date: string;         // Date the amount was taken
  returnDate?: string;  // Date the money was / will be returned to them
}

export interface Ipo {
  _id: string;
  ipoName: string;
  lots: number;                      // Number of lots applied (default 1)
  amount: number;                    // Total application amount = lots × per-lot (editable)
  appliedFrom: string;               // Applied from account/person — 'Me' | 'Mummy' | 'Papa' | custom
  status: 'Applied' | 'Allotted' | 'Not Allotted';
  applyDate: string;                 // Date of application
  openDate?: string;                 // IPO subscription open date
  closeDate?: string;                // IPO subscription close date
  contributions: IpoContribution[];  // Money taken from people
  returnAmount: number;              // Refund amount — used when status is 'Not Allotted'
  returnDate?: string;               // Date the refund was / will be credited back
  listingDate?: string;              // Listing date — used when status is 'Allotted'
  profitAmount: number;              // Profit/loss booked on listing — used when status is 'Allotted'
  notes?: string;
  createdAt: string;
  isPendingSync?: boolean;
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
  totalReceivable: number;
  totalPayable: number;
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

export interface Card {
  _id: string;
  name: string;
  cardNetwork: 'Rupay' | 'Visa' | 'Mastercard';
  last4: string;
  colorTheme?: string;
  statementDate?: number; // day of month (1-31) the statement is generated
  dueDate?: number;       // day of month (1-31) the payment is due
  createdAt: string;
  isPendingSync?: boolean;
}
