import { Schema, model, models } from "mongoose";

const ContributionSchema = new Schema({
  from: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  returnDate: { type: Date },
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
  // Listing date — used when status is "Allotted"
  listingDate: {
    type: Date,
  },
  // Profit/loss booked on listing — used when status is "Allotted" (can be negative)
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
