const Room     = require('../models/room.model')
const RoomFile = require('../models/file.model')
const { cloudinary } = require('../config/cloudinary')
const streamifier    = require('streamifier')

/* ── Upload buffer to Cloudinary via stream ── */
function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
    streamifier.createReadStream(buffer).pipe(stream)
  })
}

/* ── Helper: verify membership ── */
async function requireMember(roomId, userId) {
  const room = await Room.findById(roomId)
  if (!room) return { error: 'Room not found', status: 404 }
  const isMember = room.members.some(m => m.toString() === userId.toString())
  if (!isMember) return { error: 'Not a member of this room', status: 403 }
  return { room }
}

/* GET /api/rooms/:id/files */
async function getFiles(req, res) {
  const { error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const files = await RoomFile.find({ roomId: req.params.id }).sort({ pinned: -1, createdAt: -1 })
  res.status(200).json({ files })
}

/* POST /api/rooms/:id/files */
async function uploadFile(req, res) {
  const { error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })
  if (!req.file) return res.status(422).json({ message: 'No file provided' })

  const { originalname, buffer, mimetype, size } = req.file
  const format = originalname.split('.').pop().toLowerCase()
  const resourceType = mimetype?.startsWith('image/') ? 'image'
                     : mimetype?.startsWith('video/') ? 'video'
                     : 'raw'

  let result
  try {
    result = await uploadToCloudinary(buffer, {
      folder:          `studysphere/rooms/${req.params.id}`,
      resource_type:   resourceType,
      public_id:       `${Date.now()}-${originalname.replace(/\s+/g, '_')}`,
      use_filename:    true,
      unique_filename: false,
    })
  } catch (err) {
    console.error('Cloudinary upload error:', err)
    return res.status(500).json({ message: 'File upload to cloud failed' })
  }

  const file = await RoomFile.create({
    roomId:       req.params.id,
    name:         originalname,
    url:          result.secure_url,
    publicId:     result.public_id,
    resourceType: result.resource_type,
    format:       result.format || format,
    size:         size || result.bytes || 0,
    uploadedBy:   { _id: req.user._id, name: req.user.name },
  })
  res.status(201).json({ file })
}

/* PATCH /api/rooms/:id/files/:fileId/pin — max 3 pinned */
async function togglePin(req, res) {
  const { error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const file = await RoomFile.findOne({ _id: req.params.fileId, roomId: req.params.id })
  if (!file) return res.status(404).json({ message: 'File not found' })

  if (!file.pinned) {
    const pinnedCount = await RoomFile.countDocuments({ roomId: req.params.id, pinned: true })
    if (pinnedCount >= 3)
      return res.status(400).json({ message: 'You can pin at most 3 files. Unpin one first.' })
  }

  file.pinned = !file.pinned
  await file.save()
  res.status(200).json({ file })
}

/* DELETE /api/rooms/:id/files/:fileId */
async function deleteFile(req, res) {
  const { error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const file = await RoomFile.findOne({ _id: req.params.fileId, roomId: req.params.id })
  if (!file) return res.status(404).json({ message: 'File not found' })

  try {
    await cloudinary.uploader.destroy(file.publicId, { resource_type: file.resourceType || 'raw' })
  } catch (e) {
    console.warn('Cloudinary delete warning:', e.message)
  }

  await file.deleteOne()
  res.status(200).json({ message: 'File deleted' })
}

module.exports = { getFiles, uploadFile, togglePin, deleteFile }
