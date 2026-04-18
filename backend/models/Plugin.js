import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const pluginSchema = new Schema(
  {
    name:        { type: String, required: true, unique: true },
    slug:        { type: String, required: true, unique: true },
    description: String,
    version:     { type: String, default: '1.0.0' },

    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    manifest: {
      entryUrl:    String,
      permissions: [String],
      webhookUrl:  String,
    },

    isApproved:   { type: Boolean, default: false },
    isActive:     { type: Boolean, default: false },
    installCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Plugin = model('Plugin', pluginSchema);
