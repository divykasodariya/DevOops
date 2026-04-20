import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/User.js';
import { Payment } from './models/Payment.js';
import { Course } from './models/Course.js';
import { Department } from './models/Department.js';

dotenv.config();

/** Core CS curriculum courses (DAA, CCN, OS) for attendance / schedules. */
const seedCurriculumCourses = async (studentUser) => {
  let dept = await Department.findOne({ code: 'CSE' });
  if (!dept) {
    dept = await Department.create({
      name: 'Computer Science & Engineering',
      code: 'CSE',
    });
    console.log('Created department:', dept.code);
  }

  let faculty = await User.findOne({ role: 'faculty' });
  if (!faculty) {
    faculty = await User.create({
      name: 'Dr. Ananya Rao',
      email: 'faculty.cse.campus@example.com',
      password: '123',
      role: 'faculty',
      department: dept._id,
      employeeId: 'CSE-FAC-001',
    });
    console.log('Created faculty for courses:', faculty.email);
  } else if (!faculty.department) {
    faculty.department = dept._id;
    await faculty.save();
  }

  if (studentUser && !studentUser.department) {
    studentUser.department = dept._id;
    await studentUser.save();
  }

  const definitions = [
    {
      code: 'CS301',
      name: 'Design and Analysis of Algorithms (DAA)',
      semester: 5,
    },
    {
      code: 'CS302',
      name: 'Computer Communication Networks (CCN)',
      semester: 5,
    },
    {
      code: 'CS303',
      name: 'Operating Systems (OS)',
      semester: 5,
    },
  ];

  for (const def of definitions) {
    let course = await Course.findOne({ code: def.code });
    if (!course) {
      course = await Course.create({
        code: def.code,
        name: def.name,
        semester: def.semester,
        department: dept._id,
        faculty: faculty._id,
        enrolledStudents: studentUser ? [studentUser._id] : [],
      });
      console.log('Created course:', def.code, def.name);
    } else {
      await Course.updateOne(
        { _id: course._id },
        {
          $set: {
            name: def.name,
            semester: def.semester,
            department: dept._id,
            faculty: faculty._id,
          },
          ...(studentUser
            ? { $addToSet: { enrolledStudents: studentUser._id } }
            : {}),
        }
      );
      console.log('Updated course:', def.code, def.name);
    }
  }
};

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

    await seedCurriculumCourses(user);

    console.log('Seed completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
};

run();
