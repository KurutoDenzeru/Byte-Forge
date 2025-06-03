import type { BinaryFile, PatchFile, PatchRecord, PatchFormatModule } from '../types/rom-patcher'
import { BinFile } from '../core/binary-file'
import { InvalidPatchFileError } from '../types/rom-patcher'

export const PPF_MAGIC = 'PPF'
export const PPF_BEGIN_FILE_ID_DIZ_MAGIC = '@BEGIN_FILE_ID.DIZ'
export const PPF_IMAGETYPE_BIN = 0

interface PPFRecord {
  offset: number
  data: number[]
  undoData?: number[]
}

export class PPFPatch implements PatchFile {
  public version: number = 3
  public imageType: number = PPF_IMAGETYPE_BIN
  public blockCheck: boolean | number[] = false
  public undoData: boolean = false
  public records: PPFRecord[] = []
  public description: string = 'Patch description'
  public fileIdDiz?: string
  public inputFileSize?: number

  // PatchFile interface compatibility
  get patchRecords(): PatchRecord[] {
    return this.records.map(record => ({
      offset: record.offset,
      type: 1, // Simple record type
      length: record.data.length,
      data: new Uint8Array(record.data)
    }))
  }

  constructor() {}

  addRecord(offset: number, data: number[], undoData?: number[]): void {
    this.records.push({
      offset: offset,
      data: data,
      undoData: undoData
    })
  }

  toString(): string {
    let result = `Version: ${this.version}\n`
    result += `Description: ${this.description}\n`
    result += `Image type: ${this.imageType}\n`
    result += `Block check: ${!!this.blockCheck}\n`
    result += `Undo data: ${this.undoData}`
    
    if (this.fileIdDiz) {
      result += `\nFILE_ID.DIZ: ${this.fileIdDiz}`
    }
    
    return result
  }

  validateSource(romFile: BinaryFile, skipHeaderSize: number = 0): boolean {
    if (this.version === 2 && this.inputFileSize) {
      return romFile.fileSize === this.inputFileSize
    }
    
    if (Array.isArray(this.blockCheck) && this.blockCheck.length === 1024) {
      romFile.seek(0)
      const first1024 = Array.from(romFile.readBytes(1024))
      return JSON.stringify(first1024) === JSON.stringify(this.blockCheck)
    }
    
    return true
  }

  apply(romFile: BinaryFile, validate: boolean = true): BinaryFile {
    if (validate && !this.validateSource(romFile)) {
      throw new Error('Source ROM validation failed')
    }

    const tempFile = romFile.clone()

    // Apply patches
    for (const record of this.records) {
      tempFile.seek(record.offset)
      tempFile.writeBytes(new Uint8Array(record.data))
    }

    // Update filename
    const baseName = romFile.getName()
    const extension = romFile.getExtension()
    const suffix = extension ? `.${extension}` : ''
    tempFile.setName(`${baseName} (patched)${suffix}`)

    return tempFile
  }

  export(fileName?: string): BinaryFile {
    let patchFileSize = 5 + 1 + 50 // PPFx0
    
    for (const record of this.records) {
      patchFileSize += 4 + 1 + record.data.length
      if (this.version === 3) {
        patchFileSize += 4 // offsets are u64
      }
    }

    if (this.version === 3 || this.version === 2) {
      patchFileSize += 4
    }
    
    if (this.blockCheck) {
      patchFileSize += 1024
    }
    
    if (this.fileIdDiz) {
      patchFileSize += 18 + this.fileIdDiz.length + 16 + 4
    }

    const tempFile = new BinFile(patchFileSize)
    tempFile.setName((fileName || 'patch') + '.ppf')
    
    tempFile.writeString(PPF_MAGIC, 'ascii')
    tempFile.writeString((this.version * 10).toString().padStart(2, '0'), 'ascii')
    tempFile.writeU8(this.version + 1)
    tempFile.writeString(this.description.padEnd(50, ' '), 'ascii')

    if (this.version === 3) {
      tempFile.writeU8(this.imageType)
      tempFile.writeU8(this.blockCheck ? 1 : 0)
      tempFile.writeU8(this.undoData ? 1 : 0)
      tempFile.writeU8(0) // padding
    } else if (this.version === 2) {
      tempFile.writeU32(this.inputFileSize || 0)
    }

    if (Array.isArray(this.blockCheck)) {
      tempFile.writeBytes(new Uint8Array(this.blockCheck))
    }

    tempFile.littleEndian = true
    
    for (const record of this.records) {
      if (this.version === 3) {
        // Write 64-bit offset (as two 32-bit values)
        tempFile.writeU32(record.offset & 0xFFFFFFFF)
        tempFile.writeU32((record.offset >> 32) & 0xFFFFFFFF)
      } else {
        tempFile.writeU32(record.offset)
      }
      
      tempFile.writeU8(record.data.length)
      tempFile.writeBytes(new Uint8Array(record.data))
      
      if (this.undoData && record.undoData) {
        tempFile.writeBytes(new Uint8Array(record.undoData))
      }
    }

    if (this.fileIdDiz) {
      tempFile.writeString(PPF_BEGIN_FILE_ID_DIZ_MAGIC, 'ascii')
      tempFile.writeU8(0) // padding
      tempFile.writeU8(0)
      tempFile.writeU32(this.fileIdDiz.length + 16)
      tempFile.writeString(this.fileIdDiz, 'ascii')
      tempFile.writeString('@END_FILE_ID.DIZ', 'ascii')
    }

    return tempFile
  }
}

export const PPF: PatchFormatModule = {
  MAGIC: PPF_MAGIC,

  fromFile(patchFile: BinaryFile): PPFPatch {
    const patch = new PPFPatch()

    patchFile.seek(3)
    const version1 = parseInt(patchFile.readString(2, 'ascii')) / 10
    const version2 = patchFile.readU8() + 1
    
    if (version1 !== version2 || version1 > 3) {
      throw new InvalidPatchFileError('Invalid PPF version')
    }

    patch.version = version1
    patch.description = patchFile.readString(50, 'ascii').replace(/ +$/, '')

    if (patch.version === 3) {
      patch.imageType = patchFile.readU8()
      if (patchFile.readU8()) {
        patch.blockCheck = true
      }
      if (patchFile.readU8()) {
        patch.undoData = true
      }
      patchFile.skip(1) // padding
    } else if (patch.version === 2) {
      patch.blockCheck = true
      patch.inputFileSize = patchFile.readU32()
    }

    if (patch.blockCheck) {
      patch.blockCheck = Array.from(patchFile.readBytes(1024))
    }

    patchFile.littleEndian = true
    
    while (!patchFile.isEOF()) {
      if (patchFile.readString(4, 'ascii') === PPF_BEGIN_FILE_ID_DIZ_MAGIC.slice(1, 5)) {
        patchFile.skip(14)
        patch.fileIdDiz = patchFile.readString(3072, 'ascii')
        patch.fileIdDiz = patch.fileIdDiz.substr(0, patch.fileIdDiz.indexOf('@END_FILE_ID.DIZ'))
        break
      }
      patchFile.skip(-4)

      let offset: number
      if (patch.version === 3) {
        const u64_1 = patchFile.readU32()
        const u64_2 = patchFile.readU32()
        offset = u64_1 + (u64_2 * 0x100000000)
      } else {
        offset = patchFile.readU32()
      }

      const len = patchFile.readU8()
      const data = Array.from(patchFile.readBytes(len))

      let undoData: number[] | undefined
      if (patch.undoData) {
        undoData = Array.from(patchFile.readBytes(len))
      }

      patch.addRecord(offset, data, undoData)
    }

    return patch
  },

  create(originalFile: BinaryFile, modifiedFile: BinaryFile): PPFPatch {
    const patch = new PPFPatch()
    patch.description = 'Patch description'

    if (originalFile.fileSize > modifiedFile.fileSize) {
      const expandedModified = new BinFile(originalFile.fileSize)
      modifiedFile.copyTo(expandedModified, 0)
      modifiedFile = expandedModified
    }

    originalFile.seek(0)
    modifiedFile.seek(0)
    
    while (!modifiedFile.isEOF()) {
      const b1 = originalFile.isEOF() ? 0x00 : originalFile.readU8()
      const b2 = modifiedFile.readU8()

      if (b1 !== b2) {
        const differentData: number[] = []
        const offset = modifiedFile.offset - 1

        while (b1 !== b2 && differentData.length < 0xff) {
          differentData.push(b2)

          if (modifiedFile.isEOF() || differentData.length === 0xff) {
            break
          }

          const nb1 = originalFile.isEOF() ? 0x00 : originalFile.readU8()
          const nb2 = modifiedFile.readU8()
          
          if (nb1 === nb2) break
        }

        patch.addRecord(offset, differentData)
      }
    }

    if (originalFile.fileSize < modifiedFile.fileSize) {
      modifiedFile.seek(modifiedFile.fileSize - 1)
      if (modifiedFile.readU8() === 0x00) {
        patch.addRecord(modifiedFile.fileSize - 1, [0x00])
      }
    }

    return patch
  }
}
