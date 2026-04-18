import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { getAttendanceOverview, markAttendance, getCourseAttendance, getFacultyStats } from '../controllers/attendanceController.js';

const router = express.Router();

router.route('/overview')
  .get(protect, getAttendanceOverview);

router.route('/mark')
  .post(protect, authorize('faculty', 'hod', 'admin'), markAttendance);

router.route('/faculty-stats')
  .get(protect, authorize('faculty', 'hod', 'admin'), getFacultyStats);

router.route('/course/:courseId')
  .get(protect, getCourseAttendance);

export default router;
