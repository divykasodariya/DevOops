import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['leave', 'room', 'event', 'certificate', 'lor', 'research'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  targetRole: {
    type: String,
    enum: ['professor', 'admin'],
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  stage: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'in_review'],
    default: 'pending'
  },
  priority: { type: String, enum: ['low','medium','high'], default: 'medium' },
  attachments: [{ url: String, label: String }],
  approvalChain: [{
    role: { type: String, enum: ['professor','hod','principal','admin'] },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' }
  }],
  metadata: {
    tags: [String],
    dates: [Date],
    department: String
  }
}, { timestamps: true });

const Request = mongoose.model('Request', requestSchema);
export default Request;
