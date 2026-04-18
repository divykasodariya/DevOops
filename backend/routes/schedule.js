import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createSchedule, getMySchedule, getFreeSlots, checkRoomConflict } from '../controllers/scheduleController.js';

const router = express.Router();

router.route('/')
  .post(protect, createSchedule);

router.route('/my')
  .get(protect, getMySchedule);

router.route('/slots')
  .get(protect, getFreeSlots);

router.route('/conflicts')
  .get(protect, checkRoomConflict);

export default router;
