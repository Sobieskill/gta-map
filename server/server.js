const express = require('express')
const cors = require('cors')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const http = require('http')
const { Server } = require('socket.io')

const app = express()

// ======================
// STATIC CLIENT
// ======================

app.use(
  express.static(
    path.join(
      __dirname,
      '../client'
    )
  )
)

// ======================
// HTTP + SOCKET.IO
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
// MIDDLEWARE
// ======================

app.use(cors())

app.use(
  express.json({
    limit:'100mb'
  })
)

// ======================
// UPLOADS
// ======================

const uploadsPath =
  path.join(
    __dirname,
    'uploads'
  )

if (
  !fs.existsSync(
    uploadsPath
  )
) {

  fs.mkdirSync(
    uploadsPath
  )
}

app.use(
  '/uploads',

  express.static(
    uploadsPath
  )
)

// ======================
// DATABASE
// ======================

const DB_FILE =
  path.join(
    __dirname,
    'db.json'
  )

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
// ACTIVE LOCKS
// ======================

const activeLocks = {}

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

    socket.emit(
      'locks-update',
      activeLocks
    )

    socket.on(
      'request-lock',

      id => {

        if (

          activeLocks[id]
          &&

          activeLocks[id]
          !== socket.id

        ) {

          socket.emit(
            'lock-denied',
            id
          )

          return
        }

        activeLocks[id] =
          socket.id

        io.emit(
          'locks-update',
          activeLocks
        )
      }
    )

    socket.on(
      'release-lock',

      id => {

        if (

          activeLocks[id]
          === socket.id

        ) {

          delete activeLocks[id]

          io.emit(
            'locks-update',
            activeLocks
          )
        }
      }
    )

    socket.on(
      'disconnect',

      () => {

        Object.keys(
          activeLocks
        ).forEach(id => {

          if (

            activeLocks[id]
            === socket.id

          ) {

            delete activeLocks[id]
          }
        })

        io.emit(
          'locks-update',
          activeLocks
        )

        console.log(
          'USER DISCONNECTED:',
          socket.id
        )
      }
    )
  }
)

// ======================
// MAIN PAGE
// ======================

app.get(
  '/',

  (req,res) => {

    res.sendFile(

      path.join(
        __dirname,
        '../client/index.html'
      )
    )
  }
)

// ======================
// GET TERRITORIES
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

      console.error(
        'GET ERROR:',
        err
      )

      res.status(500).json({
        success:false
      })
    }
  }
)

// ======================
// SAVE TERRITORIES
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

      console.error(
        'SAVE ERROR:',
        err
      )

      res.status(500).json({
        success:false
      })
    }
  }
)

// ======================
// UPLOAD LOGO
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

      console.error(
        'UPLOAD ERROR:',
        err
      )

      res.status(500).json({
        success:false
      })
    }
  }
)

// ======================
// SERVER START
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