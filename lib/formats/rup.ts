import type { BinaryFile, PatchFile, PatchRecord, PatchFormatModule } from '../types/rom-patcher'
import { BinFile } from '../core/binary-file'
import { InvalidPatchFileError } from '../types/rom-patcher'

export const RUP_MAGIC = 'NINJA2'
export const RUP_COMMAND_END = 0x00
export const RUP_COMMAND_OPEN_NEW_FILE = 0x01
export const RUP_COMMAND_XOR_RECORD = 0x02

const RUP_ROM_TYPES = ['raw', 'nes', 'fds', 'snes', 'n64', 'gb', 'sms', 'mega', 'pce', 'lynx']

interface RUPFile {
  fileName: string
  romType: number
  sourceFileSize: number
  targetFileSize: number
  sourceMD5: string
  targetMD5: string
  overflowMode?: string
  overflowData: number[]
  records: RUPRecord[]
}

interface RUPRecord {
  offset: number
  xor: number[]
}

export class RUPPatch implements PatchFile {
  public author: string = ''
  public version: string = ''
  public title: string = ''
  public genre: string = ''
  public language: string = ''
  public date: string = ''
  public web: string = ''
  public description: string = ''
  public textEncoding: number = 0
  public files: RUPFile[] = []

  // PatchFile interface compatibility
  get patchRecords(): PatchRecord[] {
    // Flatten all file records to match interface
    const records: PatchRecord[] = []
    for (const file of this.files) {
      for (const record of file.records) {
        records.push({
          offset: record.offset,
          type: 'XOR',
          data: record.xor
        })
      }
    }
    return records
  }

  constructor() {}

  toString(): string {
    let result = `Author: ${this.author}\n`
    result += `Version: ${this.version}\n`
    result += `Title: ${this.title}\n`
    result += `Genre: ${this.genre}\n`
    result += `Language: ${this.language}\n`
    result += `Date: ${this.date}\n`
    result += `Web: ${this.web}\n`
    result += `Description: ${this.description}\n`
    
    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i]
      result += `\n---------------\n`
      result += `File ${i}:\n`
      result += `File name: ${file.fileName}\n`
      result += `Rom type: ${RUP_ROM_TYPES[file.romType] || 'unknown'}\n`
      result += `Source file size: ${file.sourceFileSize}\n`
      result += `Target file size: ${file.targetFileSize}\n`
      result += `Source MD5: ${file.sourceMD5}\n`
      result += `Target MD5: ${file.targetMD5}\n`
      
      if (file.overflowMode === 'A') {
        result += `Overflow mode: Append ${file.overflowData.length} bytes\n`
      } else if (file.overflowMode === 'M') {
        result += `Overflow mode: Minify ${file.overflowData.length} bytes\n`
      }
      
      result += `#records: ${file.records.length}`
    }
    
    return result
  }

  validateSource(romFile: BinaryFile, headerSize: number = 0): boolean {
    const md5String = romFile.hashMD5(headerSize)
    for (const file of this.files) {
      if (file.sourceMD5 === md5String || file.targetMD5 === md5String) {
        return true
      }
    }
    return false
  }

  apply(romFile: BinaryFile, validate: boolean = true): BinaryFile {
    let validFile: { file: RUPFile; undo: boolean } | null = null
    
    if (validate) {
      const md5String = romFile.hashMD5()
      for (const file of this.files) {
        if (file.sourceMD5 === md5String || file.targetMD5 === md5String) {
          validFile = {
            file: file,
            undo: file.targetMD5 === md5String
          }
          break
        }
      }
      
      if (!validFile) {
        throw new Error('Source ROM checksum mismatch')
      }
    } else {
      validFile = {
        file: this.files[0],
        undo: this.files[0].targetMD5 === romFile.hashMD5()
      }
    }

    const undo = validFile.undo
    const patch = validFile.file

    const tempFile = new BinFile(!undo ? patch.targetFileSize : patch.sourceFileSize)
    
    // Copy original file
    romFile.copyTo(tempFile, 0)

    // Apply XOR patches
    for (const record of patch.records) {
      romFile.seek(record.offset)
      tempFile.seek(record.offset)
      
      for (const xorByte of record.xor) {
        const originalByte = romFile.isEOF() ? 0x00 : romFile.readU8()
        tempFile.writeU8(originalByte ^ xorByte)
      }
    }

    // Add overflow data if needed
    if (patch.overflowMode === 'A' && !undo) { // append
      tempFile.seek(patch.sourceFileSize)
      const unmaskedData = patch.overflowData.map(byte => byte ^ 0xff)
      tempFile.writeBytes(new Uint8Array(unmaskedData))
    } else if (patch.overflowMode === 'M' && undo) { // minify
      tempFile.seek(patch.targetFileSize)
      const unmaskedData = patch.overflowData.map(byte => byte ^ 0xff)
      tempFile.writeBytes(new Uint8Array(unmaskedData))
    }

    // Validate output if required
    if (validate) {
      const outputMD5 = tempFile.hashMD5()
      const expectedMD5 = !undo ? patch.targetMD5 : patch.sourceMD5
      
      if (outputMD5 !== expectedMD5) {
        throw new Error('Target ROM checksum mismatch')
      }
    }

    // Update filename
    const baseName = romFile.getName()
    const extension = romFile.getExtension()
    const suffix = extension ? `.${extension}` : ''
    const patchSuffix = undo ? ' (unpatched)' : ' (patched)'
    tempFile.setName(`${baseName}${patchSuffix}${suffix}`)

    return tempFile
  }

  export(fileName?: string): BinaryFile {
    // Calculate patch file size
    let patchFileSize = 2048 // Header size
    
    for (const file of this.files) {
      patchFileSize++ // command 0x01
      patchFileSize += this.getVLVLength(file.fileName.length)
      patchFileSize += file.fileName.length
      patchFileSize++ // rom type
      patchFileSize += this.getVLVLength(file.sourceFileSize)
      patchFileSize += this.getVLVLength(file.targetFileSize)
      patchFileSize += 32 // MD5s
      
      if (file.sourceFileSize !== file.targetFileSize) {
        patchFileSize++ // M or A
        patchFileSize += this.getVLVLength(file.overflowData.length)
        patchFileSize += file.overflowData.length
      }
      
      for (const record of file.records) {
        patchFileSize++ // command 0x02
        patchFileSize += this.getVLVLength(record.offset)
        patchFileSize += this.getVLVLength(record.xor.length)
        patchFileSize += record.xor.length
      }
    }
    
    patchFileSize++ // command 0x00

    const patchFile = new BinFile(patchFileSize)
    patchFile.setName((fileName || 'patch') + '.rup')

    // Write header
    patchFile.writeString(RUP_MAGIC, 'ascii')
    patchFile.writeU8(this.textEncoding)
    patchFile.writeString(this.author.padEnd(84, '\0'), 'ascii')
    patchFile.writeString(this.version.padEnd(11, '\0'), 'ascii')
    patchFile.writeString(this.title.padEnd(256, '\0'), 'ascii')
    patchFile.writeString(this.genre.padEnd(48, '\0'), 'ascii')
    patchFile.writeString(this.language.padEnd(48, '\0'), 'ascii')
    patchFile.writeString(this.date.padEnd(8, '\0'), 'ascii')
    patchFile.writeString(this.web.padEnd(512, '\0'), 'ascii')
    patchFile.writeString(this.description.replace(/\n/g, '\\n').padEnd(1074, '\0'), 'ascii')

    // Write files
    for (const file of this.files) {
      patchFile.writeU8(RUP_COMMAND_OPEN_NEW_FILE)

      this.writeVLV(patchFile, file.fileName.length)
      patchFile.writeString(file.fileName, 'ascii')
      patchFile.writeU8(file.romType)
      this.writeVLV(patchFile, file.sourceFileSize)
      this.writeVLV(patchFile, file.targetFileSize)

      // Write MD5s
      for (let j = 0; j < 16; j++) {
        patchFile.writeU8(parseInt(file.sourceMD5.substr(j * 2, 2), 16))
      }
      for (let j = 0; j < 16; j++) {
        patchFile.writeU8(parseInt(file.targetMD5.substr(j * 2, 2), 16))
      }

      // Write overflow data if needed
      if (file.sourceFileSize !== file.targetFileSize) {
        patchFile.writeString(file.sourceFileSize > file.targetFileSize ? 'M' : 'A', 'ascii')
        this.writeVLV(patchFile, file.overflowData.length)
        patchFile.writeBytes(new Uint8Array(file.overflowData))
      }

      // Write records
      for (const record of file.records) {
        patchFile.writeU8(RUP_COMMAND_XOR_RECORD)
        this.writeVLV(patchFile, record.offset)
        this.writeVLV(patchFile, record.xor.length)
        patchFile.writeBytes(new Uint8Array(record.xor))
      }
    }

    patchFile.writeU8(RUP_COMMAND_END)

    return patchFile
  }

  private readVLV(file: BinaryFile): number {
    const nBytes = file.readU8()
    let data = 0
    
    for (let i = 0; i < nBytes; i++) {
      data += file.readU8() << (i * 8)
    }
    
    return data
  }

  private writeVLV(file: BinaryFile, data: number): void {
    const len = this.getVLVLength(data) - 1
    file.writeU8(len)

    while (data) {
      file.writeU8(data & 0xff)
      data >>= 8
    }
  }

  private getVLVLength(data: number): number {
    let ret = 1
    while (data) {
      ret++
      data >>= 8
    }
    return ret
  }

  private static padZeroes(intVal: number, nBytes: number): string {
    let hexString = intVal.toString(16)
    while (hexString.length < nBytes * 2) {
      hexString = '0' + hexString
    }
    return hexString
  }
}

export const RUP: PatchFormatModule = {
  MAGIC: RUP_MAGIC,

  fromFile(patchFile: BinaryFile): RUPPatch {
    const patch = new RUPPatch()

    patchFile.seek(RUP_MAGIC.length)

    patch.textEncoding = patchFile.readU8()
    patch.author = patchFile.readString(84, 'ascii').replace(/\0.*$/, '')
    patch.version = patchFile.readString(11, 'ascii').replace(/\0.*$/, '')
    patch.title = patchFile.readString(256, 'ascii').replace(/\0.*$/, '')
    patch.genre = patchFile.readString(48, 'ascii').replace(/\0.*$/, '')
    patch.language = patchFile.readString(48, 'ascii').replace(/\0.*$/, '')
    patch.date = patchFile.readString(8, 'ascii').replace(/\0.*$/, '')
    patch.web = patchFile.readString(512, 'ascii').replace(/\0.*$/, '')
    patch.description = patchFile.readString(1074, 'ascii').replace(/\0.*$/, '').replace(/\\n/g, '\n')

    patchFile.seek(0x800)
    let nextFile: RUPFile | null = null
    
    while (!patchFile.isEOF()) {
      const command = patchFile.readU8()

      if (command === RUP_COMMAND_OPEN_NEW_FILE) {
        if (nextFile) {
          patch.files.push(nextFile)
        }

        nextFile = {
          fileName: '',
          romType: 0,
          sourceFileSize: 0,
          targetFileSize: 0,
          sourceMD5: '',
          targetMD5: '',
          overflowData: [],
          records: []
        }

        const fileNameLength = patch.readVLV(patchFile)
        nextFile.fileName = patchFile.readString(fileNameLength, 'ascii')
        nextFile.romType = patchFile.readU8()
        nextFile.sourceFileSize = patch.readVLV(patchFile)
        nextFile.targetFileSize = patch.readVLV(patchFile)

        // Read source MD5
        nextFile.sourceMD5 = ''
        for (let i = 0; i < 16; i++) {
          nextFile.sourceMD5 += RUPPatch.padZeroes(patchFile.readU8(), 1)
        }

        // Read target MD5
        nextFile.targetMD5 = ''
        for (let i = 0; i < 16; i++) {
          nextFile.targetMD5 += RUPPatch.padZeroes(patchFile.readU8(), 1)
        }

        // Read overflow data if needed
        if (nextFile.sourceFileSize !== nextFile.targetFileSize) {
          nextFile.overflowMode = patchFile.readString(1, 'ascii') // 'M' or 'A'
          if (nextFile.overflowMode !== 'M' && nextFile.overflowMode !== 'A') {
            throw new InvalidPatchFileError('RUP: invalid overflow mode')
          }
          const overflowLength = patch.readVLV(patchFile)
          nextFile.overflowData = Array.from(patchFile.readBytes(overflowLength))
        }

      } else if (command === RUP_COMMAND_XOR_RECORD) {
        if (!nextFile) {
          throw new InvalidPatchFileError('RUP: XOR record before file declaration')
        }
        
        const offset = patch.readVLV(patchFile)
        const xorLength = patch.readVLV(patchFile)
        const xor = Array.from(patchFile.readBytes(xorLength))
        
        nextFile.records.push({ offset, xor })

      } else if (command === RUP_COMMAND_END) {
        if (nextFile) {
          patch.files.push(nextFile)
        }
        break

      } else {
        throw new InvalidPatchFileError('invalid RUP command')
      }
    }

    return patch
  },

  create(originalFile: BinaryFile, modifiedFile: BinaryFile, metadata?: Record<string, string>): RUPPatch {
    const patch = new RUPPatch()

    // Set metadata
    if (metadata) {
      patch.author = metadata.author || ''
      patch.version = metadata.version || ''
      patch.title = metadata.title || ''
      patch.genre = metadata.genre || ''
      patch.language = metadata.language || ''
      patch.web = metadata.web || ''
      patch.description = metadata.description || ''
    }

    // Set date
    const today = new Date()
    patch.date = (today.getFullYear()).toString() + 
                 RUPPatch.padZeroes(today.getMonth() + 1, 1) + 
                 RUPPatch.padZeroes(today.getDate(), 1)

    const file: RUPFile = {
      fileName: '',
      romType: 0,
      sourceFileSize: originalFile.fileSize,
      targetFileSize: modifiedFile.fileSize,
      sourceMD5: originalFile.hashMD5(),
      targetMD5: modifiedFile.hashMD5(),
      overflowData: [],
      records: []
    }

    // Handle overflow data
    if (file.sourceFileSize < file.targetFileSize) {
      modifiedFile.seek(file.sourceFileSize)
      file.overflowMode = 'A'
      const overflowBytes = modifiedFile.readBytes(file.targetFileSize - file.sourceFileSize)
      file.overflowData = Array.from(overflowBytes).map(byte => byte ^ 0xff)
      modifiedFile = modifiedFile.slice(0, file.sourceFileSize)
    } else if (file.sourceFileSize > file.targetFileSize) {
      originalFile.seek(file.targetFileSize)
      file.overflowMode = 'M'
      const overflowBytes = originalFile.readBytes(file.sourceFileSize - file.targetFileSize)
      file.overflowData = Array.from(overflowBytes).map(byte => byte ^ 0xff)
      originalFile = originalFile.slice(0, file.targetFileSize)
    }

    // Compare files and create XOR records
    originalFile.seek(0)
    modifiedFile.seek(0)

    while (!modifiedFile.isEOF()) {
      const b1 = originalFile.isEOF() ? 0x00 : originalFile.readU8()
      const b2 = modifiedFile.readU8()

      if (b1 !== b2) {
        const originalOffset = modifiedFile.offset - 1
        const xorDifferences: number[] = []

        // Continue reading differences
        let currentB1 = b1
        let currentB2 = b2
        
        while (currentB1 !== currentB2) {
          xorDifferences.push(currentB1 ^ currentB2)

          if (modifiedFile.isEOF()) {
            break
          }

          currentB1 = originalFile.isEOF() ? 0x00 : originalFile.readU8()
          currentB2 = modifiedFile.readU8()
        }

        file.records.push({ offset: originalOffset, xor: xorDifferences })
      }
    }

    patch.files.push(file)

    return patch
  }
}
