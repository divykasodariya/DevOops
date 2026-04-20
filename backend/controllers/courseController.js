import { Course } from '../models/Course.js';
import { Department } from '../models/Department.js';
import User from '../models/User.js';

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * If a faculty/HOD has no courses, create a lightweight roster shell so
 * attendance marking still works (students can be picked via search).
 */
const ensurePersonalAttendanceCourse = async (user) => {
  if (!['faculty', 'hod'].includes(user.role)) return null;

  const code = `ROSTER-${user._id.toString()}`;
  const existing = await Course.findOne({ code }).select('_id code name');
  if (existing) return existing;

  let dept = user.department
    ? await Department.findById(user.department)
    : null;
  if (!dept) {
    dept = await Department.findOne();
  }
  if (!dept) {
    dept = await Department.create({ name: 'General', code: 'GEN' });
  }

  return Course.create({
    code,
    name: 'Attendance roster',
    department: dept._id,
    faculty: user._id,
    enrolledStudents: [],
  });
};

/**
 * GET /courses/for-attendance
 * Courses the caller may mark attendance for, with enrolled students populated.
 */
export const getCoursesForAttendance = async (req, res) => {
  try {
    const uid = req.user._id;
    const role = req.user.role;

    let query = {};
    if (role === 'admin') {
      query = {};
    } else if (role === 'hod' && req.user.department) {
      query = {
        $or: [{ faculty: uid }, { department: req.user.department }],
      };
    } else if (role === 'faculty' || role === 'hod') {
      query = { faculty: uid };
    } else {
      return res.status(403).json({ message: 'Not authorized to list courses for attendance.' });
    }

    let courses = await Course.find(query)
      .select('code name semester faculty department enrolledStudents')
      .populate('enrolledStudents', 'name email rollNumber role')
      .sort({ code: 1 })
      .limit(role === 'admin' ? 300 : 80);

    if ((role === 'faculty' || role === 'hod') && courses.length === 0) {
      const stub = await ensurePersonalAttendanceCourse(req.user);
      if (stub) {
        courses = await Course.find({ _id: stub._id })
          .select('code name semester faculty department enrolledStudents')
          .populate('enrolledStudents', 'name email rollNumber role');
      }
    }

    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /courses/for-attendance/roster-search?q=
 * Find students/club members by name, email, or roll number (min 2 chars).
 */
export const searchStudentsForAttendance = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json([]);
    }

    const rx = new RegExp(escapeRe(q), 'i');
    const students = await User.find({
      role: { $in: ['student', 'club'] },
      isActive: { $ne: false },
      $or: [{ name: rx }, { email: rx }, { rollNumber: rx }],
    })
      .select('name email rollNumber role')
      .limit(30)
      .sort({ name: 1 });

    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
