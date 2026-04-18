import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title:     { type: String, required: true },
    body:      String,
    type: {
      type: String,
      enum: ['approval_action', 'schedule_alert', 'issue_update',
             'payment_receipt', 'announcement', 'copilot_reminder'],
    },

    refModel: { type: String, enum: ['ApprovalRequest', 'Schedule', 'Issue', 'Payment'] },
    refId:    { type: Schema.Types.ObjectId },
    attachments: [
      {
        fileName: { type: String, required: true },
        url: { type: String, required: true },
        mimeType: { type: String },
        size: { type: Number },
      },
    ],

    isRead:     { type: Boolean, default: false },
    readAt:     Date,

    pushSent:   { type: Boolean, default: false },
    pushSentAt: Date,
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const Notification = model('Notification', notificationSchema);
