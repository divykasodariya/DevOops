import ProfessorProfile from '../models/ProfessorProfile.js';

export const setupProfile = async (req, res) => {
  try {
    const { department, position, researchInterests, teachingAreas, autoTags } = req.body;

    let profile = await ProfessorProfile.findOne({ userId: req.user._id });

    if (profile) {
      // Update
      profile.department = department || profile.department;
      profile.position = position || profile.position;
      profile.researchInterests = researchInterests || profile.researchInterests;
      profile.teachingAreas = teachingAreas || profile.teachingAreas;
      profile.autoTags = autoTags || profile.autoTags;
      
      const updatedProfile = await profile.save();
      return res.json(updatedProfile);
    }

    // Create
    profile = await ProfessorProfile.create({
      userId: req.user._id,
      department,
      position,
      researchInterests,
      teachingAreas,
      autoTags: autoTags || [] // Optionally generate autoTags here based on inputs
    });

    res.status(201).json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
