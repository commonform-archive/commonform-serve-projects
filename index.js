module.exports = serveProjects

var meta = require('./package.json')

function serveProjects(log, level) {
  return function(request, response) {
    response.end(
      JSON.stringify(
        { service: meta.name,
          version: meta.version })) } }
