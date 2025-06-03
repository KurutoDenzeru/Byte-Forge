import type { BinaryFile, PatchFile, PatchRecord, PatchFormatModule } from '../types/rom-patcher'
import { BinFile } from '../core/binary-file'
import { InvalidPatchFileError } from '../types/rom-patcher'

export const BPS_MAGIC = 'BPS1'

// BPS action types
export const BPS_ACTION_SOURCE_READ = 0
export const BPS_ACTION_TARGET_READ = 1
export const BPS_ACTION_SOURCE_COPY = 2
export const BPS_ACTION_TARGET_COPY = 3

interface BPSAction {
  type: number
  length: number
  bytes?: number[]
  relativeOffset?: number
}

interface BPSNode {
  offset: number
  next: BPSNode | null
}

export class BPSPatch implements PatchFile {
  public sourceSize: number = 0
  public targetSize: number = 0
  public metaData: string = ''
  public actions: BPSAction[] = []
  public sourceChecksum: number = 0
  public targetChecksum: number = 0
  public patchChecksum: number = 0

  // PatchFile interface compatibility  
  get records(): PatchRecord[] {
    return this.actions.map((action, index) => ({
      offset: index,
      type: action.type,
      length: action.length,
      data: action.bytes ? new Uint8Array(action.bytes) : undefined
    }))
  }

  constructor() {}

  toString(): string {
    let result = `Source size: ${this.sourceSize}\n`
    result += `Target size: ${this.targetSize}\n`
    result += `Metadata: ${this.metaData}\n`
    result += `#Actions: ${this.actions.length}`
    return result
  }

  calculateFileChecksum(): number {
    const patchFile = this.export()
    return patchFile.hashCRC32(0, patchFile.fileSize - 4)
  }

  validateSource(romFile: BinaryFile, headerSize: number = 0): boolean {
    return this.sourceChecksum === romFile.hashCRC32(headerSize)
  }

  getValidationInfo(): { type: string; value: number } {
    return {
      type: 'CRC32',
      value: this.sourceChecksum
    }
  }

  apply(romFile: BinaryFile, validate: boolean = true): BinaryFile {
    if (validate && !this.validateSource(romFile)) {
      throw new Error('Source ROM checksum mismatch')
    }

    const tempFile = new BinFile(this.targetSize)

    // Apply patch actions
    let sourceRelativeOffset = 0
    let targetRelativeOffset = 0
    
    for (const action of this.actions) {
      if (action.type === BPS_ACTION_SOURCE_READ) {
        romFile.copyTo(tempFile, tempFile.offset, action.length)
        tempFile.skip(action.length)

      } else if (action.type === BPS_ACTION_TARGET_READ) {
        tempFile.writeBytes(new Uint8Array(action.bytes!))

      } else if (action.type === BPS_ACTION_SOURCE_COPY) {
        sourceRelativeOffset += action.relativeOffset!
        let actionLength = action.length
        
        while (actionLength--) {
          tempFile.writeU8(romFile._u8array[sourceRelativeOffset])
          sourceRelativeOffset++
        }

      } else if (action.type === BPS_ACTION_TARGET_COPY) {
        targetRelativeOffset += action.relativeOffset!
        let actionLength = action.length
        
        while (actionLength--) {
          tempFile.writeU8(tempFile._u8array[targetRelativeOffset])
          targetRelativeOffset++
        }
      }
    }

    if (validate && this.targetChecksum !== tempFile.hashCRC32()) {
      throw new Error('Target ROM checksum mismatch')
    }

    // Update filename
    const baseName = romFile.getName()
    const extension = romFile.getExtension()
    const suffix = extension ? `.${extension}` : ''
    tempFile.setName(`${baseName} (patched)${suffix}`)

    return tempFile
  }

  export(fileName?: string): BinaryFile {
    // Calculate patch file size
    let patchFileSize = BPS_MAGIC.length
    patchFileSize += this._getVLVLen(this.sourceSize)
    patchFileSize += this._getVLVLen(this.targetSize)
    patchFileSize += this._getVLVLen(this.metaData.length)
    patchFileSize += this.metaData.length
    
    for (const action of this.actions) {
      patchFileSize += this._getVLVLen(((action.length - 1) << 2) + action.type)
      
      if (action.type === BPS_ACTION_TARGET_READ) {
        patchFileSize += action.length
      } else if (action.type === BPS_ACTION_SOURCE_COPY || action.type === BPS_ACTION_TARGET_COPY) {
        patchFileSize += this._getVLVLen((Math.abs(action.relativeOffset!) << 1) + (action.relativeOffset! < 0 ? 1 : 0))
      }
    }
    patchFileSize += 12 // checksums

    const patchFile = new BinFile(patchFileSize)
    patchFile.setName((fileName || 'patch') + '.bps')
    patchFile.littleEndian = true
    patchFile.writeVLV = this._writeVLV.bind(patchFile)

    patchFile.writeString(BPS_MAGIC, 'ascii')
    patchFile.writeVLV!(this.sourceSize)
    patchFile.writeVLV!(this.targetSize)
    patchFile.writeVLV!(this.metaData.length)
    patchFile.writeString(this.metaData, 'ascii')

    for (const action of this.actions) {
      patchFile.writeVLV!(((action.length - 1) << 2) + action.type)
      
      if (action.type === BPS_ACTION_TARGET_READ) {
        patchFile.writeBytes(new Uint8Array(action.bytes!))
      } else if (action.type === BPS_ACTION_SOURCE_COPY || action.type === BPS_ACTION_TARGET_COPY) {
        patchFile.writeVLV!((Math.abs(action.relativeOffset!) << 1) + (action.relativeOffset! < 0 ? 1 : 0))
      }
    }
    
    patchFile.writeU32(this.sourceChecksum)
    patchFile.writeU32(this.targetChecksum)
    patchFile.writeU32(this.patchChecksum)

    return patchFile
  }

  // Variable Length Value encoding/decoding
  private _readVLV(file: BinaryFile): number {
    let data = 0
    let shift = 1
    
    while (true) {
      const x = file.readU8()
      data += (x & 0x7f) * shift
      if (x & 0x80) break
      shift <<= 7
      data += shift
    }

    return data
  }

  private _writeVLV(data: number): void {
    while (true) {
      const x = data & 0x7f
      data >>= 7
      if (data === 0) {
        this.writeU8(0x80 | x)
        break
      }
      this.writeU8(x)
      data--
    }
  }

  private _getVLVLen(data: number): number {
    let len = 0
    while (true) {
      data & 0x7f
      data >>= 7
      if (data === 0) {
        len++
        break
      }
      len++
      data--
    }
    return len
  }
}

export const BPS: PatchFormatModule = {
  MAGIC: BPS_MAGIC,

  fromFile(patchFile: BinaryFile): BPSPatch {
    const patch = new BPSPatch()
    
    // Add VLV reading method
    patchFile.readVLV = () => patch._readVLV(patchFile)
    patchFile.littleEndian = true

    patchFile.seek(4) // skip BPS1

    patch.sourceSize = patchFile.readVLV!()
    patch.targetSize = patchFile.readVLV!()

    const metaDataLength = patchFile.readVLV!()
    if (metaDataLength) {
      patch.metaData = patchFile.readString(metaDataLength, 'ascii')
    }

    // Read actions
    const endActionsOffset = patchFile.fileSize - 12
    while (patchFile.offset < endActionsOffset) {
      const data = patchFile.readVLV!()
      const action: BPSAction = {
        type: data & 3,
        length: (data >> 2) + 1
      }

      if (action.type === BPS_ACTION_TARGET_READ) {
        action.bytes = Array.from(patchFile.readBytes(action.length))
      } else if (action.type === BPS_ACTION_SOURCE_COPY || action.type === BPS_ACTION_TARGET_COPY) {
        const relativeOffset = patchFile.readVLV!()
        action.relativeOffset = (relativeOffset & 1 ? -1 : +1) * (relativeOffset >> 1)
      }

      patch.actions.push(action)
    }

    // Read checksums
    patch.sourceChecksum = patchFile.readU32()
    patch.targetChecksum = patchFile.readU32()
    patch.patchChecksum = patchFile.readU32()

    if (patch.patchChecksum !== patch.calculateFileChecksum()) {
      throw new InvalidPatchFileError('Patch checksum mismatch')
    }

    return patch
  },

  create(originalFile: BinaryFile, modifiedFile: BinaryFile, deltaMode: boolean = false): BPSPatch {
    const patch = new BPSPatch()
    patch.sourceSize = originalFile.fileSize
    patch.targetSize = modifiedFile.fileSize

    if (deltaMode) {
      patch.actions = createBPSFromFilesDelta(originalFile, modifiedFile)
    } else {
      patch.actions = createBPSFromFilesLinear(originalFile, modifiedFile)
    }

    patch.sourceChecksum = originalFile.hashCRC32()
    patch.targetChecksum = modifiedFile.hashCRC32()
    patch.patchChecksum = patch.calculateFileChecksum()
    
    return patch
  }
}

// Linear algorithm implementation
function createBPSFromFilesLinear(original: BinaryFile, modified: BinaryFile): BPSAction[] {
  const patchActions: BPSAction[] = []
  const sourceData = original._u8array
  const targetData = modified._u8array
  const sourceSize = original.fileSize
  const targetSize = modified.fileSize
  const Granularity = 1

  let targetRelativeOffset = 0
  let outputOffset = 0
  let targetReadLength = 0

  function targetReadFlush() {
    if (targetReadLength) {
      const action: BPSAction = {
        type: BPS_ACTION_TARGET_READ,
        length: targetReadLength,
        bytes: []
      }
      patchActions.push(action)
      
      const offset = outputOffset - targetReadLength
      while (targetReadLength) {
        action.bytes!.push(targetData[offset + (action.bytes!.length)])
        targetReadLength--
      }
    }
  }

  while (outputOffset < targetSize) {
    let sourceLength = 0
    for (let n = 0; outputOffset + n < Math.min(sourceSize, targetSize); n++) {
      if (sourceData[outputOffset + n] !== targetData[outputOffset + n]) break
      sourceLength++
    }

    let rleLength = 0
    for (let n = 1; outputOffset + n < targetSize; n++) {
      if (targetData[outputOffset] !== targetData[outputOffset + n]) break
      rleLength++
    }

    if (rleLength >= 4) {
      // Write byte to repeat
      targetReadLength++
      outputOffset++
      targetReadFlush()

      // Copy starting from repetition byte
      const relativeOffset = (outputOffset - 1) - targetRelativeOffset
      patchActions.push({
        type: BPS_ACTION_TARGET_COPY,
        length: rleLength,
        relativeOffset: relativeOffset
      })
      outputOffset += rleLength
      targetRelativeOffset = outputOffset - 1

    } else if (sourceLength >= 4) {
      targetReadFlush()
      patchActions.push({
        type: BPS_ACTION_SOURCE_READ,
        length: sourceLength
      })
      outputOffset += sourceLength

    } else {
      targetReadLength += Granularity
      outputOffset += Granularity
    }
  }

  targetReadFlush()
  return patchActions
}

// Delta algorithm implementation (simplified)
function createBPSFromFilesDelta(original: BinaryFile, modified: BinaryFile): BPSAction[] {
  // For simplicity, fall back to linear algorithm
  // A full delta implementation would be much more complex
  return createBPSFromFilesLinear(original, modified)
}
