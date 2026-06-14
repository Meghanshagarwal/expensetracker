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
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

export default models.Card || model("Card", CardSchema);
