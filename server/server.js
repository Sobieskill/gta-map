const cloudinary =
  require('cloudinary').v2

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
cloudinary.config({

  cloud_name:
    process.env
      .CLOUDINARY_CLOUD_NAME,

  api_key:
    process.env
      .CLOUDINARY_API_KEY,

  api_secret:
    process.env
      .CLOUDINARY_API_SECRET
})
// ======================
// CONFIG
// ======================

const PORT = process.env.PORT || 3000

const CLIENT_PATH = path.join(
  __dirname,
  '..',
  'client'
)

const UPLOADS_PATH = path.join(
  __dirname,
  'uploads'
)

const DB_FILE = path.join(
  __dirname,
  'db.json'
)

// ======================
// CREATE FILES/FOLDERS
// ======================

if (!fs.existsSync(UPLOADS_PATH)) {
  fs.mkdirSync(UPLOADS_PATH)
}

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(
      {
        territories: [],
        markers: []
      },
      null,
      2
    )
  )
}

// ======================
// HELPERS
// ======================

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

// ======================
// MIDDLEWARE
// ======================

app.use(cors())

app.use(
  express.json({
    limit: '100mb'
  })
)

app.use(
  express.urlencoded({
    extended: true,
    limit: '100mb'
  })
)

// ======================
// STATIC
// ======================

app.use(express.static(CLIENT_PATH))

app.use(
  '/uploads',
  express.static(UPLOADS_PATH)
)

// ======================
// MULTER
// ======================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_PATH)
  },

  filename: (req, file, cb) => {
    cb(
      null,
      Date.now() + '-' + file.originalname
    )
  }
})

const upload = multer({
  storage
})

// ======================
// REALTIME STATE
// ======================

let activeLocks = {}
let onlineUsers = {}

// ======================
// SOCKET.IO
// ======================

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

  // ======================
  // CURSORS
  // ======================

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

  // ======================
  // LOCKS
  // ======================

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
      activeLocks[territoryId]
      === socket.id
    ) {
      delete activeLocks[territoryId]
    }

    io.emit(
      'locks-update',
      activeLocks
    )
  })

  // ======================
  // LIVE SAVE
  // ======================

  socket.on('force-save', payload => {

    try {

      writeDatabase({
        territories:
          payload.territories || [],

        markers:
          payload.markers || []
      })

      socket.broadcast.emit(
        'live-update',
        payload
      )

    } catch (err) {

      console.error(err)
    }
  })

  // ======================
  // DISCONNECT
  // ======================

  socket.on('disconnect', () => {

    console.log('USER DISCONNECTED:', socket.id)

    delete onlineUsers[socket.id]

    Object.keys(activeLocks).forEach(id => {

      if (
        activeLocks[id]
        === socket.id
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

// ======================
// GET DATA
// ======================

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

// ======================
// SAVE DATA
// ======================

app.post('/territories', (req, res) => {

  try {

    const payload = {
      territories:
        req.body.territories || [],

      markers:
        req.body.markers || []
    }

    writeDatabase(payload)

    io.emit(
      'live-update',
      payload
    )

    console.log('SAVE OK')

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

// ======================
// UPLOAD
// ======================

app.post(
  '/upload',

  upload.single('file'),

  async (req,res) => {

    try {

      const result =
        await cloudinary
          .uploader
          .upload(
            req.file.path
          )

      fs.unlinkSync(
        req.file.path
      )

      res.json({

        success:true,

        path:
          result.secure_url
      })

    } catch(err) {

      console.error(err)

      res.status(500).json({
        success:false
      })
    }
  }
)

// ======================
// FRONTEND
// ======================

app.get('*', (req, res) => {

  res.sendFile(
    path.join(
      CLIENT_PATH,
      'index.html'
    )
  )
})

// ======================
// START
// ======================

server.listen(PORT, () => {

  console.log('=====================')
  console.log('SERVER ONLINE')
  console.log('PORT:', PORT)
  console.log('=====================')
})