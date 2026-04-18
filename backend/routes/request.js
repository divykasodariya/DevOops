import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { createRequest, getRequests, getRequestById, actionRequest } from '../controllers/requestController.js';

const router = express.Router();

router.route('/')
  .post(protect, createRequest)
  .get(protect, getRequests);

router.route('/:id')
  .get(protect, getRequestById);

router.route('/action')
  .post(protect, authorize('faculty', 'admin'), actionRequest);

export default router;
