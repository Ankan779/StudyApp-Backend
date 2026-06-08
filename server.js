const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })

const express    = require('express')
const http       = require('http')
const { Server } = require('socket.io')
const cors       = require('cors')
const jwt        = require('jsonwebtoken')
const connectDB  = require('./config/db')
const authRoutes = require('./routes/auth.routes')
const roomRoutes = require('./routes/room.routes')
const Room    = require('./models/room.model')
const Message = require('./models/message.model')
const User    = require('./models/auth.model')

const app    = express()
const server = http.createServer(app)
const PORT   = process.env.PORT || 5000
const normalizeUrl = (url = '') => url.replace(/\/+$/, '')
const CLIENT_URL = normalizeUrl(process.env.CLIENT_URL || 'http://localhost:5173')

const corsOptions = {
  origin: (origin, callback) => {
    const normalizedOrigin = normalizeUrl(origin || '')
    if (!origin || normalizedOrigin === CLIENT_URL) return callback(null, true)
    return callback(new Error(`CORS origin denied: ${origin}`), false)
  },
  credentials: true,
}

/* ── Socket.io ── */
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
})

console.log(`CORS allowed origin: ${CLIENT_URL}`)

/* ── Connect to MongoDB ── */
connectDB()

/* ── Middleware ── */
app.use(cors(corsOptions))
app.use(express.json())

/* ── REST Routes ── */
app.use('/api/auth',  authRoutes)
app.use('/api/rooms', roomRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` })
})

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' })
})

/* ── Socket.io auth middleware ── */
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('No token'))
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    socket.userId = decoded.id
    next()
  } catch {
    next(new Error('Invalid token'))
  }
})

/* ── Socket.io connection handler ── */
io.on('connection', async (socket) => {
  const userId = socket.userId

  // Attach user info to socket
  try {
    const user = await User.findById(userId).select('name email')
    if (!user) { socket.disconnect(); return }
    socket.user = user
  } catch { socket.disconnect(); return }

  /* ── join_room: user joins a socket room ── */
  socket.on('join_room', async (roomId) => {
    // Verify membership
    const room = await Room.findById(roomId)
    if (!room) return
    const isMember = room.members.some(m => m.toString() === userId)
    if (!isMember) return

    socket.join(roomId)
    socket.currentRoomId = roomId

    // Send last 50 messages to the joining user
    const messages = await Message.find({ roomId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
    messages.reverse() // oldest first

    socket.emit('message_history', messages.map(m => ({
      _id:    m._id,
      sender: m.sender,
      text:   m.text,
      code:   m.code,
      sentAt: m.createdAt,
    })))

    // Notify others
    socket.to(roomId).emit('user_joined', {
      userId,
      name: socket.user.name,
    })
  })

  /* ── send_message ── */
  socket.on('send_message', async ({ roomId, text, code }) => {
    if (!roomId || (!text?.trim() && !code?.trim())) return

    const room = await Room.findById(roomId)
    if (!room) return
    const isMember = room.members.some(m => m.toString() === userId)
    if (!isMember) return

    // Persist to DB
    const saved = await Message.create({
      roomId,
      sender: { _id: userId, name: socket.user.name },
      text:   text?.trim() || '',
      code:   code?.trim() || null,
    })

    const payload = {
      _id:    saved._id,
      sender: saved.sender,
      text:   saved.text,
      code:   saved.code,
      sentAt: saved.createdAt,
    }

    // Broadcast to everyone in the room (including sender)
    io.to(roomId).emit('new_message', payload)

    // Notify users NOT currently in the chat page (unread dot)
    socket.to(roomId).emit('unread_message', { roomId })
  })

  /* ── leave_room ── */
  socket.on('leave_room', (roomId) => {
    socket.leave(roomId)
    socket.currentRoomId = null
  })

  socket.on('disconnect', () => {
    if (socket.currentRoomId) {
      socket.to(socket.currentRoomId).emit('user_left', {
        userId,
        name: socket.user?.name,
      })
    }
  })
})

/* ── Start ── */
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
