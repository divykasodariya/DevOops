import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const ROLES = ['student', 'faculty', 'hod', 'principal', 'admin', 'support', 'club'];
const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'escalated'];

const approvalStepSchema = new Schema(
  {
    order:    { type: Number, required: true },  // 1 = first to approve
    approver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role:     { type: String, enum: ROLES },     // snapshot of approver's role at creation time
    status:   { type: String, enum: APPROVAL_STATUSES, default: 'pending' },
    remarks:  String,
    actionAt: Date,
    signature: { type: String, select: false },  // base64 / hash for digital auth
  },
  { _id: false }
);

const approvalRequestSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['leave', 'room', 'event', 'certificate', 'lor', 'research',
             'od', 'lab_access', 'event_permission', 'custom'],
      required: true,
    },
    title:       { type: String, required: true },
    description: String,

    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department:  { type: Schema.Types.ObjectId, ref: 'Department' },

    steps:        [approvalStepSchema],
    currentStep:  { type: Number, default: 0 },
    overallStatus: { type: String, enum: APPROVAL_STATUSES, default: 'pending' },

    meta: { type: Schema.Types.Mixed },

    attachments: [
      {
        fileName: { type: String, required: true },
        url:      { type: String, required: true },
        mimeType: String,
        size:     Number,
      },
    ],

    generatedDocument: {
      url:         String,
      generatedAt: Date,
    },

    relatedSchedule: { type: Schema.Types.ObjectId, ref: 'Schedule' },

    expiresAt: Date,
  },
  { timestamps: true }
);

approvalRequestSchema.index({ requestedBy: 1, overallStatus: 1 });
approvalRequestSchema.index({ 'steps.approver': 1, overallStatus: 1 }); 

export default model('ApprovalRequest', approvalRequestSchema);
