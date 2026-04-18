import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const attendanceSchema = new Schema(
  {
    course:   { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    date:     { type: Date, required: true },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    records: [
      {
        student: { type: Schema.Types.ObjectId, ref: 'User' },
        status:  { type: String, enum: ['present', 'absent', 'late', 'od'], default: 'absent' },
      },
    ],

    totalPresent:  Number,
    totalAbsent:   Number,
    totalEnrolled: Number,
  },
  { timestamps: true }
);

attendanceSchema.index({ course: 1, date: -1 });

export const Attendance = model('Attendance', attendanceSchema);
