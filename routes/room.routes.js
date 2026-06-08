const express  = require('express')
const { body } = require('express-validator')
const { createRoom, joinRoom, getMyRooms, getRoom, getTasks, createTask, updateTask, deleteTask } = require('../controllers/room.controller')
const { getFiles, uploadFile, togglePin, deleteFile } = require('../controllers/file.controller')
const { getQuizzes, createQuiz, submitQuiz, deleteQuiz } = require('../controllers/quiz.controller')
const { protect }  = require('../middleware/auth.middleware')
const { upload }   = require('../config/cloudinary')

const router = express.Router()

// All room routes require authentication
router.use(protect)

const createRules = [
  body('name').trim().notEmpty().withMessage('Room name is required')
    .isLength({ min: 2 }).withMessage('Room name must be at least 2 characters'),
  body('subject').optional()
    .isIn(['Science', 'Humanities', 'Applied Math', 'Engineering', 'Arts', 'Other'])
    .withMessage('Invalid subject'),
]

/* ── Room routes ── */
router.post('/',     createRules, createRoom)
router.post('/join', joinRoom)
router.get('/my',    getMyRooms)
router.get('/:id',   getRoom)

/* ── Task routes ── */
router.get   ('/:id/tasks',          getTasks)
router.post  ('/:id/tasks',          createTask)
router.patch ('/:id/tasks/:taskId',  updateTask)
router.delete('/:id/tasks/:taskId',  deleteTask)

/* ── File routes ── */
router.get   ('/:id/files',              getFiles)
router.post  ('/:id/files',              upload.single('file'), uploadFile)
router.patch ('/:id/files/:fileId/pin',  togglePin)
router.delete('/:id/files/:fileId',      deleteFile)

/* ── Quiz routes ── */
router.get   ('/:id/quizzes',                  getQuizzes)
router.post  ('/:id/quizzes',                  createQuiz)
router.post  ('/:id/quizzes/:quizId/submit',   submitQuiz)
router.delete('/:id/quizzes/:quizId',          deleteQuiz)

module.exports = router
