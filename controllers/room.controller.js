const { validationResult } = require('express-validator')
const Room = require('../models/room.model')

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

/* POST /api/rooms */
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

/* POST /api/rooms/join */
async function joinRoom(req, res) {
  const { code } = req.body
  if (!code?.trim()) return res.status(422).json({ message: 'Room code is required' })

  const room = await Room.findOne({ code: code.trim().toUpperCase() })
    .populate('creator', 'name email')
    .populate('members', 'name email')
  if (!room) return res.status(404).json({ message: 'No room found with that code' })

  const alreadyIn = room.members.some(m => m._id.toString() === req.user._id.toString())
  if (!alreadyIn) {
    room.members.push(req.user._id)
    await room.save()
    await room.populate('members', 'name email')
  }
  res.status(200).json({ room })
}

/* GET /api/rooms/my */
async function getMyRooms(req, res) {
  const rooms = await Room.find({ members: req.user._id })
    .populate('creator', 'name email')
    .populate('members', 'name email')
    .sort({ updatedAt: -1 })
  res.status(200).json({ rooms })
}

/* GET /api/rooms/:id */
async function getRoom(req, res) {
  const { room, error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })
  res.status(200).json({ room })
}

/* ── Task CRUD ── */
const Task = require('../models/task.model')

async function getTasks(req, res) {
  const { error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })
  const tasks = await Task.find({ roomId: req.params.id }).sort({ createdAt: 1 })
  res.status(200).json({ tasks })
}

async function createTask(req, res) {
  const { error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const { title, desc, tag, tagColor, assignee, createdAt } = req.body
  if (!title?.trim()) return res.status(422).json({ message: 'Title is required' })

  const task = await Task.create({
    roomId: req.params.id,
    title:  title.trim(),
    desc:   desc || null,
    tag,
    tagColor,
    assignee: assignee?._id ? assignee : null,
    createdAt,
  })
  res.status(201).json({ task })
}

async function updateTask(req, res) {
  const { error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const task = await Task.findOne({ _id: req.params.taskId, roomId: req.params.id })
  if (!task) return res.status(404).json({ message: 'Task not found' })

  const allowed = ['title','desc','tag','tagColor','colId','status','assignee']
  allowed.forEach(f => { if (req.body[f] !== undefined) task[f] = req.body[f] })
  await task.save()
  res.status(200).json({ task })
}

async function deleteTask(req, res) {
  const { error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const task = await Task.findOneAndDelete({ _id: req.params.taskId, roomId: req.params.id })
  if (!task) return res.status(404).json({ message: 'Task not found' })
  res.status(200).json({ message: 'Task deleted' })
}

module.exports = {
  createRoom, joinRoom, getMyRooms, getRoom,
  getTasks, createTask, updateTask, deleteTask,
}
