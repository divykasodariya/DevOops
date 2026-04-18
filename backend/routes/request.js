import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  createRequest,
  getRequests,
  getRequestById,
  actionRequest,
  getMyPendingRequests,
  getApproverCandidates,
  resolveApproverByEmail,
} from '../controllers/requestController.js';

const router = express.Router();

router.route('/')
  .post(protect, createRequest)
  .get(protect, getRequests);

router.route('/pending')
  .get(protect, getMyPendingRequests);

router.route('/approvers')
  .get(protect, getApproverCandidates);

router.route('/resolve-approver')
  .get(protect, resolveApproverByEmail);

router.route('/action')
  .post(protect, authorize('faculty', 'admin'), actionRequest);

router.route('/:id')
  .get(protect, getRequestById);

export default router;
