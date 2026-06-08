const Room = require('../models/room.model')
const Quiz = require('../models/quiz.model')

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

/* ── Helper: verify membership ── */
async function requireMember(roomId, userId) {
  const room = await Room.findById(roomId)
  if (!room) return { error: 'Room not found', status: 404 }
  const isMember = room.members.some(m => m.toString() === userId.toString())
  if (!isMember) return { error: 'Not a member of this room', status: 403 }
  return { room }
}

/* ── Strip correct answers unless user already submitted ── */
function sanitiseQuiz(quiz, userId) {
  const userSub = quiz.submissions.find(
    s => s.user._id.toString() === userId.toString()
  )
  return {
    _id:        quiz._id,
    title:      quiz.title,
    createdBy:  quiz.createdBy,
    expiresAt:  quiz.expiresAt,
    createdAt:  quiz.createdAt,
    attempted:  !!userSub,
    myScore:    userSub?.score ?? null,
    totalQ:     quiz.questions.length,
    questions:  quiz.questions.map(q => ({
      _id:     q._id,
      text:    q.text,
      options: q.options,
      correct: userSub ? q.correct : undefined,
    })),
    leaderboard: quiz.submissions
      .map(s => ({ name: s.user.name, score: s.score, submittedAt: s.submittedAt }))
      .sort((a, b) => b.score - a.score),
  }
}

/* GET /api/rooms/:id/quizzes */
async function getQuizzes(req, res) {
  const { error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const quizzes = await Quiz.find({
    roomId:    req.params.id,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 })

  res.status(200).json({ quizzes: quizzes.map(q => sanitiseQuiz(q, req.user._id)) })
}

/* POST /api/rooms/:id/quizzes */
async function createQuiz(req, res) {
  const { error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const { title, questions } = req.body
  if (!title?.trim())
    return res.status(422).json({ message: 'Quiz title is required' })
  if (!Array.isArray(questions) || questions.length === 0)
    return res.status(422).json({ message: 'At least one question is required' })

  for (const [i, q] of questions.entries()) {
    if (!q.text?.trim())
      return res.status(422).json({ message: `Question ${i + 1}: text is required` })
    if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(o => !o?.trim()))
      return res.status(422).json({ message: `Question ${i + 1}: exactly 4 non-empty options required` })
    if (typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3)
      return res.status(422).json({ message: `Question ${i + 1}: correct must be 0–3` })
  }

  const quiz = await Quiz.create({
    roomId:    req.params.id,
    title:     title.trim(),
    createdBy: { _id: req.user._id, name: req.user.name },
    expiresAt: new Date(Date.now() + TWO_DAYS_MS),
    questions: questions.map(q => ({
      text:    q.text.trim(),
      options: q.options.map(o => o.trim()),
      correct: q.correct,
    })),
  })
  res.status(201).json({ quiz: sanitiseQuiz(quiz, req.user._id) })
}

/* POST /api/rooms/:id/quizzes/:quizId/submit */
async function submitQuiz(req, res) {
  const { error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const quiz = await Quiz.findOne({ _id: req.params.quizId, roomId: req.params.id })
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' })
  if (quiz.expiresAt < new Date()) return res.status(410).json({ message: 'This quiz has expired' })

  const already = quiz.submissions.find(s => s.user._id.toString() === req.user._id.toString())
  if (already)
    return res.status(409).json({ message: 'Already attempted', score: already.score })

  const { answers } = req.body
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length)
    return res.status(422).json({ message: `Expected ${quiz.questions.length} answers` })

  const score = quiz.questions.reduce((sum, q, i) => sum + (answers[i] === q.correct ? 1 : 0), 0)

  quiz.submissions.push({
    user:    { _id: req.user._id, name: req.user.name },
    answers,
    score,
    submittedAt: new Date(),
  })
  await quiz.save()

  res.status(200).json({
    score,
    total: quiz.questions.length,
    quiz:  sanitiseQuiz(quiz, req.user._id),
  })
}

/* DELETE /api/rooms/:id/quizzes/:quizId */
async function deleteQuiz(req, res) {
  const { error, status } = await requireMember(req.params.id, req.user._id)
  if (error) return res.status(status).json({ message: error })

  const quiz = await Quiz.findOne({ _id: req.params.quizId, roomId: req.params.id })
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' })
  if (quiz.createdBy._id.toString() !== req.user._id.toString())
    return res.status(403).json({ message: 'Only the quiz creator can delete it' })

  await quiz.deleteOne()
  res.status(200).json({ message: 'Quiz deleted' })
}

module.exports = { getQuizzes, createQuiz, submitQuiz, deleteQuiz }
