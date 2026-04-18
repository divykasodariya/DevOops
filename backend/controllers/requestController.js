import Request from '../models/Request.js';
import ProfessorProfile from '../models/ProfessorProfile.js';

// Helper function to calculate match score
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
    const { type, title, description, targetRole, metadata } = req.body;

    let assignedTo = null;

    if (type === 'research' || type === 'lor') {
      const professors = await ProfessorProfile.find({});
      
      let bestMatchScore = -1;
      let bestProfessor = null;

      professors.forEach(prof => {
        const interests = [...(prof.researchInterests || []), ...(prof.teachingAreas || []), ...(prof.autoTags || [])];
        const score = calculateMatchScore(metadata?.tags, interests);

        if (score > bestMatchScore) {
          bestMatchScore = score;
          bestProfessor = prof.userId;
        }
      });

      // Assign to the best matching professor if a match is found
      if (bestProfessor && bestMatchScore > 0) {
        assignedTo = bestProfessor;
      }
    }

    const request = await Request.create({
      userId: req.user._id,
      type,
      title,
      description,
      targetRole: targetRole || (['research', 'lor'].includes(type) ? 'professor' : 'admin'), // Default fallback
      assignedTo,
      metadata
    });

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRequests = async (req, res) => {
  try {
    let requests;

    if (req.user.role === 'student') {
      // Students see only their own requests
      requests = await Request.find({ userId: req.user._id }).populate('assignedTo', 'name email');
    } else if (req.user.role === 'professor') {
      // Professors see requests assigned to them
      requests = await Request.find({ assignedTo: req.user._id }).populate('userId', 'name email');
    } else if (req.user.role === 'admin') {
      // Admins see all requests
      requests = await Request.find({}).populate('userId', 'name email').populate('assignedTo', 'name email');
    } else {
      // club or other
      requests = await Request.find({ userId: req.user._id });
    }

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const actionRequest = async (req, res) => {
  try {
    const { requestId, action } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Must be approve or reject' });
    }

    const request = await Request.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if the professor is authorized to action THIS request
    if (req.user.role === 'professor' && request.assignedTo && request.assignedTo.toString() !== req.user._id.toString()) {
       return res.status(403).json({ message: 'Not authorized to action this request' });
    }

    request.stage = action === 'approve' ? 'approved' : 'rejected';
    await request.save();

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
