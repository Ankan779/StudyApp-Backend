const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },

    sender: {
      _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
    },
    text:  { type: String, default: '' },
    code:  { type: String, default: null },
  },
  { timestamps: true } // createdAt = sentAt
)

module.exports = mongoose.model('Message', messageSchema)
