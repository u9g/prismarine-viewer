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

// Tiles keep their native resolution (some are 32x32 since 26.1); each atlas
// entry carries its own u/v/su/sv extents, so consumers such as modelsBuilder
// are resolution-agnostic. Animated textures (taller than wide) contribute
// only their first frame, since model UV space maps to a single frame.
function makeTextureAtlas (mcAssets) {
  const blocksTexturePath = path.join(mcAssets.directory, '/blocks')
  const textureFiles = fs.readdirSync(blocksTexturePath).filter(file => file.endsWith('.png'))
  textureFiles.unshift('missing_texture.png')

  const tiles = textureFiles.map(file => {
    const img = loadImage(blocksTexturePath, file)
    return { name: file.split('.')[0], img, w: img.width, h: Math.min(img.width, img.height) }
  })

  // shelf-pack: sort by height, lay out rows, then round the atlas up to a power of two
  const totalArea = tiles.reduce((a, t) => a + t.w * t.h, 0)
  const maxWidth = Math.max(...tiles.map(t => t.w))
  const width = nextPowerOfTwo(Math.max(maxWidth, Math.ceil(Math.sqrt(totalArea))))
  tiles.sort((a, b) => b.h - a.h)

  let shelfX = 0
  let shelfY = 0
  let shelfH = 0
  let packedHeight = 0
  const texturesIndex = {}
  for (const tile of tiles) {
    if (shelfX + tile.w > width) {
      shelfX = 0
      shelfY += shelfH
      shelfH = 0
    }
    tile.x = shelfX
    tile.y = shelfY
    shelfX += tile.w
    shelfH = Math.max(shelfH, tile.h)
    packedHeight = Math.max(packedHeight, shelfY + tile.h)
  }
  const height = nextPowerOfTwo(packedHeight)

  for (const tile of tiles) {
    texturesIndex[tile.name] = { u: tile.x / width, v: tile.y / height, su: tile.w / width, sv: tile.h / height }
  }

  const canvas = new Canvas(width, height, 'png')
  const g = canvas.getContext('2d')
  for (const tile of tiles) {
    g.drawImage(tile.img, 0, 0, tile.w, tile.h, tile.x, tile.y, tile.w, tile.h)
  }

  return { image: canvas.toBuffer(), canvas, json: { size: 16 / width, textures: texturesIndex } }
}

module.exports = {
  makeTextureAtlas
}
