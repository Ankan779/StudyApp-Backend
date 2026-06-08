const mongoose = require('mongoose')

async function connectDB() {
  const uri = process.env.MONGO_URI?.trim()
  if (!uri) {
    console.error('MongoDB connection error: MONGO_URI is not defined in backend/.env')
    process.exit(1)
  }

  try {
    const conn = await mongoose.connect(uri, {
      dbName: process.env.MONGO_DB_NAME?.trim() || undefined,
    })
    console.log(`MongoDB connected: ${conn.connection.host}`)
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`)
    process.exit(1)
  }
}

module.exports = connectDB
