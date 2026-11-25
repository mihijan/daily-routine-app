/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const PLATE = [11, 17, 32]
const GREEN = [52, 211, 153]

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(size, rgba) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function smoothBand(distance, inner, outer) {
  const feather = 0.8
  if (distance <= inner - feather || distance >= outer + feather) return 0
  if (distance >= inner && distance <= outer) return 1
  if (distance > outer) return Math.max(0, (outer + feather - distance) / (feather * 2))
  return Math.max(0, (distance - (inner - feather)) / (feather * 2))
}

function roundedPlate(x, y, size, radius) {
  const inset = size * 0.06
  const left = inset
  const top = inset
  const right = size - inset
  const bottom = size - inset
  const cx = Math.min(Math.max(x, left + radius), right - radius)
  const cy = Math.min(Math.max(y, top + radius), bottom - radius)
  const dx = x - cx
  const dy = y - cy
  const distance = Math.hypot(dx, dy)
  if (distance <= radius) return 1
  if (distance >= radius + 1) return 0
  return radius + 1 - distance
}

function paint(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const center = size / 2
  const ring = size * 0.3
  const thickness = Math.max(size * 0.075, 1.5)
  const handLength = size * 0.16

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5
      const py = y + 0.5
      const plate = roundedPlate(px, py, size, size * 0.22)
      const dx = px - center
      const dy = py - center
      const distance = Math.hypot(dx, dy)
      const ringAlpha = smoothBand(distance, ring - thickness / 2, ring + thickness / 2)
      const dot = Math.max(0, 1 - distance / (size * 0.045))
      // Hand points to roughly 1 o'clock.
      const along = dx * 0.42 - dy * 0.91
      const across = Math.abs(dx * 0.91 + dy * 0.42)
      const hand =
        along > 0 && along < handLength && across < thickness * 0.55
          ? 1 - across / (thickness * 0.55)
          : 0
      const mark = Math.min(1, ringAlpha + dot + hand)

      const index = (y * size + x) * 4
      if (plate <= 0 && mark <= 0) continue

      const alpha = Math.min(1, plate)
      const red = PLATE[0] * (1 - mark) + GREEN[0] * mark
      const green = PLATE[1] * (1 - mark) + GREEN[1] * mark
      const blue = PLATE[2] * (1 - mark) + GREEN[2] * mark
      rgba[index] = Math.round(red)
      rgba[index + 1] = Math.round(green)
      rgba[index + 2] = Math.round(blue)
      rgba[index + 3] = Math.round(255 * Math.max(alpha, mark * plate))
    }
  }
  return rgba
}

function encodeIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  const directory = Buffer.alloc(16 * images.length)
  let offset = 6 + directory.length
  const pngs = images.map((image) => encodePng(image.size, image.rgba))
  pngs.forEach((png, index) => {
    const entry = index * 16
    const size = images[index].size
    directory[entry] = size >= 256 ? 0 : size
    directory[entry + 1] = size >= 256 ? 0 : size
    directory.writeUInt16LE(1, entry + 4)
    directory.writeUInt16LE(32, entry + 6)
    directory.writeUInt32LE(png.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, directory, ...pngs])
}

const sizes = [16, 32, 48, 256]
const images = sizes.map((size) => ({ size, rgba: paint(size) }))
const png = encodePng(256, images[3].rgba)
const ico = encodeIco(images)

mkdirSync(join(root, 'resources'), { recursive: true })
mkdirSync(join(root, 'build'), { recursive: true })
writeFileSync(join(root, 'resources', 'icon.png'), png)
writeFileSync(join(root, 'build', 'icon.ico'), ico)
console.log('wrote resources/icon.png and build/icon.ico')
