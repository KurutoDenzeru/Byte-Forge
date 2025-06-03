import type { BinaryFile, PatchFile, PatchRecord, PatchFormatModule } from '../types/rom-patcher'
import { BinFile } from '../core/binary-file'
import { InvalidPatchFileError } from '../types/rom-patcher'

export const APS_N64_MAGIC = 'APS10'
export const APS_RECORD_RLE = 0x0000
export const APS_RECORD_SIMPLE = 0x01
export const APS_N64_MODE = 0x01

interface APSRecord {
  offset: number
  type: number
  data?: number[]
  length?: number
  byte?: number
}

interface APSHeader {
  originalN64Format?: number
  cartId?: string
  crc?: number[]
  pad?: number[]
  sizeOutput?: number
}

export class APSPatch implements PatchFile {
  public apsRecords: APSRecord[] = []
  public headerType: number = 0
  public encodingMethod: number = 0
  public description: string = 'no description'
  public header: APSHeader = {}

  // PatchFile interface compatibility
  get records(): PatchRecord[] {
    return this.apsRecords.map(record => ({
      offset: record.offset,
      type: record.type,
      length: record.type === APS_RECORD_RLE ? (record.length || 0) : (record.data?.length || 0),
      data: record.data ? new Uint8Array(record.data) : undefined,
      byte: record.byte
    }))
  }

  constructor() {}  addRecord(offset: number, data: number[]): void {
    this.apsRecords.push({
      offset: offset,
      type: APS_RECORD_SIMPLE,
      data: data
    })
  }

  addRLERecord(offset: number, byte: number, length: number): void {
    this.apsRecords.push({
      offset: offset,
      type: APS_RECORD_RLE,
      byte: byte,
      length: length
    })
  }

  addRLERecord(offset: number, byte: number, length: number): void {
    this.records.push({
      offset: offset,
      type: APS_RECORD_RLE,
      length: length,
      byte: byte
    })
  }

  toString(): string {
    let result = `Total records: ${this.records.length}\n`
    result += `Header type: ${this.headerType}\n`
    result += `Encoding method: ${this.encodingMethod}\n`
    result += `Description: ${this.description}`
    
    if (this.headerType === APS_N64_MODE && this.header.cartId && this.header.crc) {
      const crcHex = this.header.crc.reduce((hex, b) => {
        return hex + (b < 16 ? '0' + b.toString(16) : b.toString(16))
      }, '')
      result += `\nCart ID: ${this.header.cartId} (${crcHex})`
    }
    
    return result
  }

  validateSource(romFile: BinaryFile, skipHeaderSize: number = 0): boolean {
    // APS doesn't have built-in source validation like other formats
    return true
  }
  apply(romFile: BinaryFile): BinaryFile {
    const outputSize = this.header.sizeOutput || romFile.fileSize
    const tempFile = new BinFile(outputSize)
    
    // Copy original ROM
    romFile.copyTo(tempFile, 0)
    
    // Apply patches
    for (const record of this.apsRecords) {
      tempFile.seek(record.offset)
      
      if (record.type === APS_RECORD_RLE) {
        // RLE record - repeat a single byte
        for (let j = 0; j < record.length!; j++) {
          tempFile.writeU8(record.byte!)
        }
      } else {
        // Simple record - write data directly
        tempFile.writeBytes(new Uint8Array(record.data!))
      }
    }

    // Update filename
    const baseName = romFile.getName()
    const extension = romFile.getExtension()
    const suffix = extension ? `.${extension}` : ''
    tempFile.setName(`${baseName} (patched)${suffix}`)

    return tempFile
  }

  export(fileName?: string): BinaryFile {
    let patchFileSize = 61
    if (this.headerType === APS_N64_MODE) {
      patchFileSize += 17
    }    for (const record of this.apsRecords) {
      if (record.type === APS_RECORD_RLE) {
        patchFileSize += 7
      } else {
        patchFileSize += 5 + record.data!.length // offset + length + data
      }
    }

    const tempFile = new BinFile(patchFileSize)
    tempFile.littleEndian = true
    tempFile.setName((fileName || 'patch') + '.aps')
    
    tempFile.writeString(APS_N64_MAGIC, 'ascii')
    tempFile.writeU8(this.headerType)
    tempFile.writeU8(this.encodingMethod)
    tempFile.writeString(this.description.padEnd(50, '\0'), 'ascii')

    if (this.headerType === APS_N64_MODE) {
      tempFile.writeU8(this.header.originalN64Format || 0)
      tempFile.writeString((this.header.cartId || '').padEnd(3, '\0'), 'ascii')
      tempFile.writeBytes(new Uint8Array(this.header.crc || [0, 0, 0, 0, 0, 0, 0, 0]))
      tempFile.writeBytes(new Uint8Array(this.header.pad || [0, 0, 0, 0, 0]))
    }
    
    tempFile.writeU32(this.header.sizeOutput || 0)

    for (const record of this.apsRecords) {
      tempFile.writeU32(record.offset)
      
      if (record.type === APS_RECORD_RLE) {
        tempFile.writeU8(APS_RECORD_RLE)
        tempFile.writeU8(record.byte!)
        tempFile.writeU8(record.length!)
      } else {
        tempFile.writeU8(record.data!.length)
        tempFile.writeBytes(new Uint8Array(record.data!))
      }
    }

    return tempFile
  }
}

export const APS: PatchFormatModule = {
  MAGIC: APS_N64_MAGIC,

  fromFile(patchFile: BinaryFile): APSPatch {
    const patch = new APSPatch()
    patchFile.littleEndian = true

    patchFile.seek(5)
    patch.headerType = patchFile.readU8()
    patch.encodingMethod = patchFile.readU8()
    patch.description = patchFile.readString(50, 'ascii').replace(/\0.*$/, '')

    if (patch.headerType === APS_N64_MODE) {
      patch.header.originalN64Format = patchFile.readU8()
      patch.header.cartId = patchFile.readString(3, 'ascii')
      patch.header.crc = Array.from(patchFile.readBytes(8))
      patch.header.pad = Array.from(patchFile.readBytes(5))
    }
    
    patch.header.sizeOutput = patchFile.readU32()

    while (!patchFile.isEOF()) {
      const offset = patchFile.readU32()
      const length = patchFile.readU8()

      if (length === APS_RECORD_RLE) {
        const byte = patchFile.readU8()
        const rleLength = patchFile.readU8()
        patch.addRLERecord(offset, byte, rleLength)
      } else {
        const data = Array.from(patchFile.readBytes(length))
        patch.addRecord(offset, data)
      }
    }

    return patch
  },

  create(originalFile: BinaryFile, modifiedFile: BinaryFile): APSPatch {
    const patch = new APSPatch()

    // Check if N64 ROM
    originalFile.seek(0)
    if (originalFile.readU32() === 0x80371240) {
      patch.headerType = APS_N64_MODE

      patch.header.originalN64Format = /\.v64$/i.test(originalFile.fileName) ? 0 : 1
      originalFile.seek(0x3c)
      patch.header.cartId = originalFile.readString(3, 'ascii')
      originalFile.seek(0x10)
      patch.header.crc = Array.from(originalFile.readBytes(8))
      patch.header.pad = [0, 0, 0, 0, 0]
    }
    
    patch.header.sizeOutput = modifiedFile.fileSize

    originalFile.seek(0)
    modifiedFile.seek(0)

    while (!modifiedFile.isEOF()) {
      const b1 = originalFile.isEOF() ? 0x00 : originalFile.readU8()
      const b2 = modifiedFile.readU8()

      if (b1 !== b2) {
        let RLERecord = true
        const differentBytes: number[] = []
        const offset = modifiedFile.offset - 1

        while (b1 !== b2 && differentBytes.length < 0xff) {
          differentBytes.push(b2)
          if (b2 !== differentBytes[0]) {
            RLERecord = false
          }

          if (modifiedFile.isEOF() || differentBytes.length === 0xff) {
            break
          }

          const nb1 = originalFile.isEOF() ? 0x00 : originalFile.readU8()
          const nb2 = modifiedFile.readU8()
          
          if (nb1 === nb2) break
        }

        if (RLERecord && differentBytes.length > 2) {
          patch.addRLERecord(offset, differentBytes[0], differentBytes.length)
        } else {
          patch.addRecord(offset, differentBytes)
        }
      }
    }

    return patch
  }
}
