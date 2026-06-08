import mongoose, { Schema, model, models } from "mongoose";

const PersonSchema = new Schema({
  name: {
    type: String,
    required: [true, "Please provide a name for the person."],
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default models.Person || model("Person", PersonSchema);
