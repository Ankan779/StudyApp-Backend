const mongoose = require('mongoose')

const questionSchema = new mongoose.Schema(
  {
    text:    { type: String, required: true },
    options: { type: [String], validate: v => v.length === 4 }, // exactly 4
    correct: { type: Number, required: true, min: 0, max: 3 },  // index 0-3
  },
  { _id: true }
)

const submissionSchema = new mongoose.Schema(
  {
    user: {
      _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
    },
    answers:     [Number],
    score:       { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const quizSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },

    title: { type: String, required: true, trim: true },
    createdBy: {
      _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
    },

    expiresAt:   { type: Date, required: true }, // 2 days after creation
    questions:   [questionSchema],
    submissions: [submissionSchema],
  },
  { timestamps: true }
)

// Auto-expire index — MongoDB TTL will remove docs after expiresAt
quizSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('Quiz', quizSchema)
