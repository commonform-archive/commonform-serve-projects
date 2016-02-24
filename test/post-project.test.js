var concat = require('concat-stream')
var http = require('http')
var series = require('async-series')
var server = require('./server')
var tape = require('tape')

tape('POST /publishers/$publisher/$project/editions/$edition', function(test) {
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
        test.equal(response.statusCode, 201, 'POST -> 201')
        test.equal(response.headers.location, path, 'POST -> Location')
        done()
        test.end() })
      .end(JSON.stringify({ form: form })) }) })

tape('POST /publishers/$publisher/$project/editions/$existing', function(test) {
  test.plan(3)
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
            test.equal(response.statusCode, 201, 'POST -> 201')
            done() })
            .end(JSON.stringify({ form: form })) },
        function getProject(done) {
          http.request(request, function(response) {
            test.equal(response.statusCode, 409, 'POST -> 409')
            done() })
            .end(JSON.stringify({ form: form })) } ],
      function finish(error) {
        test.ifError(error, 'no series error')
        done()
        test.end() }) }) })

tape('GET /publishers/$publisher/$project/editions/$nonexistent', function(test) {
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
        test.equal(response.statusCode, 404, 'GET -> 404')
        done()
        test.end() })
      .end() }) })

tape('GET /publishers/$publisher/$project/editions/$nonexistent', function(test) {
  test.plan(3)
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
              test.equal(response.statusCode, 201, 'POST -> 201')
              done() })
            .end(JSON.stringify({ form: form })) },
        function getProject(done) {
          http.request(
            { method: 'GET', port: port, path: path },
            function(response) {
              response.pipe(concat(function(buffer) {
                var responseBody = JSON.parse(buffer)
                test.equal(responseBody.form, form, 'GET -> project JSON')
                done() })) })
            .end() } ],
      function finish(error) {
        test.ifError(error, 'no series error')
        done()
        test.end() }) }) })