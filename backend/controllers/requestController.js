import ApprovalRequest from '../models/ApprovalRequest.js';
import ProfessorProfile from '../models/ProfessorProfile.js';
import { Notification } from '../models/Notification.js';
import { Department } from '../models/Department.js';
import { Schedule } from '../models/Schedule.js';
import User from '../models/User.js';

const calculateMatchScore = (requestTags, professorInterests) => {
  if (!requestTags || requestTags.length === 0) return 0;
  let score = 0;
  const lowerTags = requestTags.map(t => t.toLowerCase());

  professorInterests.forEach(interest => {
    if (lowerTags.includes(interest.toLowerCase())) {
      score += 1;
    }
  });
  return score;
};

export const createRequest = async (req, res) => {
  try {
    const { type, title, description, meta, steps: customSteps } = req.body;

    let steps = [];
    const validRoles = ['faculty', 'hod', 'principal', 'admin', 'support'];
    const validStatuses = ['pending', 'approved', 'rejected', 'escalated'];

    if (Array.isArray(customSteps) && customSteps.length > 0) {
      const normalizedSteps = customSteps
        .map((step, index) => ({
          order: Number(step.order) || index + 1,
          approver: step.approver,
          role: step.role,
          status: step.status || 'pending',
          remarks: step.remarks || '',
        }))
        .sort((a, b) => a.order - b.order);

      const hasInvalidStep = normalizedSteps.some(
        (step) =>
          !step.approver ||
          !validRoles.includes(step.role) ||
          !validStatuses.includes(step.status)
      );

      if (hasInvalidStep) {
        return res.status(400).json({
          message: 'Each step must include valid approver, role, and status.',
        });
      }

      const approverIds = normalizedSteps.map((step) => step.approver);
      const approvers = await User.find({ _id: { $in: approverIds } }).select('_id role');
      const approverMap = new Map(approvers.map((u) => [u._id.toString(), u.role]));
      const mismatch = normalizedSteps.find((step) => {
        const dbRole = approverMap.get(step.approver.toString());
        return !dbRole || dbRole !== step.role;
      });

      if (mismatch) {
        return res.status(400).json({
          message: 'Step approver role mismatch. Please refresh approvers and try again.',
        });
      }

      steps = normalizedSteps;
    }

    // Smart routing for research or lor
    if (steps.length === 0 && (type === 'research' || type === 'lor')) {
      const professors = await ProfessorProfile.find({});

      let bestMatchScore = -1;
      let bestProfessor = null;

      professors.forEach(prof => {
        const interests = [...(prof.researchInterests || []), ...(prof.teachingAreas || []), ...(prof.autoTags || [])];
        const score = calculateMatchScore(meta?.tags, interests);

        if (score > bestMatchScore) {
          bestMatchScore = score;
          bestProfessor = prof.userId;
        }
      });

      if (bestProfessor && bestMatchScore > 0) {
        steps.push({
          order: 1,
          approver: bestProfessor,
          role: 'faculty',
          status: 'pending'
        });
      }
    } else if (steps.length === 0) {
      // For other types like leave, room, build a chain.
      // E.g. HOD -> Principal. Just an example chain if department is known.
      if (req.user.department) {
        const dept = await Department.findById(req.user.department);
        let order = 1;
        if (dept && dept.hod) {
          steps.push({ order: order++, approver: dept.hod, role: 'hod', status: 'pending' });
        }
        if (dept && dept.principal) {
          steps.push({ order: order++, approver: dept.principal, role: 'principal', status: 'pending' });
        }
      }

      // Fallback if no steps were added
      if (steps.length === 0) {
        // Find an admin as fallback
        const admin = await ProfessorProfile.db.model('User').findOne({ role: 'admin' });
        if (admin) {
          steps.push({ order: 1, approver: admin._id, role: 'admin', status: 'pending' });
        }
      }
    }

    const request = await ApprovalRequest.create({
      requestedBy: req.user._id,
      department: req.user.department, // Assuming user has department populated
      type,
      title,
      description,
      steps,
      meta
    });

    // Notify the first approver
    if (steps.length > 0) {
      await Notification.create({
        recipient: steps[0].approver,
        title: 'New Approval Request',
        body: `You have a new ${type} request to review: ${title}`,
        type: 'approval_action',
        refModel: 'ApprovalRequest',
        refId: request._id
      });
    }

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRequests = async (req, res) => {
  try {
    let requests;

    if (req.user.role === 'student' || req.user.role === 'club') {
      // Students and clubs see their own requests
      requests = await ApprovalRequest.find({ requestedBy: req.user._id })
        .populate('requestedBy', 'name email')
        .populate('steps.approver', 'name email');
    } else {
      // Faculty, HOD, Principal, Admin etc. see requests where they are an approver and it's their turn
      // Note: Admin might want to see all, but for now we follow the user prompt exactly:
      // Faculty/HOD hits GET /requests -> query { 'steps.approver': userId, 'steps.status': 'pending' }
      requests = await ApprovalRequest.find({
        'steps.approver': req.user._id,
        'steps.status': 'pending'
      }).populate('requestedBy', 'name email').populate('steps.approver', 'name email');
    }

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRequestById = async (req, res) => {
  try {
    const request = await ApprovalRequest.findById(req.params.id)
      .populate('requestedBy', 'name email')
      .populate('steps.approver', 'name email role');

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const actionRequest = async (req, res) => {
  try {
    const { requestId, action, remarks } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Must be approve or reject' });
    }

    const request = await ApprovalRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.overallStatus !== 'pending') {
      return res.status(400).json({ message: 'This request is already ' + request.overallStatus });
    }

    const currentStepIndex = request.currentStep;
    if (currentStepIndex >= request.steps.length) {
      return res.status(400).json({ message: 'No more steps to approve' });
    }

    const currentStep = request.steps[currentStepIndex];

    // Verify authorized user
    if (currentStep.approver.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to action this step' });
    }

    if (action === 'reject') {
      currentStep.status = 'rejected';
      currentStep.remarks = remarks;
      currentStep.actionAt = new Date();
      request.overallStatus = 'rejected';

      // Notify the requester
      await Notification.create({
        recipient: request.requestedBy,
        title: 'Request Rejected',
        body: `Your request "${request.title}" was rejected.`,
        type: 'approval_action',
        refModel: 'ApprovalRequest',
        refId: request._id
      });
    } else {
      // Approve
      currentStep.status = 'approved';
      currentStep.remarks = remarks;
      currentStep.actionAt = new Date();

      if (currentStepIndex + 1 === request.steps.length) {
        request.overallStatus = 'approved';

        // If this is a room booking, auto-create a Schedule entry
        if (request.type === 'room' && request.meta?.room && request.meta?.start && request.meta?.end) {
          // Run clash detection
          let clashConflicts = [];
          const clashes = await Schedule.find({
            room: request.meta.room,
            isActive: true,
            start: { $lt: new Date(request.meta.end) },
            end: { $gt: new Date(request.meta.start) },
          });
          clashConflicts = clashes.map(c => ({
            conflictingScheduleId: c._id,
            reason: 'same room',
          }));

          const schedule = await Schedule.create({
            title: request.title,
            type: 'room_booking',
            room: request.meta.room,
            department: request.department,
            start: new Date(request.meta.start),
            end: new Date(request.meta.end),
            audience: 'user',
            audienceIds: [request.requestedBy],
            clashChecked: true,
            clashConflicts,
            createdBy: request.requestedBy,
          });

          request.relatedSchedule = schedule._id;
        }

        // Notify the requester
        await Notification.create({
          recipient: request.requestedBy,
          title: 'Request Approved',
          body: `Your request "${request.title}" is fully approved.`,
          type: 'approval_action',
          refModel: 'ApprovalRequest',
          refId: request._id
        });
      } else {
        request.currentStep += 1;
        // Notify the next approver
        const nextApprover = request.steps[request.currentStep].approver;
        await Notification.create({
          recipient: nextApprover,
          title: 'New Approval Request',
          body: `You have a pending approval for: ${request.title}`,
          type: 'approval_action',
          refModel: 'ApprovalRequest',
          refId: request._id
        });
      }
    }

    await request.save();

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /request/pending — Pending requests for the logged-in user
// ─────────────────────────────────────────────
export const getMyPendingRequests = async (req, res) => {
  try {
    const requests = await ApprovalRequest.find({
      requestedBy: req.user._id,
      overallStatus: 'pending'
    })
      .select('title type overallStatus createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /request/approvers — approver candidates
// ─────────────────────────────────────────────
export const getApproverCandidates = async (req, res) => {
  try {
    const users = await User.find({
      role: { $in: ['faculty', 'hod', 'principal', 'admin', 'support'] },
      isActive: true,
    })
      .select('_id name email role')
      .sort({ name: 1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
