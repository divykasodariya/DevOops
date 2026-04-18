import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const issueSchema = new Schema(
  {
    title:       { type: String, required: true },
    description: String,
    category: {
      type: String,
      enum: ['it', 'facility', 'electrical', 'plumbing', 'safety', 'other'],
      required: true,
    },
    location:  { type: String, required: true },
    geoCoords: { lat: Number, lng: Number },

    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    attachments: [
      {
        url:        String,    // CDN / pre-signed S3 URL
        mimeType:   String,
        uploadedAt: Date,
      },
    ],

    status:     { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
    priority:   { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },

    timeline: [
      {
        status:    { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'] },
        note:      String,
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        at:        { type: Date, default: Date.now },
      },
    ],

    resolvedAt: Date,
  },
  { timestamps: true }
);

issueSchema.index({ status: 1, category: 1, priority: -1 });
issueSchema.index({ location: 1, category: 1 }); // heatmap aggregation

export const Issue = model('Issue', issueSchema);
