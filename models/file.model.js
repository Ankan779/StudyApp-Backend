const mongoose = require('mongoose')

const fileSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },

    name:         { type: String, required: true },
    url:          { type: String, required: true },  // Cloudinary secure URL
    publicId:     { type: String, required: true },  // Cloudinary public_id for deletion
    resourceType: { type: String, default: 'raw' },  // image | video | raw
    format:       { type: String, default: '' },     // pdf, png, xlsx …
    size:         { type: Number, default: 0 },      // bytes

    uploadedBy: {
      _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
    },

    pinned: { type: Boolean, default: false },
  },
  { timestamps: true } // createdAt = uploadedAt
)

module.exports = mongoose.model('RoomFile', fileSchema)
