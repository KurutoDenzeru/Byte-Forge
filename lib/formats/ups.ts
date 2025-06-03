// UPS format implementation for Byte-Forge
// UPS (Universal Patching System) format with VLV encoding and CRC32 validation

import type { BinaryFile, PatchFile, PatchRecord, PatchFormatModule } from '../types/rom-patcher'
import { BinFile } from '../core/binary-file'
import { InvalidPatchFileError } from '../types/rom-patcher'

export const UPS_MAGIC = 'UPS1'

interface UPSRecord {
  offset: number
  XORdata: number[]
}

export class UPSPatch implements PatchFile {
  public upsRecords: UPSRecord[] = []
  public sizeInput: number = 0
  public sizeOutput: number = 0
  public checksumInput: number = 0
  public checksumOutput: number = 0
  
  // PatchFile interface compatibility
  get records(): PatchRecord[] {
    return this.upsRecords.map(record => ({
      offset: record.offset,
      type: 1, // Simple record type
      length: record.XORdata.length,
      data: new Uint8Array(record.XORdata)
    }))
  }

  constructor() {}

  addRecord(relativeOffset: number, xorData: number[]): void {
    this.upsRecords.push({ offset: relativeOffset, XORdata: xorData })
  }

  toString(): string {
    let result = `Records: ${this.records.length}\n`
    result += `Input file size: ${this.sizeInput}\n`
    result += `Output file size: ${this.sizeOutput}\n`
    result += `Input file checksum: ${this.checksumInput.toString(16)}\n`
    result += `Output file checksum: ${this.checksumOutput.toString(16)}`
    return result
  }

  validateSource(romFile: BinaryFile, headerSize: number = 0): boolean {
    return romFile.hashCRC32(headerSize) === this.checksumInput
  }

  apply(romFile: BinaryFile): BinaryFile {
    if (!this.validateSource(romFile)) {
      throw new Error('Source ROM checksum mismatch')
    }

    // Fix glitch when source file is larger than expected
    let sizeOutput = this.sizeOutput
    let sizeInput = this.sizeInput
    
    if (sizeInput < romFile.fileSize) {
      sizeInput = romFile.fileSize
      if (sizeOutput < sizeInput) {
        sizeOutput = sizeInput
      }
    }

    // Copy original file
    const tempFile = new BinFile(sizeOutput)
    romFile.copyTo(tempFile, 0, sizeInput)

    // Apply XOR patches
    let absoluteOffset = 0
    for (const record of this.upsRecords) {
      absoluteOffset += record.offset
      
      tempFile.seek(absoluteOffset)
      romFile.seek(absoluteOffset)

      for (const xorByte of record.XORdata) {
        const originalByte = romFile.isEOF() ? 0x00 : romFile.readU8()
        tempFile.writeU8(originalByte ^ xorByte)
      }
      
      absoluteOffset += record.XORdata.length
    }

    if (tempFile.hashCRC32() !== this.checksumOutput) {
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
    let patchFileSize = UPS_MAGIC.length
    patchFileSize += this.getVLVLength(this.sizeInput)
    patchFileSize += this.getVLVLength(this.sizeOutput)
    
    for (const record of this.upsRecords) {
      patchFileSize += this.getVLVLength(record.offset)
      patchFileSize += record.XORdata.length + 1
    }
    patchFileSize += 12 // input/output/patch checksums

    const tempFile = new BinFile(patchFileSize)
    tempFile.setName((fileName || 'patch') + '.ups')
    
    tempFile.writeString(UPS_MAGIC)
    tempFile.writeVLV(this.sizeInput)
    tempFile.writeVLV(this.sizeOutput)

    for (const record of this.upsRecords) {
      tempFile.writeVLV(record.offset)
      tempFile.writeBytes(new Uint8Array(record.XORdata))
      tempFile.writeU8(0x00)
    }    tempFile.littleEndian = true
    tempFile.writeU32(this.checksumInput)
    tempFile.writeU32(this.checksumOutput)
    tempFile.writeU32(tempFile.hashCRC32(0, tempFile.fileSize - 4))

    return tempFile
  }

  private getVLVLength(value: number): number {
    return Math.ceil(Math.log2(value + 1) / 7) || 1
  }

  static fromFile(patchFile: BinFile): UPSPatch | null {
    patchFile.seek(0)
    
    if (patchFile.readString(UPS_MAGIC.length) !== UPS_MAGIC) {
      return null
    }

    const patch = new UPSPatch()
    patch.sizeInput = patchFile.readVLV()
    patch.sizeOutput = patchFile.readVLV()

    // Read records
    while (patchFile.offset < (patchFile.fileSize - 12)) {
      const relativeOffset = patchFile.readVLV()
      
      const XORdifferences: number[] = []
      let byte: number
      while ((byte = patchFile.readU8()) !== 0) {
        XORdifferences.push(byte)
      }
      patch.addRecord(relativeOffset, XORdifferences)
    }

    // Read checksums
    patchFile.littleEndian = true
    patch.checksumInput = patchFile.readU32()
    patch.checksumOutput = patchFile.readU32()

    if (patchFile.readU32() !== patchFile.hashCRC32(0, patchFile.fileSize - 4)) {
      throw new InvalidPatchFileError('Patch checksum mismatch')
    }

    patchFile.littleEndian = false
    return patch
  }

  static buildFromRoms(originalFile: BinFile, modifiedFile: BinFile): UPSPatch {
    const patch = new UPSPatch()
    patch.sizeInput = originalFile.fileSize
    patch.sizeOutput = modifiedFile.fileSize

    originalFile.seek(0)
    modifiedFile.seek(0)

    let previousSeek = 1
    while (!modifiedFile.isEOF()) {
      const b1 = originalFile.isEOF() ? 0x00 : originalFile.readU8()
      const b2 = modifiedFile.readU8()

      if (b1 !== b2) {
        const currentSeek = modifiedFile.offset
        const XORdata: number[] = []

        XORdata.push(b1 ^ b2)

        let nb1 = originalFile.isEOF() ? 0x00 : originalFile.readU8()
        let nb2 = modifiedFile.isEOF() ? 0x00 : modifiedFile.readU8()
        
        while (nb1 !== nb2 && !modifiedFile.isEOF()) {
          XORdata.push(nb1 ^ nb2)
          nb1 = originalFile.isEOF() ? 0x00 : originalFile.readU8()
          nb2 = modifiedFile.isEOF() ? 0x00 : modifiedFile.readU8()
        }

        patch.addRecord(currentSeek - previousSeek, XORdata)
        previousSeek = currentSeek + XORdata.length + 1
      }
    }

    patch.checksumInput = originalFile.hashCRC32()
    patch.checksumOutput = modifiedFile.hashCRC32()
    
    return patch
  }
}

// Module export for format registration
export const UPSModule: PatchFormatModule<UPSPatch> = {
  name: 'UPS',
  extension: '.ups',
  magic: UPS_MAGIC,
  
  identify: (data: Uint8Array): boolean => {
    if (data.length < UPS_MAGIC.length) return false
    const magic = new TextDecoder().decode(data.slice(0, UPS_MAGIC.length))
    return magic === UPS_MAGIC
  },
  
  create: (): UPSPatch => new UPSPatch(),
  
  parse: (file: BinaryFile): UPSPatch | null => {
    if (file instanceof BinFile) {
      return UPSPatch.fromFile(file)
    }
    const binFile = new BinFile(file.data)
    binFile.fileName = file.fileName
    return UPSPatch.fromFile(binFile)
  },
  
  build: (original: BinaryFile, modified: BinaryFile): UPSPatch => {
    const origBinFile = original instanceof BinFile ? original : new BinFile(original.data)
    const modBinFile = modified instanceof BinFile ? modified : new BinFile(modified.data)
    return UPSPatch.buildFromRoms(origBinFile, modBinFile)
  }
}


