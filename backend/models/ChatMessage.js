import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const chatMessageSchema = new Schema(
  {
    user:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: String, required: true },
    role:      { type: String, enum: ['user', 'assistant'], required: true },
    content:   { type: String, required: true },
    inputMode: { type: String, enum: ['text', 'voice'], default: 'text' },

    citations: [
      {
        refModel: { type: String, enum: ['ApprovalRequest', 'Schedule', 'Issue', 'Payment'] },
        refId:    Schema.Types.ObjectId,
        summary:  String,
      },
    ],
  },
  { timestamps: true }
);

chatMessageSchema.index({ user: 1, sessionId: 1, createdAt: 1 });

export const ChatMessage = model('ChatMessage', chatMessageSchema);
