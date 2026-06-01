const jwt  = require('jsonwebtoken')
const User = require('../models/auth.model')

/**
 * Protect — verifies the JWT from the Authorization header.
 * Attaches the authenticated user to req.user on success.
 */
async function protect(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorised — no token provided' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Attach user (without password) to the request
    const user = await User.findById(decoded.id)
    if (!user) {
      return res.status(401).json({ message: 'Not authorised — user no longer exists' })
    }

    req.user = user
    next()
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Session expired — please sign in again'
        : 'Not authorised — invalid token'
    return res.status(401).json({ message })
  }
}

module.exports = { protect }
