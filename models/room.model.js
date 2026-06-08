const mongoose = require('mongoose')

function generateCode() {
  const prefix = ['PHYS','CHEM','MATH','HIST','CODE','BIOL','ECON','ARTS','ENGR','PHIL']
  const p = prefix[Math.floor(Math.random() * prefix.length)]
  const n = Math.floor(1000 + Math.random() * 9000)
  return `${p}-${n}`
}

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
      enum:    ['Science','Humanities','Applied Math','Engineering','Arts','Other'],
      default: 'Other',
    },
    code:    { type: String, unique: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

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
