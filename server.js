import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'
import crypto from 'crypto'
import bcrypt from 'bcrypt-nodejs'
import {User, Message} from './model'

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/forum"
mongoose.connect(mongoUrl, {useCreateIndex: true, useNewUrlParser: true, useUnifiedTopology: true })
//mongoose.set('useCreateIndex', true);
mongoose.Promise = Promise



// Defines the port the app will run on. Defaults to 8080, but can be 
// overridden when starting the server. For example:
//
//   PORT=9000 npm start
const port = process.env.PORT || 8080
const app = express()

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(bodyParser.json())

const authenticateUser = async (req, res, next) => {
  try {
    const user = await User.findOne({
      accessToken: req.header('Authorization')

    })
    console.log(req.header('Authorization'))
    if (user) {
      req.user = user
      next()
    } else {
      res.status(401).json({ loggedOut: true, message: "Please try logging in again" })
    }
  } catch (err) {
    res
      .status(403)
      .json({ message: 'access token missing or wrong', errors: err.errors })
  }
}
// Start defining your routes here
app.get('/', (req, res) => {
  res.send('Hello world')
})
app.get('/users', async (req, res) => {
  const users = await User.find()
  res.json(users)
})

app.post('/users', async (req, res) => {
  try {
    const { name, password } = req.body
    if(password){
      const user = new User({ name, password: bcrypt.hashSync(password) })
    const saved = await user.save()
    res.status(201).json(saved)
    }
    else {
      throw "you have to have a password"
    }
    
  } catch (err) {
    res.status(400).json({ message: 'Could not save user 1', errors: err })
  }
})


app.get('/users/:id', authenticateUser)
app.get('/users/:id', (req, res) => {
  try {
    res.status(201).json({name:req.user.name})
  } catch (err) {
    res.status(400).json({ message: 'could not save user 2', errors: err.errors })
  }
})
app.delete('/users/:id', async (req, res)=>{
  const {id} = req.params
 try {
  await User.findOneAndDelete({ _id: id })
  res.json({message:`thought with id:${id} was delted`})
  }
  catch(err) {
    res.status(400).json({message: "thought could not be deleted", error: err})
  }
})

app.get('/users/:id/messages',  authenticateUser)
app.get('/users/:id/messages', async (req, res)=>{
try {
  const user = await User.findById(req.user._id).exec()
  const messages = await Message.find({user:mongoose.Types.ObjectId(user.id)})
  if(messages.length){
    res.status(200).json(messages) 
  }
 else{
   throw "Sorry no messages"
 }
}
catch(err){
  res.status(400).json({error:err})
}
})
app.post('/users/:id/messages', authenticateUser)
app.post('/users/:id/messages', async (req, res)=>{
  try{
    const {message} = req.body
    const user = await User.findById(req.user._id).exec() 
    const newMessage = await new Message({message, user }).save()
    res.status(201).json({message:newMessage.message, user:newMessage.user.name })
  }
  catch (err){
    res.status(400).json({error:err})
  }

})

app.post('/sessions', async (req, res) => {
  const user = await User.findOne({ name: req.body.name })

  if (user && bcrypt.compareSync(req.body.password, user.password)) {
    res.json({ userId: user._id, accessToken: user.accessToken })
  } else {
    res.json({ notFound: true })
  }
})
app.get('/messages', async (req, res) => {
  try{
    const messages = await Message.find()
    if(messages.length){
      res.status(200).json(messages)
    }
    else {
      throw "you have no messages"
    }
  }
  catch (err){
    res.status(400).json({error:err})
  }
  
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
