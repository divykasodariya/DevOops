import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { createRequest, getRequests, actionRequest } from '../controllers/requestController.js';

const router = express.Router();

router.route('/')
  .post(protect, createRequest)
  .get(protect, getRequests);

router.route('/action')
  .post(protect, authorize('professor', 'admin'), actionRequest);

export default router;
