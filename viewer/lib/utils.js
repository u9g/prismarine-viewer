function safeRequire (path) {
  try {
    return require(path)
  } catch (e) {
    return {}
  }
}
const { PNG } = safeRequire('pngjs')
const THREE = require('three')
const path = require('path')
const fs = require('fs')

const textureCache = {}
// todo not ideal, export different functions for browser and node
function loadTexture (texture, cb) {
  if (process.platform === 'browser') {
    return require('./utils.web').loadTexture(texture, cb)
  }

  if (textureCache[texture]) {
    cb(textureCache[texture])
  } else {
    const png = PNG.sync.read(fs.readFileSync(path.resolve(__dirname, '../../public/', texture)))
    const tex = new THREE.DataTexture(new Uint8Array(png.data), png.width, png.height, THREE.RGBAFormat)
    tex.needsUpdate = true
    textureCache[texture] = tex
    cb(tex)
  }
}

function loadJSON (json, cb) {
  if (process.platform === 'browser') {
    return require('./utils.web').loadJSON(json, cb)
  }
  cb(require(path.resolve(__dirname, '../../public/' + json)))
}

module.exports = { loadTexture, loadJSON }
