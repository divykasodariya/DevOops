import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/User.js';
import { Payment } from './models/Payment.js';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campus_erp');
    console.log('Connected to MongoDB');

    let user = await User.findOne({ email: 'dskolpe7@gmail.com' });
    if (!user) {
      user = new User({
        name: 'Divy Skolpe',
        email: 'dskolpe7@gmail.com',
        password: '123',
        role: 'student',
        rollNumber: 'CS2026-001',
      });
      await user.save();
      console.log('User created:', user._id);
    } else {
      user.password = '123';
      await user.save();
      console.log('User password updated:', user._id);
    }

    // Add pending payments
    const payments = [
      {
        paidBy: user._id,
        type: 'fee',
        amount: 50000,
        description: 'Semester 4 Tuition Fee',
        status: 'pending',
      },
      {
        paidBy: user._id,
        type: 'library_fine',
        amount: 250,
        description: 'Late book return (Data Structures)',
        status: 'pending',
      },
      {
        paidBy: user._id,
        type: 'lab_due',
        amount: 1500,
        description: 'Broken equipment fine in Chemistry Lab',
        status: 'pending',
      }
    ];

    for (const p of payments) {
      const existing = await Payment.findOne({ paidBy: p.paidBy, description: p.description });
      if (!existing) {
        await Payment.create(p);
        console.log('Created payment:', p.description);
      }
    }

    console.log('Seed completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
};

run();
