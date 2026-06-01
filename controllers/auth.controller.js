const jwt              = require('jsonwebtoken')
const { validationResult } = require('express-validator')
const User             = require('../models/auth.model')

/* ── Helper: sign a JWT ── */
function signToken(userId) {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

/* ── Helper: send token + user in response ── */
function sendAuthResponse(res, statusCode, user) {
  const token = signToken(user._id)
  res.status(statusCode).json({
    token,
    user,
  })
}

/* ────────────────────────────────────────────
   POST /api/auth/register
   Body: { name, email, password, confirmPassword }
──────────────────────────────────────────── */
async function register(req, res) {
  // 1. Validate incoming fields
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() })
  }

  const { name, email, password, confirmPassword } = req.body

  // 2. Passwords must match
  if (password !== confirmPassword) {
    return res.status(422).json({
      errors: [{ path: 'confirmPassword', msg: 'Passwords do not match' }],
    })
  }

  // 3. Check for existing account
  const existing = await User.findOne({ email })
  if (existing) {
    return res.status(409).json({
      errors: [{ path: 'email', msg: 'An account with this email already exists' }],
    })
  }

  // 4. Create user (password hashed by pre-save hook)
  const user = await User.create({ name, email, password })

  sendAuthResponse(res, 201, user)
}

/* ────────────────────────────────────────────
   POST /api/auth/login
   Body: { email, password }
──────────────────────────────────────────── */
async function login(req, res) {
  // 1. Validate incoming fields
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() })
  }

  const { email, password } = req.body

  // 2. Find user — explicitly select password (it's excluded by default)
  const user = await User.findOne({ email }).select('+password')
  if (!user) {
    // Generic message to avoid user enumeration
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  // 3. Compare password
  const isMatch = await user.comparePassword(password)
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  sendAuthResponse(res, 200, user)
}

/* ────────────────────────────────────────────
   GET /api/auth/me
   Header: Authorization: Bearer <token>
──────────────────────────────────────────── */
async function getMe(req, res) {
  // req.user is attached by the protect middleware
  res.status(200).json({ user: req.user })
}

/* ────────────────────────────────────────────
   PATCH /api/auth/update
   Header: Authorization: Bearer <token>
   Body: { name?, email?, currentPassword?, newPassword?, confirmNewPassword? }
──────────────────────────────────────────── */
async function updateAccount(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() })
  }

  const { name, email, currentPassword, newPassword, confirmNewPassword } = req.body
  const user = await User.findById(req.user._id).select('+password')

  // ── Update name ──
  if (name && name.trim()) user.name = name.trim()

  // ── Update email ──
  if (email && email.toLowerCase() !== user.email) {
    const taken = await User.findOne({ email: email.toLowerCase() })
    if (taken) {
      return res.status(409).json({
        errors: [{ path: 'email', msg: 'This email is already in use' }],
      })
    }
    user.email = email.toLowerCase()
  }

  // ── Update password ──
  if (newPassword) {
    if (!currentPassword) {
      return res.status(422).json({
        errors: [{ path: 'currentPassword', msg: 'Current password is required to set a new one' }],
      })
    }
    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      return res.status(401).json({
        errors: [{ path: 'currentPassword', msg: 'Current password is incorrect' }],
      })
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(422).json({
        errors: [{ path: 'confirmNewPassword', msg: 'New passwords do not match' }],
      })
    }
    user.password = newPassword // pre-save hook will hash it
  }

  await user.save()
  res.status(200).json({ user })
}

module.exports = { register, login, getMe, updateAccount }
