// VCDIFF format implementation for Byte-Forge
// RFC 3284 delta compression format with advanced instruction-based patching
// Based on: https://tools.ietf.org/html/rfc3284

import { BinFile } from '../core/binary-file'
import type { PatchFile, PatchFormatModule } from '../types/rom-patcher'

const VCDIFF_MAGIC = '\xd6\xc3\xc4'

// Instruction types
const VCD_NOOP = 0
const VCD_ADD = 1
const VCD_RUN = 2
const VCD_COPY = 3

// Header indicators
const VCD_DECOMPRESS = 0x01
const VCD_CODETABLE = 0x02
const VCD_APPHEADER = 0x04

// Window indicators
const VCD_SOURCE = 0x01
const VCD_TARGET = 0x02
const VCD_ADLER32 = 0x04

// Address cache modes
const VCD_MODE_SELF = 0
const VCD_MODE_HERE = 1

export interface VCDIFFInstruction {
  type: number
  size: number
  mode: number
}

export interface VCDIFFWindowHeader {
  indicator: number
  sourceLength: number
  sourcePosition: number
  deltaLength: number
  targetWindowLength: number
  deltaIndicator: number
  addRunDataLength: number
  instructionsLength: number
  addressesLength: number
  adler32?: number
}

export class VCDIFFParser {
  private fileSize: number
  private _u8array: Uint8Array
  public offset: number

  constructor(binFile: BinFile, offset: number = 0) {
    this.fileSize = binFile.fileSize
    this._u8array = binFile._u8array
    this.offset = offset
  }

  readU8(): number {
    if (this.offset >= this.fileSize) return 0
    return this._u8array[this.offset++]
  }

  readU32(): number {
    const b0 = this.readU8()
    const b1 = this.readU8()
    const b2 = this.readU8()
    const b3 = this.readU8()
    return (b3 << 24) | (b2 << 16) | (b1 << 8) | b0
  }

  skip(n: number): void {
    this.offset += n
  }

  seek(offset: number): void {
    this.offset = offset
  }

  isEOF(): boolean {
    return this.offset >= this.fileSize
  }

  read7BitEncodedInt(): number {
    let num = 0
    let bits = 0

    do {
      bits = this.readU8()
      num = (num << 7) + (bits & 0x7f)
    } while (bits & 0x80)

    return num
  }

  copyToFile2(target: BinFile, targetOffset: number, len: number): void {
    for (let i = 0; i < len; i++) {
      target._u8array[targetOffset + i] = this._u8array[this.offset + i]
    }
    this.skip(len)
  }

  decodeWindowHeader(): VCDIFFWindowHeader {
    const windowHeader: VCDIFFWindowHeader = {
      indicator: this.readU8(),
      sourceLength: 0,
      sourcePosition: 0,
      deltaLength: 0,
      targetWindowLength: 0,
      deltaIndicator: 0,
      addRunDataLength: 0,
      instructionsLength: 0,
      addressesLength: 0
    }

    if (windowHeader.indicator & (VCD_SOURCE | VCD_TARGET)) {
      windowHeader.sourceLength = this.read7BitEncodedInt()
      windowHeader.sourcePosition = this.read7BitEncodedInt()
    }

    windowHeader.deltaLength = this.read7BitEncodedInt()
    windowHeader.targetWindowLength = this.read7BitEncodedInt()
    windowHeader.deltaIndicator = this.readU8()
    
    if (windowHeader.deltaIndicator !== 0) {
      throw new Error(`Unimplemented windowHeader.deltaIndicator: ${windowHeader.deltaIndicator}`)
    }
    
    windowHeader.addRunDataLength = this.read7BitEncodedInt()
    windowHeader.instructionsLength = this.read7BitEncodedInt()
    windowHeader.addressesLength = this.read7BitEncodedInt()

    if (windowHeader.indicator & VCD_ADLER32) {
      windowHeader.adler32 = this.readU32()
    }

    return windowHeader
  }
}

export class VCDIFFAddressCache {
  private nearSize: number
  private sameSize: number
  private near: number[]
  private same: number[]
  private nextNearSlot: number
  private addressStream!: VCDIFFParser

  constructor(nearSize: number, sameSize: number) {
    this.nearSize = nearSize
    this.sameSize = sameSize
    this.near = new Array(nearSize).fill(0)
    this.same = new Array(sameSize * 256).fill(0)
    this.nextNearSlot = 0
  }

  reset(addressStream: VCDIFFParser): void {
    this.nextNearSlot = 0
    this.near.fill(0)
    this.same.fill(0)
    this.addressStream = addressStream
  }

  decodeAddress(here: number, mode: number): number {
    let address = 0

    if (mode === VCD_MODE_SELF) {
      address = this.addressStream.read7BitEncodedInt()
    } else if (mode === VCD_MODE_HERE) {
      address = here - this.addressStream.read7BitEncodedInt()
    } else if (mode - 2 < this.nearSize) { // near cache
      address = this.near[mode - 2] + this.addressStream.read7BitEncodedInt()
    } else { // same cache
      const m = mode - (2 + this.nearSize)
      address = this.same[m * 256 + this.addressStream.readU8()]
    }
    
    this.update(address)
    return address
  }

  update(address: number): void {
    if (this.nearSize > 0) {
      this.near[this.nextNearSlot] = address
      this.nextNearSlot = (this.nextNearSlot + 1) % this.nearSize
    }

    if (this.sameSize > 0) {
      this.same[address % (this.sameSize * 256)] = address
    }
  }
}

// Default code table for instruction decoding
const VCD_DEFAULT_CODE_TABLE = (function() {
  const entries: Array<[VCDIFFInstruction, VCDIFFInstruction]> = []
  const empty: VCDIFFInstruction = { type: VCD_NOOP, size: 0, mode: 0 }

  // 0
  entries.push([{ type: VCD_RUN, size: 0, mode: 0 }, empty])

  // 1-18
  for (let size = 0; size < 18; size++) {
    entries.push([{ type: VCD_ADD, size: size, mode: 0 }, empty])
  }

  // 19-162
  for (let mode = 0; mode < 9; mode++) {
    entries.push([{ type: VCD_COPY, size: 0, mode: mode }, empty])
    
    for (let size = 4; size < 19; size++) {
      entries.push([{ type: VCD_COPY, size: size, mode: mode }, empty])
    }
  }

  // 163-234
  for (let mode = 0; mode < 6; mode++) {
    for (let addSize = 1; addSize < 5; addSize++) {
      for (let copySize = 4; copySize < 7; copySize++) {
        entries.push([
          { type: VCD_ADD, size: addSize, mode: 0 },
          { type: VCD_COPY, size: copySize, mode: mode }
        ])
      }
    }
  }

  // 235-246
  for (let mode = 6; mode < 9; mode++) {
    for (let addSize = 1; addSize < 5; addSize++) {
      entries.push([
        { type: VCD_ADD, size: addSize, mode: 0 },
        { type: VCD_COPY, size: 4, mode: mode }
      ])
    }
  }

  // 247-255
  for (let mode = 0; mode < 9; mode++) {
    entries.push([
      { type: VCD_COPY, size: 4, mode: mode },
      { type: VCD_ADD, size: 1, mode: 0 }
    ])
  }

  return entries
})()

export class VCDIFFPatch implements PatchFile {
  private file: BinFile

  constructor(patchFile: BinFile) {
    this.file = patchFile
  }

  validateSource(): boolean {
    // VCDIFF doesn't have simple source validation
    return true
  }

  getValidationInfo(): { type: string; value: string } {
    return {
      type: 'VCDIFF',
      value: 'Delta compression format'
    }
  }

  apply(romFile: BinFile, validate: boolean = true): BinFile {
    const parser = new VCDIFFParser(this.file)

    // Read header
    parser.seek(3) // Skip magic
    const headerIndicator = parser.readU8()

    if (headerIndicator & VCD_DECOMPRESS) {
      const secondaryDecompressorId = parser.readU8()
      if (secondaryDecompressorId !== 0) {
        throw new Error('Secondary decompressor not implemented')
      }
    }

    if (headerIndicator & VCD_CODETABLE) {
      const codeTableDataLength = parser.read7BitEncodedInt()
      if (codeTableDataLength !== 0) {
        throw new Error('Custom code table not implemented')
      }
    }

    if (headerIndicator & VCD_APPHEADER) {
      const appDataLength = parser.read7BitEncodedInt()
      parser.skip(appDataLength)
    }

    const headerEndOffset = parser.offset

    // Calculate target file size
    let newFileSize = 0
    while (!parser.isEOF()) {
      const winHeader = parser.decodeWindowHeader()
      newFileSize += winHeader.targetWindowLength
      parser.skip(winHeader.addRunDataLength + winHeader.addressesLength + winHeader.instructionsLength)
    }

    const tempFile = new BinFile(newFileSize)
    parser.seek(headerEndOffset)

    const cache = new VCDIFFAddressCache(4, 3)
    const codeTable = VCD_DEFAULT_CODE_TABLE
    let targetWindowPosition = 0

    while (!parser.isEOF()) {
      const winHeader = parser.decodeWindowHeader()
      
      const addRunDataStream = new VCDIFFParser(this.file, parser.offset)
      const instructionsStream = new VCDIFFParser(this.file, addRunDataStream.offset + winHeader.addRunDataLength)
      const addressesStream = new VCDIFFParser(this.file, instructionsStream.offset + winHeader.instructionsLength)

      let addRunDataIndex = 0
      cache.reset(addressesStream)

      const addressesStreamEndOffset = addressesStream.offset
      while (instructionsStream.offset < addressesStreamEndOffset) {
        const instructionIndex = instructionsStream.readU8()

        for (let i = 0; i < 2; i++) {
          const instruction = codeTable[instructionIndex][i]
          let size = instruction.size

          if (size === 0 && instruction.type !== VCD_NOOP) {
            size = instructionsStream.read7BitEncodedInt()
          }

          if (instruction.type === VCD_NOOP) {
            continue
          } else if (instruction.type === VCD_ADD) {
            addRunDataStream.copyToFile2(tempFile, addRunDataIndex + targetWindowPosition, size)
            addRunDataIndex += size
          } else if (instruction.type === VCD_COPY) {
            const addr = cache.decodeAddress(addRunDataIndex + winHeader.sourceLength, instruction.mode)
            let absAddr = 0

            let sourceData: BinFile
            if (addr < winHeader.sourceLength) {
              absAddr = winHeader.sourcePosition + addr
              if (winHeader.indicator & VCD_SOURCE) {
                sourceData = romFile
              } else if (winHeader.indicator & VCD_TARGET) {
                sourceData = tempFile
              } else {
                throw new Error('Invalid window indicator')
              }
            } else {
              absAddr = targetWindowPosition + (addr - winHeader.sourceLength)
              sourceData = tempFile
            }

            while (size--) {
              tempFile._u8array[targetWindowPosition + addRunDataIndex++] = sourceData._u8array[absAddr++]
            }
          } else if (instruction.type === VCD_RUN) {
            const runByte = addRunDataStream.readU8()
            const offset = targetWindowPosition + addRunDataIndex
            for (let j = 0; j < size; j++) {
              tempFile._u8array[offset + j] = runByte
            }
            addRunDataIndex += size
          } else {
            throw new Error('Invalid instruction type found')
          }
        }
      }

      if (validate && winHeader.adler32 && winHeader.adler32 !== this.adler32(tempFile, targetWindowPosition, winHeader.targetWindowLength)) {
        throw new Error('Target ROM checksum mismatch')
      }

      parser.skip(winHeader.addRunDataLength + winHeader.addressesLength + winHeader.instructionsLength)
      targetWindowPosition += winHeader.targetWindowLength
    }

    return tempFile
  }

  export(): BinFile {
    return this.file.clone()
  }

  toString(): string {
    return 'VCDIFF patch'
  }

  // Simple Adler-32 implementation for checksum validation
  private adler32(file: BinFile, offset: number, length: number): number {
    let a = 1
    let b = 0
    const MOD_ADLER = 65521

    for (let i = 0; i < length; i++) {
      a = (a + file._u8array[offset + i]) % MOD_ADLER
      b = (b + a) % MOD_ADLER
    }

    return (b << 16) | a
  }

  static fromFile(patchFile: BinFile): VCDIFFPatch | null {
    patchFile.seek(0)
    const magic = patchFile.readBytes(3)
    const magicStr = String.fromCharCode(...magic)
    
    if (magicStr !== VCDIFF_MAGIC) {
      return null
    }

    return new VCDIFFPatch(patchFile)
  }
}

// Module export for format registration
export const VCDIFFModule: PatchFormatModule<VCDIFFPatch> = {
  name: 'VCDIFF',
  extension: '.vcdiff',
  magic: VCDIFF_MAGIC,
  
  identify: (data: Uint8Array): boolean => {
    if (data.length < 3) return false
    const magic = String.fromCharCode(data[0], data[1], data[2])
    return magic === VCDIFF_MAGIC
  },
  
  create: (): VCDIFFPatch => {
    throw new Error('VCDIFF creation not implemented - use existing VCDIFF files')
  },
  
  parse: (file: BinFile): VCDIFFPatch | null => VCDIFFPatch.fromFile(file),
  
  build: (): VCDIFFPatch => {
    throw new Error('VCDIFF building from ROMs not implemented')
  }
}
