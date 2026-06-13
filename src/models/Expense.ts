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
    enum: [
      "Petrol",
      "Food",
      "Tea/Coffee",
      "Travel",
      "Shopping",
      "Bills",
      "Entertainment",
      "Education",
      "Medical",
      "Family",
      "Other",
    ],
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
    enum: ["Car", "Jupiter 125", "Maestro Edge"],
  },
  sourceAccount: {
    type: String,
    enum: ["Salary Account", "Self Account"],
    default: "Self Account",
  },
  upiApp: {
    type: String,
    enum: ["GPay", "Amazon Pay", "Cred UPI"],
  },
  upiLinkedAccount: {
    type: String,
    enum: ["ICICI Credit Card", "Yes Bank"],
  },
  creditCardIssuer: {
    type: String,
    enum: ["ICICI", "Yes Bank", "OneCard"],
  },
});

export default models.Expense || model("Expense", ExpenseSchema);
