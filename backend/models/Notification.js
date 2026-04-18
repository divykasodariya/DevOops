import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['request_update', 'announcement', 'reminder'], required: true },
  title: { type: String, required: true },
  body: { type: String },
  refModel: { type: String, enum: ['Request', 'User'] },
  refId: { type: mongoose.Schema.Types.ObjectId },
  read: { type: Boolean, default: false }
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
