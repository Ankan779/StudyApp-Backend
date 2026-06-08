const mongoose = require('mongoose')

const taskSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },

    title:    { type: String, required: true, trim: true },
    desc:     { type: String, default: null, trim: true },
    tag:      { type: String, default: 'OTHER' },
    tagColor: { type: String, default: 'bg-yellow-50 text-yellow-600' },
    colId:    { type: String, enum: ['todo','doing','done'], default: 'todo' },
    status:   { type: String, enum: ['not_started','ongoing','completed'], default: 'not_started' },

    assignee: {
      _id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name:  String,
      email: String,
    },

    createdAt: { type: String }, // human-readable date string e.g. "Jun 8, 2025"
  },
  { timestamps: true }
)

module.exports = mongoose.model('Task', taskSchema)
