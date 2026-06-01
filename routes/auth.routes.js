const express  = require('express')
const { body } = require('express-validator')

const { register, login, getMe, updateAccount } = require('../controllers/auth.controller')
const { protect } = require('../middleware/auth.middleware')

const router = express.Router()

/* ── Validation rules ── */
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').trim().notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('confirmPassword').notEmpty().withMessage('Please confirm your password'),
]

const loginRules = [
  body('email').trim().notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
]

const updateRules = [
  body('name').optional().trim()
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').optional().trim()
    .isEmail().withMessage('Please provide a valid email'),
  body('newPassword').optional()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
]

/* ── Routes ── */
router.post('/register', registerRules,  register)
router.post('/login',    loginRules,     login)
router.get('/me',        protect,        getMe)
router.patch('/update',  protect, updateRules, updateAccount)

module.exports = router
