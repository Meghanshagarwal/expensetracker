import mongoose, { Schema, model, models } from "mongoose";

const CardSchema = new Schema({
  name: {
    type: String,
    required: [true, "Card name is required."],
    trim: true,
    unique: true
  },
  cardNetwork: {
    type: String,
    required: [true, "Card network is required."],
    enum: ["Rupay", "Visa", "Mastercard"],
  },
  last4: {
    type: String,
    required: [true, "Last 4 digits are required."],
    minlength: 4,
    maxlength: 4
  },
  colorTheme: {
    type: String,
    default: "charcoal",
  },
  statementDate: {
    type: Number,
    min: [1, "Statement date must be between 1 and 31."],
    max: [31, "Statement date must be between 1 and 31."],
  },
  dueDate: {
    type: Number,
    min: [1, "Due date must be between 1 and 31."],
    max: [31, "Due date must be between 1 and 31."],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

export default models.Card || model("Card", CardSchema);
