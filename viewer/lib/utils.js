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

  if (textureCache[texture]) return cb(textureCache[texture])
  // bundled textures are files under public/; player skins are http(s) URLs
  const read = /^https?:\/\//.test(texture)
    ? fetch(texture).then(res => res.ok ? res.arrayBuffer() : Promise.reject(new Error(res.status))).then(Buffer.from)
    : Promise.resolve().then(() => fs.readFileSync(path.resolve(__dirname, '../../public/', texture)))
  read.then(data => {
    const png = PNG.sync.read(data)
    const tex = new THREE.DataTexture(new Uint8Array(png.data), png.width, png.height, THREE.RGBAFormat)
    tex.needsUpdate = true
    textureCache[texture] = tex
    cb(tex)
  }).catch(() => {})
}

function loadJSON (json, cb) {
  if (process.platform === 'browser') {
    return require('./utils.web').loadJSON(json, cb)
  }
  cb(require(path.resolve(__dirname, '../../public/' + json)))
}

module.exports = { loadTexture, loadJSON }
