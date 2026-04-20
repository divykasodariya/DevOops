import mongoose from 'mongoose';
import { Payment } from '../models/Payment.js';
import User from '../models/User.js';
import { Notification } from '../models/Notification.js';

const HEX24 = /^[a-f0-9]{24}$/i;

const escapeRe = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeName = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/**
 * Resolve a student/club user from admin input: Mongo _id, email, or roll number.
 */
const resolveStudentByIdentifier = async (studentIdRaw) => {
  const s = String(studentIdRaw || '').trim();
  if (!s) return null;

  const roleFilter = { role: { $in: ['student', 'club'] } };

  if (HEX24.test(s) && mongoose.Types.ObjectId.isValid(s)) {
    const byId = await User.findOne({ _id: s, ...roleFilter });
    if (byId) return byId;
  }

  if (s.includes('@')) {
    const byEmail = await User.findOne({
      email: s.toLowerCase(),
      ...roleFilter,
    });
    if (byEmail) return byEmail;
  }

  return User.findOne({
    rollNumber: new RegExp(`^${escapeRe(s)}$`, 'i'),
    ...roleFilter,
  });
};

/**
 * POST /fines
 * Body: { studentName, studentId, amount, reason }
 * studentId: 24-char user id, email, or roll number (e.g. CS2026-001)
 */
export const imposeFine = async (req, res) => {
  try {
    const { studentName, studentId, amount, reason } = req.body || {};

    const nameTrim = String(studentName || '').trim();
    const idTrim = String(studentId || '').trim();
    const reasonTrim = String(reason || '').trim();
    const amt = Number(amount);

    if (!nameTrim || !idTrim || !reasonTrim) {
      return res.status(400).json({
        message: 'studentName, studentId, and reason are required.',
      });
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: 'amount must be a number greater than 0.' });
    }

    const student = await resolveStudentByIdentifier(idTrim);
    if (!student) {
      return res.status(404).json({
        message: 'No student or club account found for that ID (try roll number, email, or user id).',
      });
    }

    if (normalizeName(nameTrim) !== normalizeName(student.name)) {
      return res.status(400).json({
        message: 'Student name does not match the account for this ID.',
      });
    }

    const payment = await Payment.create({
      paidBy: student._id,
      type: 'other',
      amount: Math.round(amt * 100) / 100,
      currency: 'INR',
      description: `Admin fine: ${reasonTrim}`,
      status: 'pending',
    });

    await Notification.create({
      recipient: student._id,
      title: 'Fine / charge added',
      body: `An amount of ₹${payment.amount} was added to your account: ${reasonTrim}.`,
      type: 'announcement',
      refModel: 'Payment',
      refId: payment._id,
    });

    res.status(201).json({
      _id: payment._id,
      paidBy: student._id.toString(),
      studentName: student.name,
      amount: payment.amount,
      currency: payment.currency,
      description: payment.description,
      status: payment.status,
      type: payment.type,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
