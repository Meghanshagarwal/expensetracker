import { Schema, model, models } from "mongoose";

const RepaymentSchema = new Schema({
  amount: { type: Number, required: true, min: 0.01 },
  date: { type: Date, required: true },
}, { _id: false });

const ContributionSchema = new Schema({
  from: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  returnAmount: { type: Number, min: 0 },
  returnDate: { type: Date },
  repayments: { type: [RepaymentSchema], default: undefined },
});

const IpoSchema = new Schema({
  ipoName: {
    type: String,
    required: [true, "IPO name is required."],
    trim: true,
  },
  lots: {
    type: Number,
    default: 1,
    min: 1,
  },
  amount: {
    type: Number,
    required: [true, "Application amount is required."],
    min: 0,
  },
  appliedFrom: {
    type: String,
    default: "Me",
    trim: true,
  },
  status: {
    type: String,
    enum: ["Applied", "Allotted", "Not Allotted"],
    default: "Applied",
  },
  applyDate: {
    type: Date,
    default: Date.now,
  },
  // Stored as free-text (source format varies, e.g. "12-Sep-2026") rather than Date
  openDate: {
    type: String,
    trim: true,
  },
  closeDate: {
    type: String,
    trim: true,
  },
  allotmentDate: { type: Date },
  contributions: {
    type: [ContributionSchema],
    default: [],
  },
  // Refund amount — used when status is "Not Allotted"
  returnAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  returnDate: {
    type: Date,
  },
  // Keep the scheduled listing date while the application is pending.
  listingDate: {
    type: Date,
  },
  withdrawnAmount: { type: Number, min: 0 },
  // Difference between the withdrawal and application amount.
  profitAmount: {
    type: Number,
    default: 0,
  },
  notes: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default models.Ipo || model("Ipo", IpoSchema);
