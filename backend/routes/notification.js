import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getMyNotifications,
  getAnnouncements,
  createAnnouncement,
  markAsRead,
  markAllAsRead,
} from '../controllers/notificationController.js';

const router = express.Router();

router.route('/my')
  .get(protect, getMyNotifications);

router.route('/announcements')
  .get(protect, getAnnouncements);

router.route('/read-all')
  .put(protect, markAllAsRead);

router.route('/announce')
  .post(protect, authorize('faculty', 'hod', 'admin', 'principal'), createAnnouncement);

router.route('/:id/read')
  .put(protect, markAsRead);

export default router;
