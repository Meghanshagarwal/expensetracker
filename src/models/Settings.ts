import { Schema, model, models } from "mongoose";

const SettingsSchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: "app_settings",
  },
  categories: {
    type: [String],
    default: [
      "Petrol", "Food", "Tea/Coffee", "Travel", "Shopping", 
      "Bills", "Entertainment", "Education", "Medical", "Family", "Other"
    ],
  },
  upiApps: {
    type: [String],
    default: ["GPay", "Amazon Pay", "Cred UPI"],
  },
  sourceAccounts: {
    type: [String],
    default: ["Self Account", "Salary Account"],
  },
  vehicles: {
    type: [String],
    default: ["Car", "Jupiter 125", "Maestro Edge"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default models.Settings || model("Settings", SettingsSchema);
