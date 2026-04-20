import { Issue } from '../models/Issue.js';

// POST /issues
export const createIssue = async (req, res) => {
  try {
    const { title, description, category, location, priority = 'medium', geoCoords } = req.body;

    if (!title?.trim() || !category || !location?.trim()) {
      return res.status(400).json({
        message: 'Title, category, and location are required.',
      });
    }

    const issue = await Issue.create({
      title: title.trim(),
      description: description?.trim() || '',
      category,
      location: location.trim(),
      geoCoords,
      reportedBy: req.user._id,
      priority,
      timeline: [
        {
          status: 'open',
          note: 'Issue reported.',
          updatedBy: req.user._id,
        },
      ],
    });

    res.status(201).json(issue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /issues/my
export const getMyIssues = async (req, res) => {
  try {
    const issues = await Issue.find({ reportedBy: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(issues);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /issues/all — operations queue (admin / principal / support)
export const getAllIssues = async (req, res) => {
  try {
    const issues = await Issue.find()
      .populate('reportedBy', 'name email rollNumber')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json(issues);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
