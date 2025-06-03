// PMSR (Paper Mario Star Rod) format implementation for Byte-Forge
// Paper Mario specific patch format for N64 ROM modifications
// Based on: http://origami64.net/attachment.php?aid=790 (specification)

import { BinFile } from '../core/binary-file'
import type { PatchFile, PatchFormatModule } from '../types/rom-patcher'

const PMSR_MAGIC = 'PMSR'
const YAY0_MAGIC = 'Yay0'
const PAPER_MARIO_USA10_CRC32 = 0xa7f5cd7e
const PAPER_MARIO_USA10_FILE_SIZE = 41943040

export interface PMSRRecord {
  offset: number
  data: Uint8Array
}

export class PMSRPatch implements PatchFile {
  public targetSize: number = 0
  public records: PMSRRecord[] = []

  constructor() {
    // Initialize empty patch
  }

  addRecord(offset: number, data: Uint8Array): void {
    this.records.push({
      offset,
      data
    })
  }

  validateSource(romFile: BinFile): boolean {
    return romFile.fileSize === PAPER_MARIO_USA10_FILE_SIZE && 
           romFile.hashCRC32() === PAPER_MARIO_USA10_CRC32
  }

  getValidationInfo(): { type: string; value: number } {
    return {
      type: 'CRC32',
      value: PAPER_MARIO_USA10_CRC32
    }
  }

  apply(romFile: BinFile, validate: boolean = true): BinFile {
    if (validate && !this.validateSource(romFile)) {
      throw new Error('Source ROM checksum mismatch')
    }

    let tempFile: BinFile
    if (this.targetSize === romFile.fileSize) {
      tempFile = romFile.clone()
    } else {
      tempFile = new BinFile(this.targetSize)
      romFile.copyTo(tempFile, 0)
    }

    for (const record of this.records) {
      tempFile.seek(record.offset)
      tempFile.writeBytes(record.data)
    }
    
    return tempFile
  }

  export(fileName: string = 'patch'): BinFile {
    // Calculate total size needed
    let patchFileSize = 8 // PMSR magic + record count
    for (const record of this.records) {
      patchFileSize += 8 + record.data.length // offset + length + data
    }

    const tempFile = new BinFile(patchFileSize)
    tempFile.fileName = `${fileName}.pmsr`
    
    // Write header
    tempFile.writeString(PMSR_MAGIC)
    tempFile.writeU32(this.records.length)

    // Write records
    for (const record of this.records) {
      tempFile.writeU32(record.offset)
      tempFile.writeU32(record.data.length)
      tempFile.writeBytes(record.data)
    }

    return tempFile
  }

  toString(): string {
    let s = 'Star Rod patch'
    s += `\nTarget file size: ${this.targetSize}`
    s += `\n#Records: ${this.records.length}`
    return s
  }

  static fromFile(patchFile: BinFile): PMSRPatch | null {
    patchFile.seek(0)
    
    // Check magic
    if (patchFile.readString(PMSR_MAGIC.length) !== PMSR_MAGIC) {
      return null
    }

    const patch = new PMSRPatch()
    patch.targetSize = PAPER_MARIO_USA10_FILE_SIZE

    const nRecords = patchFile.readU32()

    for (let i = 0; i < nRecords; i++) {
      const offset = patchFile.readU32()
      const length = patchFile.readU32()
      const data = patchFile.readBytes(length)
      
      patch.addRecord(offset, new Uint8Array(data))

      // Update target size if this record extends beyond current size
      if ((offset + length) > patch.targetSize) {
        patch.targetSize = offset + length
      }
    }

    return patch
  }

  static buildFromRoms(original: BinFile, modified: BinFile, description?: string): PMSRPatch {
    const patch = new PMSRPatch()
    patch.targetSize = modified.fileSize

    // Ensure both files start at beginning
    original.seek(0)
    modified.seek(0)

    // Find all differences
    const differences: Array<{ offset: number; data: number[] }> = []
    let currentDiff: { offset: number; data: number[] } | null = null

    while (!modified.isEOF()) {
      const offset = modified.offset
      const originalByte = original.isEOF() ? 0x00 : original.readU8()
      const modifiedByte = modified.readU8()

      if (originalByte !== modifiedByte) {
        if (!currentDiff || offset !== currentDiff.offset + currentDiff.data.length) {
          // Start new difference block
          if (currentDiff) {
            differences.push(currentDiff)
          }
          currentDiff = { offset, data: [modifiedByte] }
        } else {
          // Continue current difference block
          currentDiff.data.push(modifiedByte)
        }
      } else if (currentDiff) {
        // End current difference block
        differences.push(currentDiff)
        currentDiff = null
      }
    }

    // Add final difference if exists
    if (currentDiff) {
      differences.push(currentDiff)
    }

    // Convert differences to records
    for (const diff of differences) {
      patch.addRecord(diff.offset, new Uint8Array(diff.data))
    }

    return patch
  }

  // TODO: Implement YAY0 decompression for compressed PMSR files
  static yay0Decode(file: BinFile): BinFile {
    // Placeholder implementation
    // The original JavaScript implementation was incomplete
    throw new Error('YAY0 decompression not yet implemented')
  }
}

// Module export for format registration
export const PMSRModule: PatchFormatModule<PMSRPatch> = {
  name: 'PMSR',
  extension: '.pmsr',
  magic: PMSR_MAGIC,
  
  identify: (data: Uint8Array): boolean => {
    if (data.length < PMSR_MAGIC.length) return false
    const magic = new TextDecoder().decode(data.slice(0, PMSR_MAGIC.length))
    return magic === PMSR_MAGIC
  },
  
  create: (): PMSRPatch => new PMSRPatch(),
  
  parse: (file: BinFile): PMSRPatch | null => PMSRPatch.fromFile(file),
  
  build: (original: BinFile, modified: BinFile, metadata?: any): PMSRPatch => 
    PMSRPatch.buildFromRoms(original, modified, metadata?.description)
}
