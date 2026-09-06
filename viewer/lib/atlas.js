const fs = require('fs')
const { Canvas, Image } = require('canvas')
const path = require('path')

function nextPowerOfTwo (n) {
  if (n === 0) return 1
  n--
  n |= n >> 1
  n |= n >> 2
  n |= n >> 4
  n |= n >> 8
  n |= n >> 16
  return n + 1
}

function readTexture (basePath, name) {
  if (name === 'missing_texture.png') {
    // grab ./missing_texture.png
    basePath = __dirname
  }
  return fs.readFileSync(path.join(basePath, name), 'base64')
}

function loadImage (basePath, name) {
  const img = new Image()
  img.src = 'data:image/png;base64,' + readTexture(basePath, name)
  return img
}

// An animated texture is a vertical strip of square frames described by a
// .mcmeta next to it. Frame order and per-frame durations are baked into the
// atlas as repeated tiles, so the shader only needs a frame count and one
// frame time (in ticks). "interpolate" is ignored.
function readAnimation (basePath, name, img) {
  const mcmetaPath = path.join(basePath, name + '.mcmeta')
  if (img.height <= img.width || !fs.existsSync(mcmetaPath)) return null
  const { animation } = JSON.parse(fs.readFileSync(mcmetaPath, 'utf8'))
  if (!animation) return null
  const frametime = animation.frametime || 1
  const frameCount = Math.floor(img.height / img.width)
  const frames = animation.frames || [...Array(frameCount).keys()]
  return {
    frametime,
    frames: frames.flatMap(f => typeof f === 'number' ? [f] : Array(Math.max(1, Math.round(f.time / frametime))).fill(f.index))
  }
}

// Tiles keep their native resolution (26.1 ships 32x32 block textures); each
// atlas entry carries its own u/v/su/sv extents, so consumers such as
// modelsBuilder are resolution-agnostic. A texture's tile is its leading
// square; an animated texture occupies a vertical run of them, one per frame.
function makeTextureAtlas (mcAssets) {
  const blocksTexturePath = path.join(mcAssets.directory, '/blocks')
  const textureFiles = fs.readdirSync(blocksTexturePath).filter(file => file.endsWith('.png'))
  textureFiles.unshift('missing_texture.png')

  const textures = textureFiles.map(file => {
    const img = loadImage(blocksTexturePath, file)
    const animation = readAnimation(blocksTexturePath, file, img)
    const frames = animation ? animation.frames : [0]
    const h = Math.min(img.width, img.height)
    return { name: file.split('.')[0], img, animation, frames, w: img.width, h, runHeight: h * frames.length }
  })

  // Columns are one narrowest-tile wide; a texture spans as many adjacent
  // columns as its width needs. Tallest runs first, each into the lowest
  // fitting span, so runs never straddle rows.
  const unit = Math.min(...textures.map(t => t.w))
  const totalArea = textures.reduce((a, t) => a + t.w * t.runHeight, 0)
  const maxWidth = Math.max(...textures.map(t => t.w))
  const width = nextPowerOfTwo(Math.max(maxWidth, Math.ceil(Math.sqrt(totalArea))))
  const columns = new Array(Math.floor(width / unit)).fill(0)
  textures.sort((a, b) => b.runHeight - a.runHeight || b.w - a.w)
  for (const tex of textures) {
    const span = Math.ceil(tex.w / unit)
    let col = 0
    let y = Infinity
    for (let c = 0; c + span <= columns.length; c++) {
      const top = Math.max(...columns.slice(c, c + span))
      if (top < y) {
        col = c
        y = top
      }
    }
    tex.x = col * unit
    tex.y = y
    columns.fill(y + tex.runHeight, col, col + span)
  }
  const height = nextPowerOfTwo(Math.max(...columns))

  const canvas = new Canvas(width, height, 'png')
  const g = canvas.getContext('2d')
  const texturesIndex = {}
  for (const tex of textures) {
    texturesIndex[tex.name] = { u: tex.x / width, v: tex.y / height, su: tex.w / width, sv: tex.h / height }
    if (tex.animation) {
      texturesIndex[tex.name].frames = tex.frames.length
      texturesIndex[tex.name].frametime = tex.animation.frametime
      texturesIndex[tex.name].frameHeight = tex.h / height
    }
    tex.frames.forEach((frame, i) => {
      g.drawImage(tex.img, 0, frame * tex.h, tex.w, tex.h, tex.x, tex.y + i * tex.h, tex.w, tex.h)
    })
  }

  return { image: canvas.toBuffer(), canvas, json: { width, height, textures: texturesIndex } }
}

module.exports = {
  makeTextureAtlas
}
