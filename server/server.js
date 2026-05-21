const express = require('express')
const cors = require('cors')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const http = require('http')
const { Server } = require('socket.io')

const app = express()

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: '*'
  }
})

const clientPath = path.join(__dirname, '..', 'client')
const uploadsPath = path.join(__dirname, 'uploads')
const DB_FILE = path.join(__dirname, 'db.json')

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath)
}

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify({
      territories: [],
      markers: []
    }, null, 2)
  )
}

app.use(cors())

app.use(express.json({
  limit: '100mb'
}))

app.use(express.urlencoded({
  extended: true,
  limit: '100mb'
}))

app.use(express.static(clientPath))

app.use('/uploads', express.static(uploadsPath))

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsPath)
  },

  filename: (req, file, cb) => {
    cb(
      null,
      Date.now() + '-' + file.originalname
    )
  }
})

const upload = multer({ storage })

function readDatabase() {
  return JSON.parse(
    fs.readFileSync(DB_FILE, 'utf8')
  )
}

function writeDatabase(data) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(data, null, 2)
  )
}

let activeLocks = {}
let onlineUsers = {}

io.on('connection', socket => {

  console.log('USER CONNECTED:', socket.id)

  onlineUsers[socket.id] = {
    id: socket.id,
    name: 'User-' + socket.id.slice(0, 4)
  }

  io.emit(
    'users-update',
    Object.values(onlineUsers)
  )

  io.emit(
    'locks-update',
    activeLocks
  )

  socket.on('cursor-move', data => {

    socket.broadcast.emit(
      'cursor-update',
      {
        id: socket.id,
        x: data.x,
        y: data.y
      }
    )
  })

  socket.on('request-lock', territoryId => {

    if (
      activeLocks[territoryId]
      &&
      activeLocks[territoryId] !== socket.id
    ) {
      return
    }

    activeLocks[territoryId] = socket.id

    io.emit(
      'locks-update',
      activeLocks
    )
  })

  socket.on('release-lock', territoryId => {

    if (
      activeLocks[territoryId] === socket.id
    ) {
      delete activeLocks[territoryId]
    }

    io.emit(
      'locks-update',
      activeLocks
    )
  })

  socket.on('force-save', payload => {

    try {

      writeDatabase({
        territories: payload.territories || [],
        markers: payload.markers || []
      })

      socket.broadcast.emit(
        'live-update',
        payload
      )

    } catch (err) {
      console.error(err)
    }
  })

  socket.on('disconnect', () => {

    console.log('USER DISCONNECTED:', socket.id)

    delete onlineUsers[socket.id]

    Object.keys(activeLocks).forEach(id => {

      if (
        activeLocks[id] === socket.id
      ) {
        delete activeLocks[id]
      }
    })

    io.emit(
      'users-update',
      Object.values(onlineUsers)
    )

    io.emit(
      'locks-update',
      activeLocks
    )
  })
})

app.get('/territories', (req, res) => {

  try {

    const data = readDatabase()

    res.json(data)

  } catch (err) {

    console.error(err)

    res.status(500).json({
      success: false
    })
  }
})

app.post('/territories', (req, res) => {

  try {

    const payload = {
      territories: req.body.territories || [],
      markers: req.body.markers || []
    }

    writeDatabase(payload)

    io.emit(
      'live-update',
      payload
    )

    res.json({
      success: true
    })

  } catch (err) {

    console.error(err)

    res.status(500).json({
      success: false
    })
  }
})

app.post(
  '/upload',
  upload.single('file'),
  (req, res) => {

    try {

      res.json({
        success: true,
        path: '/uploads/' + req.file.filename
      })

    } catch (err) {

      console.error(err)

      res.status(500).json({
        success: false
      })
    }
  }
)

app.get('*', (req, res) => {

  res.sendFile(
    path.join(clientPath, 'index.html')
  )
})

const PORT = process.env.PORT || 3000

server.listen(PORT, () => {

  console.log('=====================')
  console.log('SERVER ONLINE')
  console.log('PORT:', PORT)
  console.log('=====================')
})