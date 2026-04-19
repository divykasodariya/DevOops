import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const { Schema, model } = mongoose;

const ROLES = ['student', 'faculty', 'hod', 'principal', 'admin', 'support', 'club'];

const userSchema = new Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role:     { type: String, enum: ROLES, required: true },

    rollNumber: String,   
    employeeId: String,   

    department: { type: Schema.Types.ObjectId, ref: 'Department' },

    dashboardConfig: {
      widgets: [
        {
          widgetId:  String,
          position:  { row: Number, col: Number },
          enabled:   { type: Boolean, default: true },
        },
      ],
    },

    fcmTokens: [String],

    copilotContext: {
      recentTopics:    [String],
      pendingActionIds: [{ type: Schema.Types.ObjectId, ref: 'ApprovalRequest' }],
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.index({ role: 1, department: 1 });

export const User = model('User', userSchema);
export default User;
