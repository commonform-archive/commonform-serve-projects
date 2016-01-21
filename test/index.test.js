var concat = require('concat-stream')
var http = require('http')
var meta = require('../package.json')
var server = require('./server')
var tape = require('tape')

tape('GET /', function(test) {
  test.plan(1)
  server(function(port, done) {
    var request = { method: 'GET', port: port }
    http.request(request, function(response) {
      response.pipe(concat(function(buffer) {
        test.same(
          JSON.parse(buffer),
          { service: 'commonform-serve-projects',
            version: meta.version },
          'GET / receives service metadata')
        done()
        test.end() })) })
    .end() }) })
