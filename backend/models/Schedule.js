import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const scheduleSchema = new Schema(
  {
    title:      { type: String, required: true },
    type: {
      type: String,
      enum: ['class', 'exam', 'event', 'room_booking', 'club'],
      required: true,
    },

    course:     { type: Schema.Types.ObjectId, ref: 'Course' },  // null for non-class types
    room:       String,   // e.g. "LH-301" — used for clash detection
    location:   String,   // free-text fallback for outdoor / off-campus events
    department: { type: Schema.Types.ObjectId, ref: 'Department' },

    start: { type: Date, required: true },
    end:   { type: Date, required: true },

    audience:    { type: String, enum: ['all', 'department', 'course', 'user'], default: 'course' },
    audienceIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    clashChecked:   { type: Boolean, default: false },
    clashConflicts: [
      {
        conflictingScheduleId: { type: Schema.Types.ObjectId, ref: 'Schedule' },
        reason: String, // "same room" | "faculty overlap" | "student overlap"
      },
    ],

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isActive:  { type: Boolean, default: true },
  },
  { timestamps: true }
);

scheduleSchema.index({ start: 1, end: 1, room: 1 });
scheduleSchema.index({ audienceIds: 1 });

export const Schedule = model('Schedule', scheduleSchema);
