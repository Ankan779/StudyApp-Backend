const { validationResult } = require('express-validator')
const Room = require('../models/room.model')

/* ────────────────────────────────────────────
   POST /api/rooms
   Create a new room — creator auto-joins
──────────────────────────────────────────── */
async function createRoom(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })

  const { name, subject } = req.body

  const room = await Room.create({
    name,
    subject: subject || 'Other',
    creator: req.user._id,
    members: [req.user._id],
  })

  await room.populate('creator', 'name email')
  await room.populate('members', 'name email')

  res.status(201).json({ room })
}

/* ────────────────────────────────────────────
   POST /api/rooms/join
   Join a room by code
──────────────────────────────────────────── */
async function joinRoom(req, res) {
  const { code } = req.body
  if (!code || !code.trim()) {
    return res.status(422).json({ message: 'Room code is required' })
  }

  const room = await Room.findOne({ code: code.trim().toUpperCase() })
    .populate('creator', 'name email')
    .populate('members', 'name email')

  if (!room) {
    return res.status(404).json({ message: 'No room found with that code' })
  }

  // Already a member — just return the room
  const alreadyIn = room.members.some(m => m._id.toString() === req.user._id.toString())
  if (!alreadyIn) {
    room.members.push(req.user._id)
    await room.save()
    await room.populate('members', 'name email')
  }

  res.status(200).json({ room })
}

/* ────────────────────────────────────────────
   GET /api/rooms/my
   Get all rooms the current user belongs to
──────────────────────────────────────────── */
async function getMyRooms(req, res) {
  const rooms = await Room.find({ members: req.user._id })
    .populate('creator', 'name email')
    .populate('members', 'name email')
    .sort({ updatedAt: -1 })

  res.status(200).json({ rooms })
}

/* ────────────────────────────────────────────
   GET /api/rooms/:id
   Get a single room by ID
──────────────────────────────────────────── */
async function getRoom(req, res) {
  const room = await Room.findById(req.params.id)
    .populate('creator', 'name email')
    .populate('members', 'name email')

  if (!room) return res.status(404).json({ message: 'Room not found' })

  // Only members can view
  const isMember = room.members.some(m => m._id.toString() === req.user._id.toString())
  if (!isMember) return res.status(403).json({ message: 'You are not a member of this room' })

  res.status(200).json({ room })
}

/* ── Helper: verify membership ── */
async function requireMember(roomId, userId) {
  const room = await Room.findById(roomId)
    .populate('creator', 'name email')
    .populate('members', 'name email')
  if (!room) return { error: 'Room not found', status: 404 }
  const isMember = room.members.some(m => m._id.toString() === userId.toString())
  if (!isMember) return { error: 'Not a member of this room', status: 403 }
  return { room }
}

/* ────────────────────────────────────────────
   GET /api/rooms/:id/tasks
   Get all tasks for a room
──────────────────────────────────────────── */
async function getTasks(req, res) {
  const { room, error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })
  res.status(200).json({ tasks: room.tasks })
}

/* ────────────────────────────────────────────
   POST /api/rooms/:id/tasks
   Create a new task
──────────────────────────────────────────── */
async function createTask(req, res) {
  const { room, error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const { title, desc, tag, tagColor, assignee, createdAt } = req.body
  if (!title || !title.trim()) return res.status(422).json({ message: 'Title is required' })

  room.tasks.push({ title: title.trim(), desc: desc || null, tag, tagColor, assignee, createdAt, colId: 'todo', status: 'not_started' })
  await room.save()

  const newTask = room.tasks[room.tasks.length - 1]
  res.status(201).json({ task: newTask })
}

/* ────────────────────────────────────────────
   PATCH /api/rooms/:id/tasks/:taskId
   Update a task (status, colId, etc.)
──────────────────────────────────────────── */
async function updateTask(req, res) {
  const { room, error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const task = room.tasks.id(req.params.taskId)
  if (!task) return res.status(404).json({ message: 'Task not found' })

  const allowed = ['title', 'desc', 'tag', 'tagColor', 'colId', 'status', 'assignee']
  allowed.forEach(field => {
    if (req.body[field] !== undefined) task[field] = req.body[field]
  })

  await room.save()
  res.status(200).json({ task })
}

/* ────────────────────────────────────────────
   DELETE /api/rooms/:id/tasks/:taskId
   Delete a task
──────────────────────────────────────────── */
async function deleteTask(req, res) {
  const { room, error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const task = room.tasks.id(req.params.taskId)
  if (!task) return res.status(404).json({ message: 'Task not found' })

  task.deleteOne()
  await room.save()
  res.status(200).json({ message: 'Task deleted' })
}

module.exports = { createRoom, joinRoom, getMyRooms, getRoom, getTasks, createTask, updateTask, deleteTask }
