import type { FileHashes, HashProgressCallback } from '../types/rom-patcher'

export class HashCalculator {
  private static readonly HEX_CHR = '0123456789abcdef'.split('')

  // CRC32 lookup table
  private static readonly CRC32_TABLE = (() => {
    const table: number[] = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1))
      }
      table[n] = c
    }
    return table
  })()

  /**
   * Calculate all hashes (CRC32, MD5, SHA1) for a file
   */
  static async calculateHashes(
    data: Uint8Array, 
    progressCallback?: HashProgressCallback
  ): Promise<FileHashes> {
    const chunkSize = 64 * 1024 // 64KB chunks for progress reporting
    const totalBytes = data.length
    let bytesProcessed = 0

    // Initialize hash contexts
    const crc32Context = this.initCRC32()
    const md5Context = this.initMD5()
    const sha1Context = this.initSHA1()

    // Process data in chunks
    for (let offset = 0; offset < totalBytes; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, totalBytes)
      const chunk = data.subarray(offset, end)

      // Update all hashes
      this.updateCRC32(crc32Context, chunk)
      this.updateMD5(md5Context, chunk)
      this.updateSHA1(sha1Context, chunk)

      bytesProcessed = end
      
      // Report progress
      if (progressCallback) {
        progressCallback({
          bytesProcessed,
          totalBytes,
          percentage: (bytesProcessed / totalBytes) * 100
        })
      }

      // Yield control to prevent UI blocking
      if (offset % (chunkSize * 10) === 0) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }

    return {
      crc32: this.finalizeCRC32(crc32Context),
      md5: this.finalizeMD5(md5Context),
      sha1: this.finalizeSHA1(sha1Context)
    }
  }

  // CRC32 implementation
  private static initCRC32(): { crc: number } {
    return { crc: 0xffffffff }
  }

  private static updateCRC32(context: { crc: number }, data: Uint8Array): void {
    let crc = context.crc
    for (let i = 0; i < data.length; i++) {
      crc = this.CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
    }
    context.crc = crc
  }

  private static finalizeCRC32(context: { crc: number }): string {
    const finalCrc = (context.crc ^ 0xffffffff) >>> 0
    return finalCrc.toString(16).toUpperCase().padStart(8, '0')
  }

  // MD5 implementation
  private static initMD5(): { 
    h: number[]
    length: number
    buffer: number[]
  } {
    return {
      h: [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476],
      length: 0,
      buffer: []
    }
  }

  private static updateMD5(context: any, data: Uint8Array): void {
    const buffer = context.buffer
    let length = context.length

    for (let i = 0; i < data.length; i++) {
      buffer.push(data[i])
      length++

      if (buffer.length === 64) {
        this.processMD5Block(context.h, buffer)
        buffer.length = 0
      }
    }

    context.length = length
  }

  private static finalizeMD5(context: any): string {
    const buffer = context.buffer
    const length = context.length
    const bitLength = length * 8

    // Padding
    buffer.push(0x80)
    while (buffer.length % 64 !== 56) {
      buffer.push(0)
    }

    // Append length
    for (let i = 0; i < 8; i++) {
      buffer.push((bitLength >>> (i * 8)) & 0xff)
    }

    // Process remaining blocks
    for (let i = 0; i < buffer.length; i += 64) {
      this.processMD5Block(context.h, buffer.slice(i, i + 64))
    }

    // Convert to hex
    let result = ''
    for (let i = 0; i < 4; i++) {
      const h = context.h[i]
      result += this.HEX_CHR[(h >>> 4) & 0xf] + this.HEX_CHR[h & 0xf]
      result += this.HEX_CHR[(h >>> 12) & 0xf] + this.HEX_CHR[(h >>> 8) & 0xf]
      result += this.HEX_CHR[(h >>> 20) & 0xf] + this.HEX_CHR[(h >>> 16) & 0xf]
      result += this.HEX_CHR[(h >>> 28) & 0xf] + this.HEX_CHR[(h >>> 24) & 0xf]
    }

    return result
  }

  private static processMD5Block(h: number[], block: number[]): void {
    const w: number[] = []
    for (let i = 0; i < 64; i += 4) {
      w[i >> 2] = block[i] | (block[i + 1] << 8) | (block[i + 2] << 16) | (block[i + 3] << 24)
    }

    let a = h[0], b = h[1], c = h[2], d = h[3]

    // MD5 rounds (simplified implementation)
    for (let i = 0; i < 64; i++) {
      let f: number, g: number
      if (i < 16) {
        f = (b & c) | ((~b) & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | ((~d) & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | (~d))
        g = (7 * i) % 16
      }

      const temp = d
      d = c
      c = b
      b = this.add32(b, this.rotateLeft(this.add32(this.add32(a, f), this.add32(w[g], this.getMD5Constant(i))), this.getMD5Shift(i)))
      a = temp
    }

    h[0] = this.add32(h[0], a)
    h[1] = this.add32(h[1], b)
    h[2] = this.add32(h[2], c)
    h[3] = this.add32(h[3], d)
  }

  // SHA1 implementation
  private static initSHA1(): {
    h: number[]
    length: number
    buffer: number[]
  } {
    return {
      h: [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0],
      length: 0,
      buffer: []
    }
  }

  private static updateSHA1(context: any, data: Uint8Array): void {
    const buffer = context.buffer
    let length = context.length

    for (let i = 0; i < data.length; i++) {
      buffer.push(data[i])
      length++

      if (buffer.length === 64) {
        this.processSHA1Block(context.h, buffer)
        buffer.length = 0
      }
    }

    context.length = length
  }

  private static finalizeSHA1(context: any): string {
    const buffer = context.buffer
    const length = context.length
    const bitLength = length * 8

    // Padding
    buffer.push(0x80)
    while (buffer.length % 64 !== 56) {
      buffer.push(0)
    }

    // Append length (big-endian)
    for (let i = 7; i >= 0; i--) {
      buffer.push((bitLength >>> (i * 8)) & 0xff)
    }

    // Process remaining blocks
    for (let i = 0; i < buffer.length; i += 64) {
      this.processSHA1Block(context.h, buffer.slice(i, i + 64))
    }

    // Convert to hex
    let result = ''
    for (let i = 0; i < 5; i++) {
      const h = context.h[i]
      result += ((h >>> 28) & 0xf).toString(16) + ((h >>> 24) & 0xf).toString(16)
      result += ((h >>> 20) & 0xf).toString(16) + ((h >>> 16) & 0xf).toString(16)
      result += ((h >>> 12) & 0xf).toString(16) + ((h >>> 8) & 0xf).toString(16)
      result += ((h >>> 4) & 0xf).toString(16) + (h & 0xf).toString(16)
    }

    return result
  }

  private static processSHA1Block(h: number[], block: number[]): void {
    const w: number[] = new Array(80)

    // Convert bytes to 32-bit words (big-endian)
    for (let i = 0; i < 16; i++) {
      w[i] = (block[i * 4] << 24) | (block[i * 4 + 1] << 16) | 
             (block[i * 4 + 2] << 8) | block[i * 4 + 3]
    }

    // Extend words
    for (let i = 16; i < 80; i++) {
      w[i] = this.rotateLeft(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1)
    }

    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4]

    // Main loop
    for (let i = 0; i < 80; i++) {
      let f: number, k: number

      if (i < 20) {
        f = (b & c) | ((~b) & d)
        k = 0x5a827999
      } else if (i < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }

      const temp = this.add32(this.add32(this.rotateLeft(a, 5), f), this.add32(this.add32(e, w[i]), k))
      e = d
      d = c
      c = this.rotateLeft(b, 30)
      b = a
      a = temp
    }

    h[0] = this.add32(h[0], a)
    h[1] = this.add32(h[1], b)
    h[2] = this.add32(h[2], c)
    h[3] = this.add32(h[3], d)
    h[4] = this.add32(h[4], e)
  }

  // Utility functions
  private static add32(a: number, b: number): number {
    return (a + b) & 0xffffffff
  }

  private static rotateLeft(value: number, amount: number): number {
    return ((value << amount) | (value >>> (32 - amount))) & 0xffffffff
  }

  private static getMD5Constant(i: number): number {
    const constants = [
      0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
      0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
      0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
      0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
      0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
      0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
      0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
      0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
    ]
    return constants[i]
  }

  private static getMD5Shift(i: number): number {
    const shifts = [
      7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
      5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
      6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
    ]
    return shifts[i]
  }
}
