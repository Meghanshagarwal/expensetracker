import mongoose, { Schema, model, models } from "mongoose";

const ExpenseSchema = new Schema({
  title: {
    type: String,
    required: [true, "Please provide an expense title."],
    trim: true,
  },
  amount: {
    type: Number,
    required: [true, "Please provide an expense amount."],
    min: [0, "Amount cannot be negative."],
  },
  category: {
    type: String,
    required: [true, "Please specify a category."],
  },
  transactionType: {
    type: String,
    enum: ["expense", "lent", "borrowed", "received", "repaid"],
    default: "expense",
  },
  personId: {
    type: Schema.Types.ObjectId,
    ref: "Person",
    required: [true, "Please assign this expense to a person."],
    index: true,
  },
  paymentMethod: {
    type: String,
    required: [true, "Please select a payment method."],
    enum: ["Cash", "UPI", "Debit Card", "Credit Card"],
  },
  date: {
    type: Date,
    required: [true, "Please select the expense date."],
    default: Date.now,
    index: true,
  },
  notes: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // Conditional Fields
  vehicle: {
    type: String,
  },
  sourceAccount: {
    type: String,
    default: "Self Account",
  },
  upiApp: {
    type: String,
  },
  // Driven dynamically by the user's saved cards (RuPay cards linked to UPI)
  upiLinkedAccount: {
    type: String,
  },
  // Driven dynamically by the user's saved cards (Visa / Mastercard)
  creditCardIssuer: {
    type: String,
  },
  isCardPaid: {
    type: Boolean,
    default: false,
  },
  cardPaidDate: {
    type: Date,
  },
  cardPaidFrom: {
    type: String,
  },
  litres: {
    type: Number,
  },
  petrolPrice: {
    type: Number,
  },
  km: {
    type: Number,
  },
  mileage: {
    type: Number,
  },
  repayments: [
    {
      amount: { type: Number, required: true },
      paymentMethod: { type: String, required: true, enum: ['Cash', 'UPI'] },
      upiApp: { type: String, enum: ['GPay', 'Amazon Pay', 'Cred UPI'] },
      date: { type: Date, required: true, default: Date.now },
      notes: { type: String, trim: true }
    }
  ],
}, { timestamps: true });

export default models.Expense || model("Expense", ExpenseSchema);
