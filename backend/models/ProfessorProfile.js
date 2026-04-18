import mongoose from 'mongoose';

const professorProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  department: {
    type: String,
    required: true
  },
  position: {
    type: String,
    required: true
  },
  researchInterests: [{
    type: String
  }],
  teachingAreas: [{
    type: String
  }],
  autoTags: [{
    type: String
  }],

  availability: [{
    day: { type: String, enum: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
    slots: [String]
  }]
}, { timestamps: true });

const ProfessorProfile = mongoose.model('ProfessorProfile', professorProfileSchema);
export default ProfessorProfile;
