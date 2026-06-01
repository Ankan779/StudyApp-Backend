const mongoose = require('mongoose')

/* ── Generate a unique room code like "PHYS-4821" ── */
function generateCode() {
  const prefix = ['PHYS', 'CHEM', 'MATH', 'HIST', 'CODE', 'BIOL', 'ECON', 'ARTS', 'ENGR', 'PHIL']
  const p = prefix[Math.floor(Math.random() * prefix.length)]
  const n = Math.floor(1000 + Math.random() * 9000)
  return `${p}-${n}`
}

/* ── Message subdocument ── */
const messageSchema = new mongoose.Schema(
  {
    sender: {
      _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
    },
    text:     { type: String, default: '' },
    code:     { type: String, default: null },
    sentAt:   { type: Date, default: Date.now },
  },
  { _id: true }
)

/* ── File subdocument ── */
const fileSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true },
    url:          { type: String, required: true },   // Cloudinary secure URL
    publicId:     { type: String, required: true },   // Cloudinary public_id for deletion
    resourceType: { type: String, default: 'raw' },   // image | video | raw
    format:       { type: String, default: '' },      // pdf, png, xlsx …
    size:         { type: Number, default: 0 },       // bytes
    uploadedBy: {
      _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
    },
    pinned:    { type: Boolean, default: false },
    uploadedAt:{ type: Date, default: Date.now },
  },
  { _id: true }
)

/* ── Task subdocument ── */
const taskSchema = new mongoose.Schema(
  {
    title:    { type: String, required: true, trim: true },
    desc:     { type: String, default: null, trim: true },
    tag:      { type: String, default: 'OTHER' },
    tagColor: { type: String, default: 'bg-yellow-50 text-yellow-600' },
    colId:    { type: String, enum: ['todo', 'doing', 'done'], default: 'todo' },
    status:   { type: String, enum: ['not_started', 'ongoing', 'completed'], default: 'not_started' },
    assignee: {
      _id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name:  String,
      email: String,
    },
    createdAt: { type: String }, // human-readable date string
  },
  { _id: true }
)

const roomSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Room name is required'],
      trim:      true,
      minlength: [2,  'Room name must be at least 2 characters'],
      maxlength: [80, 'Room name must be at most 80 characters'],
    },

    subject: {
      type:    String,
      enum:    ['Science', 'Humanities', 'Applied Math', 'Engineering', 'Arts', 'Other'],
      default: 'Other',
    },

    code: {
      type:   String,
      unique: true,
    },

    creator: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
      },
    ],

    tasks: [taskSchema],
    files: [fileSchema],
    messages: [messageSchema],
  },
  { timestamps: true }
)

/* ── Auto-generate a unique code before saving ── */
roomSchema.pre('save', async function (next) {
  if (this.code) return next()
  let code, exists
  do {
    code   = generateCode()
    exists = await mongoose.model('Room').findOne({ code })
  } while (exists)
  this.code = code
  next()
})

module.exports = mongoose.model('Room', roomSchema)
