import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getCoursesForAttendance,
  searchStudentsForAttendance,
} from '../controllers/courseController.js';

const router = express.Router();

router
  .route('/for-attendance')
  .get(protect, authorize('faculty', 'hod', 'admin'), getCoursesForAttendance);

router
  .route('/for-attendance/roster-search')
  .get(protect, authorize('faculty', 'hod', 'admin'), searchStudentsForAttendance);

export default router;
