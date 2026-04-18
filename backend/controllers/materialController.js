import path from 'path';
import User from '../models/User.js';
import { Notification } from '../models/Notification.js';

const normalizePublicUrl = (req, filePath) => {
  const normalized = filePath.replace(/\\/g, '/');
  return `${req.protocol}://${req.get('host')}/${normalized}`;
};

export const uploadMaterials = async (req, res) => {
  try {
    const { title, description = '' } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ message: 'Title is required.' });
    }

    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    if (!uploadedFiles.length) {
      return res.status(400).json({ message: 'At least one file is required.' });
    }

    const studentUsers = await User.find({ role: 'student', isActive: true }).select('_id');
    if (!studentUsers.length) {
      return res.status(404).json({ message: 'No active students found.' });
    }

    const attachments = uploadedFiles.map((file) => ({
      fileName: file.originalname,
      url: normalizePublicUrl(req, path.join('uploads', 'materials', file.filename)),
      mimeType: file.mimetype,
      size: file.size,
    }));

    const bodyLines = [description.trim()].filter(Boolean);
    bodyLines.push(`Materials uploaded: ${attachments.map((a) => a.fileName).join(', ')}`);

    const notifications = await Notification.insertMany(
      studentUsers.map((user) => ({
        recipient: user._id,
        title: title.trim(),
        body: bodyLines.join('\n\n'),
        type: 'announcement',
        attachments,
      }))
    );

    return res.status(201).json({
      message: 'Materials uploaded and announced to students.',
      createdCount: notifications.length,
      fileCount: attachments.length,
      attachments,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
