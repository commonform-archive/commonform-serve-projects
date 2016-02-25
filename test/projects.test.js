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

var concat = require('concat-stream')
var http = require('http')
var series = require('async-series')
var server = require('./server')
var tape = require('tape')

tape('POST /publishers/$publisher/projects/$project/editions/$edition', function(test) {
  test.plan(2)
  var publisher = 'ana'
  var password = 'ana\'s password'
  var project = 'nda'
  var edition = '1e'
  var form = 'a'.repeat(64)
  var path =
    ( '/publishers/' + publisher +
      '/projects/' + project +
      '/editions/' + edition )
  server(function(port, done) {
    http.request(
      { auth: ( publisher + ':' + password ),
        method: 'POST',
        port: port,
        path: path },
      function(response) {
        test.equal(response.statusCode, 201, '201')
        test.equal(response.headers.location, path, 'Location')
        done()
        test.end() })
      .end(JSON.stringify({ form: form })) }) })

tape('POST /publishers/$publisher/projects/$invalid-project/editions/$edition', function(test) {
  test.plan(2)
  var publisher = 'ana'
  var password = 'ana\'s password'
  var project = 'no_underscores_allowed'
  var edition = '1e'
  var form = 'a'.repeat(64)
  var path =
    ( '/publishers/' + publisher +
      '/projects/' + project +
      '/editions/' + edition )
  server(function(port, done) {
    http.request(
      { auth: ( publisher + ':' + password ),
        method: 'POST',
        port: port,
        path: path },
      function(response) {
        test.equal(response.statusCode, 400, '400')
        response.pipe(concat(function(buffer) {
          test.equal(buffer.toString(), 'Invalid project name', 'Invalid name')
          done()
          test.end() })) })
      .end(JSON.stringify({ form: form })) }) })

tape('POST /publishers/$publisher/projects/$project/editions/$edition with invalid JSON', function(test) {
  test.plan(2)
  var publisher = 'ana'
  var password = 'ana\'s password'
  var project = 'nda'
  var edition = '1e'
  var form = 'a'.repeat(64)
  var path =
    ( '/publishers/' + publisher +
      '/projects/' + project +
      '/editions/' + edition )
  server(function(port, done) {
    http.request(
      { auth: ( publisher + ':' + password ),
        method: 'POST',
        port: port,
        path: path },
      function(response) {
        test.equal(response.statusCode, 400, '400')
        response.pipe(concat(function(buffer) {
          test.equal(buffer.toString(), 'Invalid JSON', 'Invalid JSON')
          done()
          test.end() })) })
      .end('The form is ' + form) }) })

tape('POST /publishers/$publisher/projects/$project/editions/$edition with bad password', function(test) {
  test.plan(1)
  var publisher = 'ana'
  var password = 'not ana\'s password'
  var project = 'nda'
  var edition = '1e'
  var form = 'a'.repeat(64)
  var path =
    ( '/publishers/' + publisher +
      '/projects/' + project +
      '/editions/' + edition )
  server(function(port, done) {
    http.request(
      { auth: ( publisher + ':' + password ),
        method: 'POST',
        port: port,
        path: path },
      function(response) {
        test.equal(response.statusCode, 401, '401')
        done()
        test.end() })
      .end(JSON.stringify({ form: form })) }) })

tape('POST /publishers/$publisher/projects/$project/editions/$existing', function(test) {
  test.plan(2)
  var publisher = 'ana'
  var password = 'ana\'s password'
  var project = 'nda'
  var edition = '1e'
  var form = 'a'.repeat(64)
  var path =
    ( '/publishers/' + publisher +
      '/projects/' + project +
      '/editions/' + edition )
  server(function(port, done) {
    var request =
      { auth: ( publisher + ':' + password ),
        method: 'POST',
        port: port,
        path: path }
    series(
      [ function putProject(done) {
          http.request(request, function(response) {
            test.equal(response.statusCode, 201, 'First POST 201')
            done() })
            .end(JSON.stringify({ form: form })) },
        function getProject(done) {
          http.request(request, function(response) {
            test.equal(response.statusCode, 409, 'Second POST 409')
            done() })
            .end(JSON.stringify({ form: form })) } ],
      function finish() {
        done()
        test.end() }) }) })

tape('GET /publishers/$publisher/projects/$project/editions/$nonexistent', function(test) {
  test.plan(1)
  var publisher = 'ana'
  var project = 'nda'
  var edition = '1e'
  server(function(port, done) {
    http.request(
      { method: 'GET',
        port: port,
        path:
          ( '/publishers/' + publisher +
            '/projects/' + project +
            '/editions/' + edition ) },
      function(response) {
        test.equal(response.statusCode, 404, '404')
        done()
        test.end() })
      .end() }) })

tape('GET /publishers/$publisher/projects/$project/editions/$existing', function(test) {
  test.plan(2)
  var publisher = 'ana'
  var password = 'ana\'s password'
  var project = 'nda'
  var edition = '1e'
  var form = 'a'.repeat(64)
  var path =
    ( '/publishers/' + publisher +
      '/projects/' + project +
      '/editions/' + edition )
  server(function(port, done) {
    series(
      [ function putProject(done) {
          http.request(
            { auth: ( publisher + ':' + password ),
              method: 'POST',
              port: port,
              path: path },
            function(response) {
              test.equal(response.statusCode, 201, 'POST 201')
              done() })
            .end(JSON.stringify({ form: form })) },
        function getProject(done) {
          http.request(
            { method: 'GET', port: port, path: path },
            function(response) {
              response.pipe(concat(function(buffer) {
                var responseBody = JSON.parse(buffer)
                test.equal(responseBody.form, form, 'GET project JSON')
                done() })) })
            .end() } ],
      function finish() {
        done()
        test.end() }) }) })

tape('GET /publishers/$publisher/projects', function(test) {
  test.plan(2)
  var publisher = 'ana'
  var password = 'ana\'s password'
  var project = 'nda'
  var edition = '1e'
  var form = 'a'.repeat(64)
  server(function(port, done) {
    series(
      [ function putProject(done) {
          http.request(
            { auth: ( publisher + ':' + password ),
              method: 'POST',
              port: port,
              path:
                ( '/publishers/' + publisher +
                  '/projects/' + project +
                  '/editions/' + edition ) },
            function(response) {
              test.equal(response.statusCode, 201, 'POST 201')
              done() })
            .end(JSON.stringify({ form: form })) },
        function getProject(done) {
          http.request(
            { method: 'GET',
              port: port,
              path: ( '/publishers/' + publisher + '/projects' ) },
            function(response) {
              response.pipe(concat(function(buffer) {
                var responseBody = JSON.parse(buffer)
                test.deepEqual(
                  responseBody,
                  [ project ],
                  'GET projects JSON')
                done() })) })
            .end() } ],
      function finish() {
        done()
        test.end() }) }) })

tape('GET /publishers/$publisher/projects/$project/editions/current', function(test) {
  test.plan(2)
  var publisher = 'ana'
  var password = 'ana\'s password'
  var project = 'nda'
  var edition = '2e'
  var form = 'a'.repeat(64)
  server(function(port, done) {
    series(
      [ function putProject(done) {
          http.request(
            { auth: ( publisher + ':' + password ),
              method: 'POST',
              port: port,
              path:
                ( '/publishers/' + publisher +
                  '/projects/' + project +
                  '/editions/' + edition ) },
            function(response) {
              test.equal(response.statusCode, 201, 'POST 201')
              done() })
            .end(JSON.stringify({ form: form })) },
        function getProject(done) {
          http.request(
            { method: 'GET',
              port: port,
              path:
                ( '/publishers/' + publisher +
                  '/projects/' + project +
                  '/editions/current' ) },
            function(response) {
              response.pipe(concat(function(buffer) {
                var responseBody = JSON.parse(buffer)
                test.equal(responseBody.form, form, 'GET project JSON')
                done() })) })
            .end() } ],
      function finish() {
        done()
        test.end() }) }) })

tape('GET /publishers/$publisher/projects/$project/editions/latest', function(test) {
  test.plan(2)
  var publisher = 'ana'
  var password = 'ana\'s password'
  var project = 'nda'
  var edition = '2e'
  var form = 'a'.repeat(64)
  server(function(port, done) {
    series(
      [ function putProject(done) {
          http.request(
            { auth: ( publisher + ':' + password ),
              method: 'POST',
              port: port,
              path:
                ( '/publishers/' + publisher +
                  '/projects/' + project +
                  '/editions/' + edition ) },
            function(response) {
              test.equal(response.statusCode, 201, 'POST 201')
              done() })
            .end(JSON.stringify({ form: form })) },
        function getProject(done) {
          http.request(
            { method: 'GET',
              port: port,
              path:
                ( '/publishers/' + publisher +
                  '/projects/' + project +
                  '/editions/latest' ) },
            function(response) {
              response.pipe(concat(function(buffer) {
                var responseBody = JSON.parse(buffer)
                test.equal(responseBody.form, form, 'GET project JSON')
                done() })) })
            .end() } ],
      function finish() {
        done()
        test.end() }) }) })

tape('GET /publishers/$publisher/projects/$project/editions/$existing/form', function(test) {
  test.plan(3)
  var publisher = 'ana'
  var password = 'ana\'s password'
  var project = 'nda'
  var edition = '1e'
  var form = 'a'.repeat(64)
  server(function(port, done) {
    series(
      [ function putProject(done) {
          http.request(
            { auth: ( publisher + ':' + password ),
              method: 'POST',
              port: port,
              path:
                ( '/publishers/' + publisher +
                  '/projects/' + project +
                  '/editions/' + edition ) },
            function(response) {
              test.equal(response.statusCode, 201, 'POST 201')
              done() })
            .end(JSON.stringify({ form: form })) },
        function getProject(done) {
          http.request(
            { method: 'GET',
              port: port,
              path:
                ( '/publishers/' + publisher +
                  '/projects/' + project +
                  '/editions/' + edition +
                  '/form' ) },
            function(response) {
              test.equal(response.statusCode, 301, 'GET 301')
              test.equal(
                response.headers.location,
                ( 'https://api.commonform.org/forms/' + form ),
                'GET api.commonform.org/forms/...')
              done() })
            .end() } ],
      function finish() {
        done()
        test.end() }) }) })

tape('GET /publishers/$publisher/projects/$project/editions/current/form', function(test) {
  test.plan(3)
  var publisher = 'ana'
  var password = 'ana\'s password'
  var project = 'nda'
  var edition = '1e'
  var form = 'a'.repeat(64)
  server(function(port, done) {
    series(
      [ function putProject(done) {
          http.request(
            { auth: ( publisher + ':' + password ),
              method: 'POST',
              port: port,
              path:
                ( '/publishers/' + publisher +
                  '/projects/' + project +
                  '/editions/' + edition ) },
            function(response) {
              test.equal(response.statusCode, 201, 'POST 201')
              done() })
            .end(JSON.stringify({ form: form })) },
        function getProject(done) {
          http.request(
            { method: 'GET',
              port: port,
              path:
                ( '/publishers/' + publisher +
                  '/projects/' + project +
                  '/editions/current/form' ) },
            function(response) {
              test.equal(response.statusCode, 301, 'GET 301')
              test.equal(
                response.headers.location,
                ( 'https://api.commonform.org/forms/' + form ),
                'GET api.commonform.org/forms/...')
              done() })
            .end() } ],
      function finish() {
        done()
        test.end() }) }) })

tape('GET /publishers/$publisher/projects/$project/editions/latest/form', function(test) {
  test.plan(3)
  var publisher = 'ana'
  var password = 'ana\'s password'
  var project = 'nda'
  var edition = '1e'
  var form = 'a'.repeat(64)
  server(function(port, done) {
    series(
      [ function putProject(done) {
          http.request(
            { auth: ( publisher + ':' + password ),
              method: 'POST',
              port: port,
              path:
                ( '/publishers/' + publisher +
                  '/projects/' + project +
                  '/editions/' + edition ) },
            function(response) {
              test.equal(response.statusCode, 201, 'POST 201')
              done() })
            .end(JSON.stringify({ form: form })) },
        function getProject(done) {
          http.request(
            { method: 'GET',
              port: port,
              path:
                ( '/publishers/' + publisher +
                  '/projects/' + project +
                  '/editions/latest/form' ) },
            function(response) {
              test.equal(response.statusCode, 301, 'GET 301')
              test.equal(
                response.headers.location,
                ( 'https://api.commonform.org/forms/' + form ),
                'GET api.commonform.org/forms/...')
              done() })
            .end() } ],
      function finish() {
        done()
        test.end() }) }) })

tape('PUT /publishers/$publisher/projects/$project/editions/$edition', function(test) {
  test.plan(1)
  var publisher = 'ana'
  var project = 'nda'
  var edition = '1e'
  server(function(port, done) {
    http.request(
      { method: 'PUT',
        port: port,
        path:
          ( '/publishers/' + publisher +
            '/projects/' + project +
            '/editions/' + edition ) },
      function(response) {
        test.equal(response.statusCode, 405, '405')
        done()
        test.end() })
      .end() }) })

tape('PUT /publishers/$publisher/projects/$project/editions/$edition/form', function(test) {
  test.plan(1)
  var publisher = 'ana'
  var project = 'nda'
  var edition = '1e'
  server(function(port, done) {
    http.request(
      { method: 'PUT',
        port: port,
        path:
          ( '/publishers/' + publisher +
            '/projects/' + project +
            '/editions/' + edition +
            '/form' ) },
      function(response) {
        test.equal(response.statusCode, 405, '405')
        done()
        test.end() })
      .end() }) })

tape('GET /forms/$form/projects', function(test) {
  test.plan(2)
  var publisher = 'ana'
  var password = 'ana\'s password'
  var project = 'nda'
  var edition = '1e'
  var form = 'a'.repeat(64)
  server(function(port, done) {
    series(
      [ function putProject(done) {
          http.request(
            { auth: ( publisher + ':' + password ),
              method: 'POST',
              port: port,
              path:
                ( '/publishers/' + publisher +
                  '/projects/' + project +
                  '/editions/' + edition ) },
            function(response) {
              test.equal(response.statusCode, 201, 'POST 201')
              done() })
            .end(JSON.stringify({ form: form })) },
        function getProjects(done) {
          http.request(
            { method: 'GET',
              port: port,
              path: ( '/forms/' + form + '/projects' ) },
            function(response) {
              response.pipe(concat(function(buffer) {
                var responseBody = JSON.parse(buffer)
                test.same(
                  responseBody,
                  [ { publisher: publisher,
                      project: project,
                      edition: edition,
                      form: form } ],
                  'GET projects JSON')
                done() })) })
            .end() } ],
      function finish() {
        done()
        test.end() }) }) })

