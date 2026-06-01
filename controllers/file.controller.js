const Room = require('../models/room.model')
const { cloudinary } = require('../config/cloudinary')
const streamifier = require('streamifier')

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

/* ────────────────────────────────────────────
   GET /api/rooms/:id/files
──────────────────────────────────────────── */
async function getFiles(req, res) {
  const { room, error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })
  
  // Sort: pinned first, then by date desc
  const sorted = [...room.files].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return new Date(b.uploadedAt) - new Date(a.uploadedAt)
  })
  res.status(200).json({ files: sorted })
}

/* ────────────────────────────────────────────
   POST /api/rooms/:id/files
──────────────────────────────────────────── */
async function uploadFile(req, res) {
  const { room, error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })
  if (!req.file) return res.status(422).json({ message: 'No file provided' })

  const { originalname, buffer, mimetype, size } = req.file
  const format = originalname.split('.').pop().toLowerCase()

  // Determine resource_type so Cloudinary stores it correctly
  const resourceType = mimetype?.startsWith('image/') ? 'image'
                     : mimetype?.startsWith('video/') ? 'video'
                     : 'raw'   // PDFs, docs, xlsx, etc. must be 'raw'

  // Clean filename spaces for clean URL structure path matrices
  const cleanNameOnly = originalname.replace(/\.[^/.]+$/, "").replace(/\s+/g, '_')
  
  // CRITICAL FIX: 'raw' files MUST contain their file extension tracking within the public_id option
  const targetPublicId = resourceType === 'raw' 
    ? `${Date.now()}-${cleanNameOnly}.${format}`
    : `${Date.now()}-${cleanNameOnly}`

  let result
  try {
    result = await uploadToCloudinary(buffer, {
      folder:          `studysphere/rooms/${req.params.id}`,
      resource_type:   resourceType,
      public_id:       targetPublicId,
      use_filename:    true,
      unique_filename: false,
    })
  } catch (err) {
    console.error('Cloudinary upload error:', err)
    return res.status(500).json({ message: 'File upload to cloud failed' })
  }

  // Push the unified schema structure to subdocument array 
  room.files.push({
    name:         originalname,
    url:          result.secure_url,
    publicId:     result.public_id,
    resourceType: result.resource_type,
    format:       result.format || format,
    size:         size || result.bytes || 0,
    uploadedBy:   { _id: req.user._id, name: req.user.fullName || req.user.name },
    pinned:       false,
    uploadedAt:   new Date()
  })

  await room.save()
  const newFile = room.files[room.files.length - 1]
  res.status(201).json({ file: newFile })
}

/* ────────────────────────────────────────────
   PATCH /api/rooms/:id/files/:fileId/pin
──────────────────────────────────────────── */
async function togglePin(req, res) {
  const { room, error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const file = room.files.id(req.params.fileId)
  if (!file) return res.status(404).json({ message: 'File not found' })

  if (!file.pinned) {
    const pinnedCount = room.files.filter(f => f.pinned).length
    if (pinnedCount >= 3) {
      return res.status(400).json({ message: 'You can pin at most 3 files. Unpin one first.' })
    }
  }

  file.pinned = !file.pinned
  await room.save()
  res.status(200).json({ file })
}

/* ────────────────────────────────────────────
   DELETE /api/rooms/:id/files/:fileId
──────────────────────────────────────────── */
async function deleteFile(req, res) {
  const { room, error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const file = room.files.id(req.params.fileId)
  if (!file) return res.status(404).json({ message: 'File not found' })

  // Delete from Cloudinary using the stored resource_type context metadata
  try {
    await cloudinary.uploader.destroy(file.publicId, { resource_type: file.resourceType || 'raw' })
  } catch (e) {
    console.warn('Cloudinary remote container unlinking failure notification:', e.message)
  }

  // Mongoose optimization: Pull the sub-document cleanly out of the active schema array
  room.files.pull(req.params.fileId)
  await room.save()
  
  res.status(200).json({ message: 'File successfully deleted out of database matrix logs' })
}

module.exports = { getFiles, uploadFile, togglePin, deleteFile }