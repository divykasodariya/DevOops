import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const paymentSchema = new Schema(
  {
    paidBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type:     { type: String, enum: ['library_fine', 'canteen_bill', 'lab_due', 'fee', 'other'], required: true },
    amount:   { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    description: String,

    gateway:         { type: String, enum: ['upi', 'card', 'netbanking', 'wallet'] },
    gatewayTxnId:    { type: String, unique: true, sparse: true },
    gatewayResponse: { type: Schema.Types.Mixed, select: false }, // never expose to client

    status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending' },
    paidAt: Date,

    receipt: {
      url:         String,
      generatedAt: Date,
    },

    refModel: String,
    refId:    { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

paymentSchema.index({ paidBy: 1, status: 1 });
paymentSchema.index({ type: 1, createdAt: -1 });

export const Payment = model('Payment', paymentSchema);
