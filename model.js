import mongoose from 'mongoose'
export const Author = mongoose.model('Author', {
  name: String
})

export const Book = mongoose.model('Book', {
  title: String,
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Author'
  }
})