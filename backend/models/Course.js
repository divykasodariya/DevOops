import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const courseSchema = new Schema(
  {
    code:              { type: String, required: true, unique: true },
    name:              { type: String, required: true },
    department:        { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    faculty:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
    semester:          Number,
    enrolledStudents:  [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export const Course = model('Course', courseSchema);
