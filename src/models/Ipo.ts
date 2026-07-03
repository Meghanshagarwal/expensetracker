import { Schema, model, models } from "mongoose";

const ContributionSchema = new Schema({
  from: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
});

const IpoSchema = new Schema({
  ipoName: {
    type: String,
    required: [true, "IPO name is required."],
    trim: true,
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
  contributions: {
    type: [ContributionSchema],
    default: [],
  },
  returnAmount: {
    type: Number,
    default: 0,
    min: 0,
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
