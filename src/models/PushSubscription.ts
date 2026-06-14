import mongoose, { Schema, model, models } from "mongoose";

const PushSubscriptionSchema = new Schema({
  endpoint: {
    type: String,
    required: true,
    unique: true,
  },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default models.PushSubscription || model("PushSubscription", PushSubscriptionSchema);
