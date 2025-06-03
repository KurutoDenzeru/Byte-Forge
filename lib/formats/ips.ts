import type { BinaryFile, PatchFile, PatchRecord, PatchFormatModule } from '../types/rom-patcher'
import { BinFile } from '../core/binary-file'
import { InvalidPatchFileError } from '../types/rom-patcher'

export const IPS_MAGIC = 'PATCH'
export const IPS_EOF = 'EOF'
export const IPS_MAX_ROM_SIZE = 0x1000000 // 16 megabytes
export const IPS_RECORD_RLE = 0x0000
export const IPS_RECORD_SIMPLE = 0x01

export class IPSPatch implements PatchFile {
  public records: PatchRecord[] = []
  public truncate: number | false = false
  public metadata: Record<string, string> | null = null

  constructor() {}

  addSimpleRecord(offset: number, data: Uint8Array): void {
    this.records.push({
      offset,
      type: IPS_RECORD_SIMPLE,
      length: data.length,
      data
    })
  }

  addRLERecord(offset: number, length: number, byte: number): void {
    this.records.push({
      offset,
      type: IPS_RECORD_RLE,
      length,
      byte
    })
  }

  setEBPMetadata(metadataObject: Record<string, string>): void {
    if (typeof metadataObject !== 'object') {
      throw new TypeError('metadataObject must be an object')
    }
    
    for (const key in metadataObject) {
      if (typeof metadataObject[key] !== 'string') {
        throw new TypeError('metadataObject values must be strings')
      }
    }

    // EBPatcher compatibility
    this.metadata = { patcher: 'EBPatcher', ...metadataObject }
  }

  getDescription(): string | null {
    if (this.metadata) {
      let description = ''
      for (const key in this.metadata) {
        if (key === 'patcher') continue

        const keyPretty = key.charAt(0).toUpperCase() + key.slice(1)
        description += `${keyPretty}: ${this.metadata[key]}\n`
      }
      return description.trim()
    }
    return null
  }

  toString(): string {
    let nSimpleRecords = 0
    let nRLERecords = 0
    
    for (const record of this.records) {
      if (record.type === IPS_RECORD_RLE) {
        nRLERecords++
      } else {
        nSimpleRecords++
      }
    }

    let result = `Simple records: ${nSimpleRecords}\n`
    result += `RLE records: ${nRLERecords}\n`
    result += `Total records: ${this.records.length}`
    
    if (this.truncate && !this.metadata) {
      result += `\nTruncate at: 0x${this.truncate.toString(16)}`
    } else if (this.metadata) {
      result += `\nEBP Metadata: ${JSON.stringify(this.metadata)}`
    }
    
    return result
  }

  validateSource(romFile: BinaryFile, skipHeaderSize: number = 0): boolean {
    // IPS doesn't have built-in source validation
    // This could be extended to validate against known ROM checksums
    return true
  }

  apply(romFile: BinaryFile): BinaryFile {
    // Clone the ROM file
    const patchedRom = romFile.clone()
    
    // Determine output size
    let maxOffset = patchedRom.fileSize
    for (const record of this.records) {
      const endOffset = record.offset + record.length
      if (endOffset > maxOffset) {
        maxOffset = endOffset
      }
    }

    // Expand ROM if necessary
    if (maxOffset > patchedRom.fileSize) {
      patchedRom.expand(maxOffset)
    }

    // Apply patches
    for (const record of this.records) {
      patchedRom.seek(record.offset)
      
      if (record.type === IPS_RECORD_RLE) {
        // RLE record - repeat a single byte
        for (let i = 0; i < record.length; i++) {
          patchedRom.writeU8(record.byte!)
        }
      } else {
        // Simple record - write data directly
        patchedRom.writeBytes(record.data!)
      }
    }

    // Apply truncation if specified
    if (this.truncate) {
      patchedRom.truncate(this.truncate)
    }

    // Update filename
    const baseName = romFile.getName()
    const extension = romFile.getExtension()
    const suffix = extension ? `.${extension}` : ''
    patchedRom.setName(`${baseName} (patched)${suffix}`)

    return patchedRom
  }

  export(fileName?: string): BinaryFile {
    // Calculate patch file size
    let patchFileSize = 5 // PATCH string
    
    for (const record of this.records) {
      if (record.type === IPS_RECORD_RLE) {
        patchFileSize += 3 + 2 + 2 + 1 // offset + 0x0000 + length + RLE byte
      } else {
        patchFileSize += 3 + 2 + record.data!.length // offset + length + data
      }
    }
    
    patchFileSize += 3 // EOF string
    
    if (this.truncate && !this.metadata) {
      patchFileSize += 3 // truncate
    } else if (this.metadata) {
      patchFileSize += JSON.stringify(this.metadata).length
    }

    // Create patch file
    const patchFile = new BinFile(patchFileSize)
    const baseFileName = fileName || 'patch'
    const extension = this.metadata ? '.ebp' : '.ips'
    patchFile.setName(baseFileName + extension)

    // Write header
    patchFile.writeString(IPS_MAGIC, 'ascii')

    // Write records
    for (const record of this.records) {
      patchFile.writeU24(record.offset)
      
      if (record.type === IPS_RECORD_RLE) {
        patchFile.writeU16(0x0000)
        patchFile.writeU16(record.length)
        patchFile.writeU8(record.byte!)
      } else {
        patchFile.writeU16(record.data!.length)
        patchFile.writeBytes(record.data!)
      }
    }

    // Write EOF
    patchFile.writeString(IPS_EOF, 'ascii')

    // Write truncation or metadata
    if (this.truncate && !this.metadata) {
      patchFile.writeU24(this.truncate)
    } else if (this.metadata) {
      patchFile.writeString(JSON.stringify(this.metadata), 'ascii')
    }

    return patchFile
  }
}

export const IPS = {
  MAGIC: IPS_MAGIC,

  fromFile(patchFile: BinaryFile): IPSPatch {
    patchFile.seek(0)
    
    // Check magic
    const magic = patchFile.readString(5, 'ascii')
    if (magic !== IPS_MAGIC) {
      throw new InvalidPatchFileError('Invalid IPS file: missing PATCH header')
    }

    const patch = new IPSPatch()

    // Read records
    while (true) {
      // Check for EOF
      if (patchFile.offset + 3 > patchFile.fileSize) {
        throw new InvalidPatchFileError('Unexpected end of IPS file')
      }

      const marker = patchFile.readString(3, 'ascii')
      
      if (marker === IPS_EOF) {
        // Check for truncation or EBP metadata
        if (patchFile.offset < patchFile.fileSize) {
          if (patchFile.fileSize - patchFile.offset === 3) {
            // Truncation
            patch.truncate = patchFile.readU24()
          } else {
            // EBP metadata
            const metadataStr = patchFile.readString(patchFile.fileSize - patchFile.offset, 'ascii')
            try {
              patch.metadata = JSON.parse(metadataStr)
            } catch (e) {
              // Ignore invalid JSON metadata
            }
          }
        }
        break
      }

      // Parse offset (3 bytes, big-endian)
      patchFile.seek(patchFile.offset - 3)
      const offset = patchFile.readU24()

      // Parse length (2 bytes, big-endian)
      const length = patchFile.readU16()

      if (length === 0) {
        // RLE record
        const rleLength = patchFile.readU16()
        const rleByte = patchFile.readU8()
        patch.addRLERecord(offset, rleLength, rleByte)
      } else {
        // Simple record
        if (patchFile.offset + length > patchFile.fileSize) {
          throw new InvalidPatchFileError('Invalid IPS record: data extends beyond file')
        }
        const data = patchFile.readBytes(length)
        patch.addSimpleRecord(offset, data)
      }
    }

    return patch
  },

  create(originalFile: BinaryFile, modifiedFile: BinaryFile, metadata?: Record<string, string>): IPSPatch {
    const patch = new IPSPatch()

    if (metadata) {
      patch.setEBPMetadata(metadata)
    }

    // Find differences between files
    const maxSize = Math.max(originalFile.fileSize, modifiedFile.fileSize)
    let offset = 0

    while (offset < maxSize) {
      const originalByte = offset < originalFile.fileSize ? originalFile.data[offset] : 0
      const modifiedByte = offset < modifiedFile.fileSize ? originalFile.data[offset] : 0

      if (originalByte !== modifiedByte) {
        // Found difference, collect consecutive changes
        const startOffset = offset
        const changes: number[] = []

        while (offset < maxSize) {
          const origByte = offset < originalFile.fileSize ? originalFile.data[offset] : 0
          const modByte = offset < modifiedFile.fileSize ? originalFile.data[offset] : 0

          if (origByte !== modByte) {
            changes.push(modByte)
            offset++
          } else {
            break
          }
        }

        // Check if we can use RLE compression
        if (changes.length > 3 && changes.every(b => b === changes[0])) {
          patch.addRLERecord(startOffset, changes.length, changes[0])
        } else {
          patch.addSimpleRecord(startOffset, new Uint8Array(changes))
        }
      } else {
        offset++
      }
    }

    // Add truncation if modified file is smaller
    if (modifiedFile.fileSize < originalFile.fileSize) {
      patch.truncate = modifiedFile.fileSize
    }

    return patch
  }
}

// Module export for format registration
export const IPSModule: PatchFormatModule<IPSPatch> = {
  name: 'IPS',
  extension: '.ips',
  magic: IPS_MAGIC,
  
  identify: (data: Uint8Array): boolean => {
    if (data.length < IPS_MAGIC.length) return false
    const magic = new TextDecoder().decode(data.slice(0, IPS_MAGIC.length))
    return magic === IPS_MAGIC
  },
  
  create: (): IPSPatch => new IPSPatch(),
    parse: (file: BinaryFile): IPSPatch | null => {
    try {
      // Use the old IPS export methods directly since they match
      return (IPS as any).fromFile(file)
    } catch (error) {
      return null
    }
  },
  
  build: (original: BinaryFile, modified: BinaryFile, metadata?: any): IPSPatch => 
    (IPS as any).create(original, modified, metadata)
}
