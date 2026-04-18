import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true }, // e.g. "CSE", "MECH"
    hod: { type: Schema.Types.ObjectId, ref: 'User' },
    principal: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Department = model('Department', departmentSchema);
