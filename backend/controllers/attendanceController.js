import mongoose from 'mongoose';
import { Attendance } from '../models/Attendance.js';
import { Schedule } from '../models/Schedule.js';
import { Course } from '../models/Course.js';
import User from '../models/User.js';

const PRESENT_LIKE = new Set(['present', 'late', 'od']);

/** Calendar day in UTC (avoids duplicate “same day” rows across time-of-day). */
const utcDayStart = (input) => {
  if (input == null) return null;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    const [y, m, d] = input.trim().split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const t = new Date(input);
  if (Number.isNaN(t.getTime())) return null;
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
};

const utcDayEndExclusive = (dayStart) => {
  const x = new Date(dayStart);
  x.setUTCDate(x.getUTCDate() + 1);
  return x;
};

const idString = (ref) => {
  if (ref == null) return '';
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object' && ref._id != null) return String(ref._id);
  return String(ref);
};

const recordStudentMatches = (recordStudent, userId) => {
  const a = idString(recordStudent);
  const b = String(userId);
  return !!a && !!b && a === b;
};

// ─────────────────────────────────────────────
// GET /attendance/overview
// Students: own attendance % across sessions where they appear in records.
// Faculty/HOD: aggregate presence rate across sessions they marked.
// Others: neutral empty payload (no fabricated numbers).
// ─────────────────────────────────────────────
export const getAttendanceOverview = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    if (userRole === 'faculty' || userRole === 'hod') {
      const markedByMe = await Attendance.find({ markedBy: userId })
        .populate('course', 'name code')
        .sort({ date: -1 });

      if (markedByMe.length > 0) {
        let totalSlots = 0;
        let totalPresent = 0;

        markedByMe.forEach((doc) => {
          const enrolled = doc.totalEnrolled ?? doc.records?.length ?? 0;
          const present =
            doc.totalPresent ??
            (doc.records || []).filter((r) => PRESENT_LIKE.has(r.status)).length;
          totalSlots += enrolled;
          totalPresent += present;
        });

        const percentage = totalSlots > 0 ? Math.round((totalPresent / totalSlots) * 100) : 0;
        const latestCourse = markedByMe[0]?.course;
        const courseName = latestCourse
          ? [latestCourse.code, latestCourse.name].filter(Boolean).join(' · ')
          : '';

        return res.json({
          percentage,
          totalClasses: markedByMe.length,
          totalStudents: totalSlots,
          totalPresent,
          status: percentage >= 75 ? 'On Track' : percentage >= 60 ? 'At Risk' : 'Critical',
          source: 'attendance',
          courseName: courseName || undefined,
          label: `${markedByMe.length} session(s) · slot attendance`,
        });
      }

      const mySchedules = await Schedule.find({ createdBy: userId, isActive: true });
      return res.json({
        percentage: 0,
        totalClasses: 0,
        totalStudents: 0,
        totalPresent: 0,
        status: mySchedules.length > 0 ? 'No Data' : 'No Data',
        source: 'none',
        courseName: '',
        label: mySchedules.length > 0 ? 'Mark attendance to see statistics' : 'No classes scheduled',
      });
    }

    if (userRole === 'student' || userRole === 'club') {
      const attendanceDocs = await Attendance.find({
        'records.student': userId,
      });

      if (attendanceDocs.length > 0) {
        let totalClasses = 0;
        let attended = 0;

        attendanceDocs.forEach((doc) => {
          const record = (doc.records || []).find((r) => recordStudentMatches(r.student, userId));
          if (record) {
            totalClasses += 1;
            if (PRESENT_LIKE.has(record.status)) {
              attended += 1;
            }
          }
        });

        const percentage = totalClasses > 0 ? Math.round((attended / totalClasses) * 100) : 0;

        return res.json({
          percentage,
          totalClasses,
          attended,
          status:
            totalClasses === 0
              ? 'No Data'
              : percentage >= 75
                ? 'On Track'
                : percentage >= 60
                  ? 'At Risk'
                  : 'Critical',
          source: 'attendance',
          label: `${totalClasses} session(s) recorded`,
        });
      }

      return res.json({
        percentage: 0,
        totalClasses: 0,
        attended: 0,
        status: 'No Data',
        source: 'none',
        label: 'No attendance recorded yet',
      });
    }

    return res.json({
      percentage: 0,
      totalClasses: 0,
      attended: 0,
      totalStudents: 0,
      totalPresent: 0,
      status: 'No Data',
      source: 'n/a',
      label: 'Attendance overview not available for this role',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /attendance/mark — Mark attendance for a course (faculty only)
// ─────────────────────────────────────────────
export const markAttendance = async (req, res) => {
  try {
    const { courseId, date, records } = req.body;

    if (!courseId || !date || !records || !records.length) {
      return res.status(400).json({ message: 'courseId, date, and records are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid courseId.' });
    }

    const course = await Course.findById(courseId).select('faculty department');
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }
    const isAdmin = req.user.role === 'admin';
    const teachesCourse = course.faculty?.toString() === req.user._id.toString();
    const hodDeptMatch =
      req.user.role === 'hod' &&
      req.user.department &&
      course.department?.toString() === req.user.department.toString();
    if (!isAdmin && !teachesCourse && !hodDeptMatch) {
      return res.status(403).json({
        message: 'You can only mark attendance for your own courses (or your department as HOD).',
      });
    }

    const allowedStatus = new Set(['present', 'absent', 'late', 'od']);
    for (const r of records) {
      if (!r || !mongoose.Types.ObjectId.isValid(r.student)) {
        return res.status(400).json({ message: 'Each record needs a valid student id.' });
      }
      if (!allowedStatus.has(r.status || 'absent')) {
        return res.status(400).json({ message: 'Invalid attendance status in records.' });
      }
    }

    const studentIds = [...new Set(records.map((r) => String(r.student)))];
    const students = await User.find({ _id: { $in: studentIds } }).select('role');
    if (students.length !== studentIds.length) {
      return res.status(400).json({ message: 'One or more student ids were not found.' });
    }
    if (students.some((u) => !['student', 'club'].includes(u.role))) {
      return res.status(400).json({ message: 'Attendance can only be recorded for student or club accounts.' });
    }

    const dayStart = utcDayStart(date);
    if (!dayStart) {
      return res.status(400).json({ message: 'Invalid date.' });
    }
    const dayEnd = utcDayEndExclusive(dayStart);

    const existing = await Attendance.findOne({
      course: courseId,
      date: { $gte: dayStart, $lt: dayEnd },
    });
    if (existing) {
      return res.status(400).json({ message: 'Attendance already marked for this date.' });
    }

    const totalPresent = records.filter((r) => PRESENT_LIKE.has(r.status)).length;
    const totalAbsent = records.filter((r) => r.status === 'absent').length;

    const attendance = await Attendance.create({
      course: courseId,
      date: dayStart,
      markedBy: req.user._id,
      records,
      totalPresent,
      totalAbsent,
      totalEnrolled: records.length,
    });

    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /attendance/course/:courseId — Attendance records for a specific course
// ─────────────────────────────────────────────
export const getCourseAttendance = async (req, res) => {
  try {
    const { courseId } = req.params;

    const records = await Attendance.find({ course: courseId })
      .populate('markedBy', 'name')
      .sort({ date: -1 });

    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /attendance/faculty-stats — Faculty's class-wise attendance summary
// ─────────────────────────────────────────────
export const getFacultyStats = async (req, res) => {
  try {
    const facultyId = req.user._id;

    const records = await Attendance.find({ markedBy: facultyId })
      .populate('course', 'name code')
      .sort({ date: -1 });

    const courseMap = {};
    records.forEach((doc) => {
      const courseIdStr = doc.course?._id?.toString() || 'unknown';
      if (!courseMap[courseIdStr]) {
        courseMap[courseIdStr] = {
          course: doc.course,
          sessions: 0,
          totalPresent: 0,
          totalEnrolled: 0,
        };
      }
      courseMap[courseIdStr].sessions += 1;
      const present =
        doc.totalPresent ??
        (doc.records || []).filter((r) => PRESENT_LIKE.has(r.status)).length;
      const enrolled = doc.totalEnrolled ?? doc.records?.length ?? 0;
      courseMap[courseIdStr].totalPresent += present;
      courseMap[courseIdStr].totalEnrolled += enrolled;
    });

    const stats = Object.values(courseMap).map((c) => ({
      ...c,
      avgAttendance: c.totalEnrolled > 0 ? Math.round((c.totalPresent / c.totalEnrolled) * 100) : 0,
    }));

    res.json({
      totalSessions: records.length,
      courses: stats,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
