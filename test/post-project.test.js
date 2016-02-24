var http = require('http')
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
