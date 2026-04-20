import { Notification } from '../models/Notification.js';
import User from '../models/User.js';

// ─────────────────────────────────────────────
// GET /notifications/my — Get notifications for logged-in user
// ─────────────────────────────────────────────
export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(80);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /notifications/announcements — Get announcement-type notifications
// ─────────────────────────────────────────────
export const getAnnouncements = async (req, res) => {
  try {
    // Every published notice creates one Notification per recipient; return all of this user's
    // announcement rows (no cap — faculty/students see their full inbox).
    const announcements = await Notification.find({
      recipient: req.user._id,
      type: 'announcement',
    }).sort({ createdAt: -1 });

    res.json(announcements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /notifications/announce — Create an announcement (admin/faculty)
// ─────────────────────────────────────────────
export const createAnnouncement = async (req, res) => {
  try {
    const { title, body, recipientId, targetAudience = 'all' } = req.body;

    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ message: 'Title and body are required.' });
    }

    let recipientIds = [];

    if (recipientId) {
      recipientIds = [recipientId];
    } else {
      const audienceRoleMap = {
        student: ['student'],
        faculty: ['faculty', 'hod', 'principal', 'admin', 'support'],
        all: [],
      };

      const roles = audienceRoleMap[targetAudience] ?? audienceRoleMap.all;
      const query = roles.length ? { role: { $in: roles }, isActive: true } : { isActive: true };
      const users = await User.find(query).select('_id');
      recipientIds = users.map((user) => user._id);
    }

    if (!recipientIds.length) {
      return res.status(404).json({ message: 'No recipients found for selected audience.' });
    }

    const notifications = await Notification.insertMany(
      recipientIds.map((id) => ({
        recipient: id,
        title: title.trim(),
        body: body.trim(),
        type: 'announcement',
      }))
    );

    res.status(201).json({
      message: 'Announcement published successfully.',
      createdCount: notifications.length,
      targetAudience,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// PUT /notifications/:id/read — Mark a notification as read
// ─────────────────────────────────────────────
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not allowed to update this notification' });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /notifications/read-all — mark entire inbox read for current user
export const markAllAsRead = async (req, res) => {
  try {
    const now = new Date();
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: now } }
    );

    res.json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
