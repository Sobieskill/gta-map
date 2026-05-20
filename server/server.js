const express = require('express')
const cors = require('cors')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const http = require('http')
const { Server } = require('socket.io')

const app = express()

// ======================
// HTTP SERVER
// ======================

const server =
  http.createServer(app)

const io =
  new Server(server, {
    cors: {
      origin: '*'
    }
  })

// ======================
// PATHS
// ======================

const clientPath =
  path.join(
    __dirname,
    '..',
    'client'
  )

const uploadsPath =
  path.join(
    __dirname,
    'uploads'
  )

const DB_FILE =
  path.join(
    __dirname,
    'db.json'
  )

// ======================
// CREATE FILES/FOLDERS
// ======================

if (
  !fs.existsSync(
    uploadsPath
  )
) {

  fs.mkdirSync(
    uploadsPath
  )
}

if (
  !fs.existsSync(
    DB_FILE
  )
) {

  fs.writeFileSync(

    DB_FILE,

    JSON.stringify({

      territories: [],
      markers: []

    }, null, 2)
  )
}

// ======================
// MIDDLEWARE
// ======================

app.use(cors())

app.use(
  express.json({
    limit:'100mb'
  })
)

app.use(
  express.urlencoded({
    extended:true,
    limit:'100mb'
  })
)

// ======================
// STATIC FILES
// ======================

app.use(
  express.static(
    clientPath
  )
)

app.use(
  '/uploads',

  express.static(
    uploadsPath
  )
)

// ======================
// MULTER
// ======================

const storage =
  multer.diskStorage({

    destination:
      (req,file,cb) => {

        cb(
          null,
          uploadsPath
        )
      },

    filename:
      (req,file,cb) => {

        cb(

          null,

          Date.now()
          + '-'
          + file.originalname
        )
      }
  })

const upload =
  multer({
    storage
  })

// ======================
// SOCKET.IO
// ======================

io.on(
  'connection',

  socket => {

    console.log(
      'USER CONNECTED:',
      socket.id
    )

    socket.on(
      'disconnect',

      () => {

        console.log(
          'USER DISCONNECTED:',
          socket.id
        )
      }
    )
  }
)

// ======================
// GET DATA
// ======================

app.get(
  '/territories',

  (req,res) => {

    try {

      const data =
        JSON.parse(

          fs.readFileSync(
            DB_FILE,
            'utf8'
          )
        )

      res.json(data)

    } catch(err) {

      console.error(err)

      res.status(500).json({
        success:false
      })
    }
  }
)

// ======================
// SAVE DATA
// ======================

app.post(
  '/territories',

  (req,res) => {

    try {

      const payload = {

        territories:
          req.body
            .territories || [],

        markers:
          req.body
            .markers || []
      }

      fs.writeFileSync(

        DB_FILE,

        JSON.stringify(
          payload,
          null,
          2
        )
      )

      io.emit(
        'live-update',
        payload
      )

      console.log(
        'SAVE OK'
      )

      res.json({
        success:true
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
// UPLOAD
// ======================

app.post(
  '/upload',

  upload.single('file'),

  (req,res) => {

    try {

      res.json({

        success:true,

        path:
          '/uploads/'
          +
          req.file.filename
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
// FRONTEND ROUTE
// ======================

app.get(
  '*',

  (req,res) => {

    res.sendFile(

      path.join(
        clientPath,
        'index.html'
      )
    )
  }
)

// ======================
// START SERVER
// ======================

const PORT =
  process.env.PORT || 3000

server.listen(
  PORT,

  () => {

    console.log(
      '====================='
    )

    console.log(
      'SERVER ONLINE'
    )

    console.log(
      'PORT:',
      PORT
    )

    console.log(
      '====================='
    )
  }
)