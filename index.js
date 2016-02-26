/* Copyright 2016 Kyle E. Mitchell
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = serveProjects

var bcrypt = require('bcrypt-password')
var concat = require('concat-stream')
var fs = require('fs')
var hash = require('http-hash')
var json = require('json-parse-errback')
var parse = require('url').parse
var path = require('path')
var projectStore = require('level-commonform-projects')
var some = require('async-some')
var uuid = require('uuid')

var meta = JSON.stringify(
  { service: require('./package.json').name,
    version: require('./package.json').version })

var routes = { get: hash(), post: hash() }

routes.get.set('/', function(request, response) {
  response.end(meta) })

routes.post.set(
  '/publishers/:publisher/projects/:project/editions/:edition',
  function() {
    requireAuthorization(postProject).apply(this, arguments) })

routes.get.set(
  '/publishers/:publisher/projects/:project/editions/:edition',
  function() {
    getProject.apply(this, arguments) })

routes.get.set(
  '/publishers/:publisher/projects/:project/editions',
  function(request, response, store, parameters) {
    var publisher = parameters.publisher
    var project = parameters.project
    store.getEditions(publisher, project, function(error, editions) {
      if (error) {
        respond500(request, response, error) }
      else {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(editions)) } }) })

function postProject(request, response, store, parameters) {
  var publisher = parameters.publisher
  var project = parameters.project
  var edition = parameters.edition
  request.pipe(concat(function(buffer) {
    json(buffer, function(error, value) {
      if (error) {
        request.log.info('Invalid JSON')
        respond400(response, 'Invalid JSON') }
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
                else if (/project name/i.test(error.message)) {
                  response.statusCode = 400
                  response.end('Invalid project name') }
                else if (/edition/i.test(error.message)) {
                  response.statusCode = 400
                  response.end('Invalid edition') }
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
          respond400(response) } } }) })) }

function getProject(request, response, store, parameters) {
  var publisher = parameters.publisher
  var project = parameters.project
  var edition = parameters.edition
  var fetch
  if (edition === 'current') {
    fetch = store.getCurrentEdition.bind(store, publisher, project) }
  else if (edition === 'latest') {
    fetch = store.getLatestEdition.bind(store, publisher, project) }
  else {
    fetch = store.getProject.bind(store, publisher, project, edition) }
  fetch(function(error, project) {
    if (error) {
      respond500(request, response, error) }
    else {
      if (project) {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(project)) }
      else {
        response.statusCode = 404
        response.end() } } }) }

routes.get.set(
  '/publishers/:publisher/projects/:project/editions/:edition/form',
  function(request, response, store, parameters) {
    var publisher = parameters.publisher
    var project = parameters.project
    var edition = parameters.edition
    var fetch
    if (edition === 'current') {
      fetch = store.getCurrentEdition.bind(store, publisher, project) }
    else if (edition === 'latest') {
      fetch = store.getLatestEdition.bind(store, publisher, project) }
    else {
      fetch = store.getProject.bind(store, publisher, project, edition) }
    fetch(function(error, project) {
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
          response.end() } } }) })

routes.get.set(
  '/publishers',
  function(request, response, store) {
    store.getPublishers(function(error, publishers) {
      if (error) {
        respond500(request, response, error) }
      else {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(publishers)) } }) })

routes.get.set(
  '/publishers/:publisher/projects',
  function(request, response, store, parameters) {
    var publisher = parameters.publisher
    store.getPublisherProjects(publisher, function(error, projects) {
      if (error) {
        respond500(request, response, error) }
      else {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(projects)) } }) })

routes.get.set(
  '/forms/:form/projects',
  function(request, response, store, parameters) {
    var form = parameters.form
    store.getProjects(form, function(error, projects) {
      if (error) {
        respond500(request, response, error) }
      else {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(projects)) } }) })

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
    var hash = routes[request.method.toLowerCase()]
    if (hash) {
      var route = hash.get(parsed.path)
      if (route.handler) {
        route.handler(request, response, store, route.params, route.splat) }
      else {
        response.statusCode = 404
        response.end() } }
    else {
      response.statusCode = 405
      response.end() }} }

function requireAuthorization(handler) {
  return function(request, response, store, parameters) {
    var handlerArguments = arguments
    var publisher = parameters.publisher
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

function respond400(response, message) {
  response.statusCode = 400
  response.end(message || '') }
