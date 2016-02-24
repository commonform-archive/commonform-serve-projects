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
  function(request, response) {
    if (request.method === 'POST') {
      var handler = requireAuthorization(
        function(request, response, store, params) {
          request.pipe(concat(function(buffer) {
            json(buffer, function(error, value) {
              if (error) {
                response.statusCode = 400
                response.end() }
              else {
                if (value.hasOwnProperty('form')) {
                  var publisher = params.publisher
                  var project = params.project
                  var edition = params.edition
                  store.putProject(
                    publisher,
                    project,
                    edition,
                    value.form,
                    function(error) {
                      if (error) {
                        response.statusCode = 500
                        response.end() }
                      else {
                        response.statusCode = 201
                        response.setHeader(
                          'Location',
                          ( '/publishers/' + publisher +
                            '/projects/' + project +
                            '/editions/' + edition ))
                        response.end() } }) }
                else {
                  response.statusCode = 400
                  response.end() } } }) })) })
      handler.apply(this, arguments) }
    else if (request.method === 'GET') {
      response.end() } })

function serveProjects(log, level) {
  var store = projectStore(level)
  return function(request, response) {
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
            response.statuCode = 500
            response.end() }
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
