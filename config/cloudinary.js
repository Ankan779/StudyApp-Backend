const cloudinary = require('cloudinary').v2
const multer     = require('multer')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Use memory storage — we'll stream the buffer directly to Cloudinary
// so we can set resource_type:'auto' ourselves (multer-storage-cloudinary
// ignores it and always uses 'image', which breaks PDFs/docs).
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 }, // 20 MB
})

module.exports = { cloudinary, upload }
