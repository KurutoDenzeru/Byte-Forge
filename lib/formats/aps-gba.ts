// APS GBA format implementation for Byte-Forge
// Game Boy Advance specific patch format with block-based XOR patching
// Based on: https://github.com/btimofeev/UniPatcher/wiki/APS-(GBA)

import { BinFile } from '../core/binary-file'
import type { BinaryFile, PatchFile, PatchRecord, PatchFormatModule } from '../types/rom-patcher'

const APS_GBA_MAGIC = 'APS1'
const APS_GBA_BLOCK_SIZE = 0x010000 // 64KB
const APS_GBA_RECORD_SIZE = 4 + 2 + 2 + APS_GBA_BLOCK_SIZE

export interface APSGBARecord {
  offset: number
  sourceCrc16: number
  targetCrc16: number
  xorBytes: Uint8Array
}

export class APSGBAPatch implements PatchFile {
  public sourceSize: number = 0
  public targetSize: number = 0
  public apsRecords: APSGBARecord[] = []

  // PatchFile interface compatibility
  get records(): PatchRecord[] {
    return this.apsRecords.map(record => ({
      offset: record.offset,
      type: 1, // Simple record type
      length: record.xorBytes.length,
      data: record.xorBytes
    }))
  }

  constructor() {
    // Initialize empty patch
  }
  addRecord(offset: number, sourceCrc16: number, targetCrc16: number, xorBytes: Uint8Array): void {
    this.apsRecords.push({
      offset,
      sourceCrc16,
      targetCrc16,
      xorBytes
    })
  }
  validateSource(sourceFile: BinaryFile, skipHeaderSize: number = 0): boolean {
    if (sourceFile.fileSize !== this.sourceSize) {
      return false
    }

    for (const record of this.apsRecords) {
      sourceFile.seek(record.offset + skipHeaderSize)
      if (sourceFile.hashCRC16(record.offset + skipHeaderSize, APS_GBA_BLOCK_SIZE) !== record.sourceCrc16) {
        return false
      }
    }

    return true
  }

  getValidationInfo(): { type: string; value: number } {
    return {
      type: 'CRC16',
      value: this.sourceSize
    }
  }
  apply(romFile: BinaryFile): BinaryFile {
    if (!this.validateSource(romFile)) {
      throw new Error('Source ROM checksum mismatch')
    }

    const tempFile = new BinFile(this.targetSize)
    romFile.copyTo(tempFile, 0, romFile.fileSize)

    for (const record of this.apsRecords) {
      romFile.seek(record.offset)
      tempFile.seek(record.offset)
      
      for (let j = 0; j < APS_GBA_BLOCK_SIZE; j++) {
        const sourceByte = romFile.readU8()
        const xorByte = record.xorBytes[j]
        tempFile.writeU8(sourceByte ^ xorByte)
      }

      if (tempFile.hashCRC16(record.offset, APS_GBA_BLOCK_SIZE) !== record.targetCrc16) {
        throw new Error('Target ROM checksum mismatch')
      }
    }

    return tempFile
  }
  export(fileName: string = 'patch'): BinaryFile {
    const patchFileSize = 12 + (this.apsRecords.length * APS_GBA_RECORD_SIZE)
    const tempFile = new BinFile(patchFileSize)
    
    tempFile.fileName = `${fileName}.aps`
    tempFile.littleEndian = true
    tempFile.writeString(APS_GBA_MAGIC)
    tempFile.writeU32(this.sourceSize)
    tempFile.writeU32(this.targetSize)

    for (const record of this.apsRecords) {
      tempFile.writeU32(record.offset)
      tempFile.writeU16(record.sourceCrc16)
      tempFile.writeU16(record.targetCrc16)
      tempFile.writeBytes(record.xorBytes)
    }

    return tempFile
  }

  toString(): string {
    let s = `Total records: ${this.records.length}`
    s += `\nInput file size: ${this.sourceSize}`
    s += `\nOutput file size: ${this.targetSize}`
    return s
  }

  static fromFile(patchFile: BinFile): APSGBAPatch | null {
    patchFile.seek(0)
    patchFile.littleEndian = true

    if (
      patchFile.readString(APS_GBA_MAGIC.length) !== APS_GBA_MAGIC ||
      patchFile.fileSize < (12 + APS_GBA_RECORD_SIZE) ||
      (patchFile.fileSize - 12) % APS_GBA_RECORD_SIZE !== 0
    ) {
      return null
    }

    const patch = new APSGBAPatch()
    patch.sourceSize = patchFile.readU32()
    patch.targetSize = patchFile.readU32()

    while (!patchFile.isEOF()) {
      const offset = patchFile.readU32()
      const sourceCrc16 = patchFile.readU16()
      const targetCrc16 = patchFile.readU16()
      const xorBytes = patchFile.readBytes(APS_GBA_BLOCK_SIZE)
      
      patch.addRecord(offset, sourceCrc16, targetCrc16, new Uint8Array(xorBytes))
    }

    return patch
  }

  static buildFromRoms(original: BinFile, modified: BinFile): APSGBAPatch {
    const patch = new APSGBAPatch()
    patch.sourceSize = original.fileSize
    patch.targetSize = modified.fileSize

    // Ensure modified file is at least as large as original
    if (original.fileSize > modified.fileSize) {
      const expandedModified = new BinFile(original.fileSize)
      modified.copyTo(expandedModified, 0)
      modified = expandedModified
    }

    original.seek(0)
    modified.seek(0)

    // Process in 64KB blocks
    let offset = 0
    while (offset < Math.max(original.fileSize, modified.fileSize)) {
      const blockSize = Math.min(APS_GBA_BLOCK_SIZE, Math.max(original.fileSize, modified.fileSize) - offset)
      
      // Read blocks
      original.seek(offset)
      modified.seek(offset)
      
      const originalBlock = new Uint8Array(blockSize)
      const modifiedBlock = new Uint8Array(blockSize)
      
      for (let i = 0; i < blockSize; i++) {
        originalBlock[i] = original.isEOF() ? 0x00 : original.readU8()
        modifiedBlock[i] = modified.isEOF() ? 0x00 : modified.readU8()
      }

      // Check if block needs patching
      let needsPatch = false
      for (let i = 0; i < blockSize; i++) {
        if (originalBlock[i] !== modifiedBlock[i]) {
          needsPatch = true
          break
        }
      }

      if (needsPatch) {
        // Create XOR block
        const xorBytes = new Uint8Array(APS_GBA_BLOCK_SIZE)
        for (let i = 0; i < APS_GBA_BLOCK_SIZE; i++) {
          const origByte = i < blockSize ? originalBlock[i] : 0x00
          const modByte = i < blockSize ? modifiedBlock[i] : 0x00
          xorBytes[i] = origByte ^ modByte
        }

        // Calculate checksums
        const sourceCrc16 = original.hashCRC16(offset, APS_GBA_BLOCK_SIZE)
        modified.seek(offset)
        const targetCrc16 = modified.hashCRC16(offset, APS_GBA_BLOCK_SIZE)

        patch.addRecord(offset, sourceCrc16, targetCrc16, xorBytes)
      }

      offset += APS_GBA_BLOCK_SIZE
    }

    return patch
  }
}

// Module export for format registration
export const APSGBAModule: PatchFormatModule<APSGBAPatch> = {
  name: 'APS-GBA',
  extension: '.aps',
  magic: APS_GBA_MAGIC,
  
  identify: (data: Uint8Array): boolean => {
    if (data.length < APS_GBA_MAGIC.length) return false
    const magic = new TextDecoder().decode(data.slice(0, APS_GBA_MAGIC.length))
    return magic === APS_GBA_MAGIC
  },
  
  create: (): APSGBAPatch => new APSGBAPatch(),
  parse: (file: BinaryFile): APSGBAPatch | null => {
    if (file instanceof BinFile) {
      return APSGBAPatch.fromFile(file)
    }
    // Convert BinaryFile to BinFile if needed
    const binFile = new BinFile(file.data)
    binFile.fileName = file.fileName
    return APSGBAPatch.fromFile(binFile)
  },
  
  build: (original: BinaryFile, modified: BinaryFile): APSGBAPatch => {
    const origBinFile = original instanceof BinFile ? original : new BinFile(original.data)
    const modBinFile = modified instanceof BinFile ? modified : new BinFile(modified.data)
    return APSGBAPatch.buildFromRoms(origBinFile, modBinFile)
  }
}
