module.exports = serveProjects

var bcrypt = require('bcrypt-password')
var concat = require('concat-stream')
var fs = require('fs')
var json = require('json-parse-errback')
var meta = require('./package.json')
var parse = require('url').parse
var path = require('path')
var projectStore = require('level-commonform-projects')
var some = require('async-some')
var uuid = require('uuid')

var hash = new (require('http-hash'))()

hash.set(
  '/',
  function(request, response) {
    response.end(
      JSON.stringify(
        { service: meta.name,
          version: meta.version })) })

hash.set(
  '/publishers/:publisher/projects/:project/editions/:edition',
  function(request, response, store, params) {
    var publisher = params.publisher
    var project = params.project
    var edition = params.edition
    if (request.method === 'POST') {
      var handler = requireAuthorization(
        function(request, response, store) {
          request.pipe(concat(function(buffer) {
            json(buffer, function(error, value) {
              if (error) {
                request.log.info('Invalid JSON')
                respond400(response) }
              else {
                if (value.hasOwnProperty('form')) {
                  store.putProject(
                    publisher,
                    project,
                    edition,
                    value.form,
                    function(error) {
                      if (error) {
                        if (/exists/.test(error.message)) {
                          response.statusCode = 409
                          response.end() }
                        else {
                          respond500(request, response, error) } }
                      else {
                        response.statusCode = 201
                        response.setHeader(
                          'Location',
                          ( '/publishers/' + publisher +
                            '/projects/' + project +
                            '/editions/' + edition ))
                        response.end() } }) }
                else {
                  respond400(response) } } }) })) })
      handler.apply(this, arguments) }
    else if (request.method === 'GET') {
      store.getProject(
        publisher,
        project,
        edition,
        function(error, project) {
          if (error) {
            respond500(request, response, error) }
          else {
            if (project) {
              response.setHeader('Content-Type', 'application/json')
              response.end(JSON.stringify(project)) }
            else {
              response.statusCode = 404
              response.end() } } }) }
    else {
      response.statusCode = 405
      response.end() }})

hash.set(
  '/publishers/:publisher/projects/:project/editions/:edition/form',
  function(request, response, store, params) {
    var publisher = params.publisher
    var project = params.project
    var edition = params.edition
    if (request.method === 'GET') {
      store.getProject(
        publisher,
        project,
        edition,
        function(error, project) {
          if (error) {
            respond500(request, response, error) }
          else {
            if (project) {
              response.statusCode = 301
              response.setHeader(
                'Location',
                ( 'https://api.commonform.org/forms/' + project.form ))
              response.end() }
            else {
              response.statusCode = 404
              response.end() } } }) }
    else {
      response.statusCode = 405
      response.end() }})

hash.set(
  '/forms/:form/projects',
  function(request, response, store, params) {
    var form = params.form
    if (request.method === 'GET') {
      store.getProjects(form, function(error, projects) {
        if (error) {
          respond500(request, response, error) }
        else {
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(projects)) } }) }
    else {
      response.statusCode = 405
      response.end() }})

function serveProjects(log, level) {
  var store = projectStore(level)
  return function(request, response) {
    // Create a request-specific logger.
    request.log = log(uuid.v4())
    request.log.info(request)
    request.once('end', function() {
      request.log.info({ event: 'end', status: response.statusCode }) })
    // Respond.
    var parsed = parse(request.url, true)
    var route = hash.get(parsed.path)
    if (route.handler) {
      route.handler(request, response, store, route.params, route.splat) }
    else {
      response.statusCode = 404
      response.end() } } }

function requireAuthorization(handler) {
  return function(request, response, store, params) {
    var handlerArguments = arguments
    var publisher = params.publisher
    var authorization = request.headers.authorization
    if (authorization) {
      var parsed = parseAuthorization(authorization)
      if (parsed === false || parsed.user !== publisher) {
        respond401(response) }
      else {
        checkPassword(publisher, parsed.password, function(error, valid) {
          if (error) {
            respond500(request, response, error) }
          else {
            if (valid) {
              handler.apply(this, handlerArguments) }
            else {
              respond401(response) } } }) } }
    else {
      respond401(response) } } }

function respond401(response) {
  response.statusCode = 401
  response.setHeader('WWW-Authenticate', 'Basic realm="Common Form"')
  response.end() }

var usersFile =
  ( process.env.USERS
      ? process.env.USERS
      : path.join(process.cwd(), '.users') )

function checkPassword(publisher, password, callback) {
  fs.readFile(usersFile, 'utf8', function(error, content) {
    some(
      content.split('\n'),
      function(line, done) {
        var components = line.split(':')
        if (components[0] !== publisher) {
          done(null, false) }
        else {
          bcrypt.check(password, components[1], function(error, match) {
            if (error) {
              done(match) }
            else {
              done(null, match) } }) } },
      function(error, match) {
        if (error) {
          callback(error) }
        else {
          callback(null, match) } }) }) }

function parseAuthorization(header) {
  var token = header.split(/\s/).pop()
  var decoded = new Buffer(token, 'base64').toString()
  var components = decoded.split(':')
  if (components.length !== 2) {
    return false }
  else {
    return {
      user: components[0],
      password: components[1] } } }

function respond500(request, response, error) {
  request.log.error(error)
  response.statusCode = 500
  response.end() }

function respond400(response) {
  response.statusCode = 400
  response.end() }
