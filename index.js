var ColuAccess = require('colu-access')
var bodyParser = require('body-parser')
var mongoose = require('mongoose')
var express = require('express')
var SHA1 = require('sha1')
var path = require('path')
var fs = require('fs')
var app = express()
var status = 'closed'
var dbUser = process.env.DB_USER
var dbPass = process.env.DB_PASS
var dbURI = process.env.DB_URI
var coluAccess
var options = {
  server: {
    socketOptions: {
      keepAlive: 1,
      connectTimeoutMS: 30000
    }
  },
  replset: {
    socketOptions: {
      keepAlive: 1,
      connectTimeoutMS: 30000
    }
  },
  user: dbUser,
  pass: dbPass
}

function getAdminTokens (cb) {
  var arr = []
  User.find({ type: 'admin' }, function (err, admins) {
    if (err) return cb(err)
    for (var i in admins) {
      var admin = admins[i]
      arr.push(SHA1(admin.assetId + admin._id))
    }
    cb(null, arr)
  })
}

function getOneAdminToken (username, cb) {
  User.findOne({ type: 'admin', username: username }, function (err, admin) {
    if (err) return cb(err)
    cb(null, SHA1(admin.assetId + admin._id))
  })
}

var userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  phone: String,
  email: String,
  type: { type: String, default: 'user' },
  username: { type: String, required: false },
  assetId: { type: String, required: false }
})
var User = mongoose.model('User', userSchema)

var entranceSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  date: Date,
  result: Boolean,
  username: String
})
var Entrance = mongoose.model('Entrance', entranceSchema)

var systemSchema = new mongoose.Schema({
  privateSeed: String,
  adminName: String
})
var System = mongoose.model('System', systemSchema)

app.use(bodyParser.json())
app.set('view engine', 'hjs')
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})
app.use('/api/:route', function (req, res, next) {
  if (req.params.route !== 'adlog' &&
      req.params.route !== 'get_users' &&
      req.params.route !== 'login' &&
      req.params.route !== 'status') {
    getAdminTokens(function (err, tokenArray) {
      if (err) { res.status(500); return res.send(err) }
      if (!req.query.token) {
        res.status(400)
        res.send({ message: 'A token is required' })
        res.end()
      } else {
        for (var i in tokenArray) {
          var token = tokenArray[i]
          if (req.query.token === token) {
            next()
          } else {
            res.status(401)
            res.send({ message: 'You need to be authorized to see this page' })
            res.end()
          }
        }
      }
    })
  } else {
    next()
  }
})

app.use('/qr', function (req, res, next) {
  getAdminTokens(function (err, tokenArray) {
    if (err) { res.status(500); return res.send(err) }
    if (!req.query.token) {
      res.redirect('/')
      res.end()
    } else {
      for (var i in tokenArray) {
        var token = tokenArray[i]
        if (req.query.token === token) {
          next()
        } else {
          res.status(401)
          res.send({ message: 'You need to be authorized to see this page' })
          res.end()
        }
      }
    }
  })
})

app.use('/list', function (req, res, next) {
  getAdminTokens(function (err, tokenArray) {
    if (err) { res.status(500); return res.send(err) }
    if (!req.query.token) {
      res.redirect('/')
      res.end()
    } else {
      for (var i in tokenArray) {
        var token = tokenArray[i]
        if (req.query.token === token) {
          next()
        } else {
          res.status(401)
          res.send({ message: 'You need to be authorized to see this page' })
          res.end()
        }
      }
    }
  })
})

app.get('/api/status', function (req, res) {
  if (status === 'pending') {
    status = 'open'
    setTimeout(function () {status = 'closed'}, 5000)
    return res.send('pending')
  }
  return res.send(status)
})

/**
 * Index route
 * Method: GET
 */
app.get('/admin', function (req, res) {
  res.render('index', { route: fs.readFileSync(path.join(__dirname, 'templates/login.html')).toString() })
})

/**
 * QR test / emergency route
 * Method: GET
 */
app.get('/qr', function (req, res) {
  res.render('index', { route: fs.readFileSync(path.join(__dirname, 'templates/qr.html')).toString() })
})

/**
 * TableView route
 * Method: GET
*/
app.get('/list', function (req, res) {
  res.render('index', { route: fs.readFileSync(path.join(__dirname, 'templates/tableview.html')).toString() })
})

/**
 * Intercom route
 * Method: GET
*/
app.get('/', function (req, res) {
  res.render('index', { route: fs.readFileSync(path.join(__dirname, 'templates/intercom.html')).toString() })
})

/**
 * CSS route
 * Method: GET
 * Param (string): filename - The file's name
 */
app.get('/css/:filename', function (req, res) {
  res.sendFile(path.join(__dirname, 'public/css/' + req.params.filename))
})

/**
 * JS route
 * Method: GET
 * Param (string): filename - The file's name
 */
app.get('/js/:filename', function (req, res) {
  res.sendFile(path.join(__dirname, 'public/js/' + req.params.filename))
})

/**
 * Templates route
 * Method: GET
 * Param (string): filename - The file's name
 */
app.get('/templates/:filename', function (req, res) {
  res.sendFile(path.join(__dirname, 'templates/' + req.params.filename))
})

/**
 * Pi scripts route
 * Method: GET
 * Param (string): filename - The file's name
 */
app.get('/pi/:filename', function (req, res) {
  if (req.params.filename === 'install') {
    res.sendFile(path.join(__dirname, 'public/python/install.sh'))
  } else if (req.params.filename === 'py') {
    res.sendFile(path.join(__dirname, 'public/python/door.py'))
  } else if (req.params.filename === 'py2') {
    res.sendFile(path.join(__dirname, 'public/python/test.py'))
  } else {
    res.send({ error: 'Could not find the requested file' })
  }
})

/**
 * SVG route
 * Method: GET
 * Param (string): filename - The file's name
 */
app.get('/svg/:filename', function (req, res) {
  res.sendFile(path.join(__dirname, 'public/svg/' + req.params.filename))
})

/**
 * Get users route
 * Method: GET
*/
app.get('/api/get_users', function (req, res) {
  User.find({}, function (err, users) {
    if (err) { res.status(500); return res.send(err) }
    res.json(users)
  })
})

/**
 * Admin login route
 * Method: POST
 * Param (string): username - The admin username for this system
 */
app.post('/api/adlog', function (req, res) {
  var body = req.body
  console.log(body)
  User.findOne({ username: body.username }, function (err, admin) {
    if (err) {
      res.status(500)
      return res.send(err)
    }
    if (admin === null) {
      res.status(400)
      res.send({ message: 'Username is wrong, try again.' })
    } else {
      var userName = admin.username
      coluAccess.verifyUser(userName, admin.assetId, function (err, data) {
        if (err) { res.status(500); return res.send(err) }
        if (data && data !== undefined && data !== null && data !== '') {
          console.log('lkjznbdasjdbhkasdbams')
          getOneAdminToken(admin.username, function (err, token) {
            if (err) {
              res.status(500)
              return res.send(err)
            }
            console.log(token)
            res.send({ message: 'Admin verified', data: data, user: admin, token: token })
          })
        }
      })
    }
  })
})

/**
 * Login route
 * Method: POST
 * Param (string): userName - The user's name
 */
app.post('/api/login', function (req, res) {
  var body = req.body
  var date = new Date()
  var data = {}
  data.assetId = body.assetId
  if (body.userName) {
    data.firstName = body.userName.split(' ')[0]
    data.lastName = body.userName.split(' ')[1]
  }
  User.findOne(data, function (err, user) {
    if (err) return res.send(err, 500)
    var userName = user.firstName + ' ' + user.lastName
    console.log(user)
    coluAccess.verifyUser(userName, user.assetId, function (err, data) {
      var entrance = new Entrance({
        firstName: user.firstName,
        lastName: user.lastName,
        date: date,
        result: false,
        username: body.userName
      })
      console.log(err, data)
      if (err) {
        res.status(500)
        entrance.save()
        return res.send(err)
      }
      if (data && data !== undefined && data !== null && data !== '') {
        status = 'pending'
        entrance.result = true
        entrance.save()
        res.json({ message: 'User verified', data: data, user: user })
      }
    })
  })
})

app.post('/api/delete_user', function (req, res) {
  if (req.body && req.body !== {} && req.body !== null && req.body !== '' && req.body !== undefined) {
    User.remove(req.body, function (err) {
      if (err) {
        res.status(500)
        return res.send(err)
      }
      res.json({ message: 'Deleted ' + req.body.firstName + ' ' + req.body.lastName + ' from the DB', data: req.body })
    })
  }
})

/**
 * Verify Users route
 * Method: POST
 */
app.post('/api/verify_users', function (req, res) {
  User.find({}, function (err, users) {
    if (err) { res.status(500); return res.send(err) }
    users.forEach(function (u) {
      if (err) { res.status(500); return res.send(err) }
      if (u.type === 'user') {
        var userName = u.firstName + ' ' + u.lastName
        console.log(u)
        coluAccess.verifyUser(userName, u.assetId, function (err, data) {
          if (err) { res.status(500); return res.send(err) }
          if (data && data !== undefined && data !== null && data !== '') {
            res.send({ message: 'User verified', data: data, user: u })
          }
        })
      }
    })
  })
})

/**
 * Get QR Code route
 * Method: POST
 * Param (string): firstName - The user's first name
 * Param (string): lastName - The user's last name
 * Param (string): phoneNumber - The user's phone number
*/
app.post('/api/get_qr', function (req, res) {
  var body = req.body
  var firstName = body.firstName
  var lastName = body.lastName
  var regMsg = coluAccess.createRegistrationMessage(firstName + ' ' + lastName)
  coluAccess.getRegistrationQR(regMsg, function (err, code, qr) {
    if (err) return res.send(err, 500)
    res.send({ base64data: qr, regMsg: JSON.stringify(regMsg), code: code, user: body })
  })
})

/**
 * Signup route
 * Method: POST
 * Param (string): firstName - The user's first name
 * Param (string): lastName - The user's last name
 * Param (string): phoneNumber - The user's phone number
 * Param (string): regMsg - The user's registration message
*/
app.post('/api/signup', function (req, res) {
  var body = req.body
  var regMsg = decodeURIComponent(body.regMsg)
  regMsg = JSON.parse(regMsg)
  var code = body.code
  var args = {
    registrationMessage: regMsg,
    code: code
  }
  coluAccess.registerUser(args, function (err, data) {
    if (err) return res.send(err, 500)
    body.assetId = data.assetId
    var form = {
      firstName: body.user.firstName,
      lastName: body.user.lastName,
      phone: body.user.phone,
      email: body.user.email,
      type: body.user.type,
      username: body.user.username,
      assetId: data.assetId
    }
    User.update(form, form, { upsert: true }, function (err, user) {
      if (err) return res.send(err, 500)
      res.json({ message: 'User registered', data: data })
    })
  })
})

mongoose.connection.on('open', function () {
  console.log('Connected to DB')
  User.findOne({
    type: 'admin'
  }, function (err, admin) {
    if (err) throw err
    console.log('Admin found in DB, continuing...')
    console.log(admin)
    getOneAdminToken(admin.username, function (err, token) {
      if (err) throw err
      console.log('Admin token(s):', token)
      var colu_settings = {
        network: 'mainnet',
        privateSeed: process.env.PRIVATE_SEED,
        companyName: 'Smart Door',
        apiKey: process.env.API_KEY,
        issuerHomepage: process.env.ISSUE_URL || null
      }
      if (!colu_settings.privateSeed) {
        System.findOne({userName: 'coluadmin'}, function (err, system) {
          if (err) return console.log(err)
          if (system && system.privateSeed) colu_settings.privateSeed = system.privateSeed
          if (!system) system = new System({userName: 'coluadmin'})
          coluAccess = new ColuAccess(colu_settings)
          system.privateSeed = coluAccess.colu.hdwallet.getPrivateSeed()
          system.save(function (err) {
            if (err) return console.log(err)
            coluAccess.init(function () {
              console.log('ColuAccess initialized with seed:', coluAccess.colu.hdwallet.getPrivateSeed())
              app.listen(process.env.PORT || 5000, function () {
                console.log('Listening on port', process.env.PORT || 5000)
              })
            })
          })
        })
      } else {
        coluAccess = new ColuAccess(colu_settings)
        coluAccess.init(function () {
          console.log('ColuAccess initialized with seed:', coluAccess.colu.hdwallet.getPrivateSeed())
          app.listen(process.env.PORT || 5000, function () {
            console.log('Listening on port', process.env.PORT || 5000)
          })
        })
      }
    })
  })
})

mongoose.connection.on('error', function (err) {
  console.log('err', err)
})

mongoose.connect(dbURI, options)
