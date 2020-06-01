import mongoose from 'mongoose'

export const User = mongoose.model('User', {
  name: {
    type: String,
    unique: true
  },
  email: {
    type: String,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex')
  }
})

export const Message = mongoose.model('Message', {
  message : {
    type: String,
    required: true
  },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
})
