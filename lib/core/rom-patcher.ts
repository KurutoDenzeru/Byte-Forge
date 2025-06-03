import type { 
  BinaryFile, 
  PatchFile, 
  PatchOptions, 
  HeaderInfo, 
  PatchFormatModule 
} from '../types/rom-patcher'
import { 
  InvalidPatchFileError, 
  InvalidRomFileError, 
  PatchValidationError,
  UnsupportedFormatError,
  PatchFormat
} from '../types/rom-patcher'
import { BinFile } from '../core/binary-file'
import { IPSModule } from '../formats/ips'
import { UPSModule } from '../formats/ups'
// import { BPSModule } from '../formats/bps'
// import { APSModule } from '../formats/aps'
import { APSGBAModule } from '../formats/aps-gba'
// import { PPFModule } from '../formats/ppf'
// import { RUPModule } from '../formats/rup'
import { PMSRModule } from '../formats/pmsr'
import { VCDIFFModule } from '../formats/vcdiff'

export class RomPatcher {
  private static readonly TOO_BIG_ROM_SIZE = 67108863

  private static readonly HEADERS_INFO: HeaderInfo[] = [
    { extensions: ['nes'], size: 16, romSizeMultiple: 1024, name: 'iNES' },
    { extensions: ['fds'], size: 16, romSizeMultiple: 65500, name: 'fwNES' },
    { extensions: ['lnx'], size: 64, romSizeMultiple: 1024, name: 'LNX' },
    { extensions: ['sfc', 'smc', 'swc', 'fig'], size: 512, romSizeMultiple: 262144, name: 'SNES copier' }
  ]

  private static readonly GAME_BOY_NINTENDO_LOGO = new Uint8Array([
    0xce, 0xed, 0x66, 0x66, 0xcc, 0x0d, 0x00, 0x0b, 0x03, 0x73, 0x00, 0x83, 0x00, 0x0c, 0x00, 0x0d,
    0x00, 0x08, 0x11, 0x1f, 0x88, 0x89, 0x00, 0x0e, 0xdc, 0xcc, 0x6e, 0xe6, 0xdd, 0xdd, 0xd9, 0x99
  ])  // Format modules registry
  private static readonly formatModules: Map<string, PatchFormatModule> = new Map([
    [IPSModule.magic, IPSModule],
    [UPSModule.magic, UPSModule],
    // [BPSModule.magic, BPSModule],
    // [APSModule.magic, APSModule],
    [APSGBAModule.magic, APSGBAModule],
    // [PPFModule.magic, PPFModule],
    // [RUPModule.magic, RUPModule],
    [PMSRModule.magic, PMSRModule],
    [VCDIFFModule.magic, VCDIFFModule]
  ])

  /**
   * Parse a patch file and return a patch object
   */
  static parsePatchFile(patchFile: BinaryFile): PatchFile {
    if (!patchFile) {
      throw new InvalidPatchFileError('Patch file is not provided')
    }

    patchFile.littleEndian = false
    patchFile.seek(0)

    // Try to detect format by magic header
    if (patchFile.fileSize < 5) {
      throw new InvalidPatchFileError('Patch file is too small')
    }

    const header = patchFile.readString(6, 'ascii')
    patchFile.seek(0)    // Check each format module
    for (const [magic, module] of this.formatModules) {
      if (header.startsWith(magic)) {
        try {
          const patch = module.parse(patchFile)
          if (patch) {
            return patch
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new InvalidPatchFileError(`Failed to parse ${magic} patch: ${errorMessage}`)
        }
      }
    }

    throw new UnsupportedFormatError('Unknown patch format')
  }

  /**
   * Validate ROM file against patch requirements
   */
  static validateRom(romFile: BinaryFile, patch: PatchFile, skipHeaderSize: number = 0): boolean {
    if (!romFile) {
      throw new InvalidRomFileError('ROM file is not provided')
    }

    if (!patch) {
      throw new Error('Patch is not provided')
    }

    if (typeof skipHeaderSize !== 'number' || skipHeaderSize < 0) {
      skipHeaderSize = 0
    }

    if (typeof patch.validateSource === 'function') {
      return patch.validateSource(romFile, skipHeaderSize)
    }

    return true
  }

  /**
   * Apply patch to ROM file
   */
  static applyPatch(romFile: BinaryFile, patch: PatchFile, optionsParam?: Partial<PatchOptions>): BinaryFile {
    if (!romFile) {
      throw new InvalidRomFileError('ROM file is not provided')
    }

    if (!patch) {
      throw new Error('Patch is not provided')
    }

    // Default options
    const options: PatchOptions = {
      requireValidation: false,
      removeHeader: false,
      addHeader: false,
      fixChecksum: false,
      outputSuffix: true,
      ...optionsParam
    }

    let workingRom = romFile
    let extractedHeader: BinaryFile | null = null
    let fakeHeaderSize = 0

    // Handle headers
    if (options.removeHeader) {
      const headerInfo = this.isRomHeadered(romFile)
      if (headerInfo) {
        const splitData = this.removeHeader(romFile)
        extractedHeader = splitData.header
        workingRom = splitData.rom
      }
    } else if (options.addHeader) {
      const headerInfo = this.canRomGetHeader(romFile)
      if (headerInfo) {
        fakeHeaderSize = headerInfo.size
        workingRom = this.addFakeHeader(romFile)
      }
    }

    // Validate ROM if required
    if (options.requireValidation && !this.validateRom(workingRom, patch)) {
      throw new PatchValidationError('Invalid input ROM checksum')
    }

    // Apply patch
    let patchedRom = patch.apply(workingRom)

    // Reinsert header if it was removed
    if (extractedHeader) {
      if (options.fixChecksum) {
        this.fixRomHeaderChecksum(patchedRom)
      }

      const patchedRomWithHeader = new BinFile(extractedHeader.fileSize + patchedRom.fileSize)
      patchedRomWithHeader.fileName = patchedRom.fileName
      patchedRomWithHeader.writeBytes(extractedHeader.getBytes())
      patchedRomWithHeader.writeBytes(patchedRom.getBytes())
      patchedRom = patchedRomWithHeader
    } else if (fakeHeaderSize > 0) {
      // Remove fake header
      const dataWithoutHeader = patchedRom.getBytes().slice(fakeHeaderSize)
      patchedRom = new BinFile(dataWithoutHeader)
      patchedRom.fileName = romFile.fileName
    }

    return patchedRom
  }

  /**
   * Create patch from two ROM files
   */
  static createPatch(
    originalFile: BinaryFile, 
    modifiedFile: BinaryFile, 
    format: PatchFormat = PatchFormat.IPS, 
    metadata?: Record<string, string>
  ): PatchFile {
    if (!originalFile) {
      throw new InvalidRomFileError('Original ROM file is not provided')
    }

    if (!modifiedFile) {
      throw new InvalidRomFileError('Modified ROM file is not provided')
    }    // Find the format module
    let formatModule: PatchFormatModule | undefined

    for (const module of this.formatModules.values()) {
      if (module.magic.toLowerCase() === format.toLowerCase()) {
        formatModule = module
        break
      }
    }

    if (!formatModule) {
      throw new UnsupportedFormatError(`Unsupported patch format: ${format}`)
    }

    return formatModule.build(originalFile, modifiedFile, metadata)
  }

  /**
   * Check if ROM can get a header
   */
  static canRomGetHeader(romFile: BinaryFile): HeaderInfo | null {
    const extension = romFile.getExtension()
    
    for (const headerInfo of this.HEADERS_INFO) {
      if (headerInfo.extensions.includes(extension)) {
        if (romFile.fileSize % headerInfo.romSizeMultiple === 0) {
          return headerInfo
        }
      }
    }
    
    return null
  }

  /**
   * Check if ROM is headered
   */
  static isRomHeadered(romFile: BinaryFile): HeaderInfo | null {
    const extension = romFile.getExtension()
    
    for (const headerInfo of this.HEADERS_INFO) {
      if (headerInfo.extensions.includes(extension)) {
        if ((romFile.fileSize - headerInfo.size) % headerInfo.romSizeMultiple === 0) {
          return headerInfo
        }
      }
    }
    
    return null
  }

  /**
   * Remove header from ROM
   */
  static removeHeader(romFile: BinaryFile): { header: BinaryFile; rom: BinaryFile } {
    const headerInfo = this.isRomHeadered(romFile)
    
    if (!headerInfo) {
      throw new InvalidRomFileError('ROM does not have a removable header')
    }

    const headerData = romFile.getBytes().slice(0, headerInfo.size)
    const romData = romFile.getBytes().slice(headerInfo.size)

    const header = new BinFile(headerData)
    header.fileName = romFile.fileName + '.header'

    const rom = new BinFile(romData)
    rom.fileName = romFile.fileName

    return { header, rom }
  }

  /**
   * Add fake header to ROM
   */
  static addFakeHeader(romFile: BinaryFile): BinaryFile {
    const headerInfo = this.canRomGetHeader(romFile)
    
    if (!headerInfo) {
      throw new InvalidRomFileError('ROM cannot get a header')
    }

    const fakeHeader = new Uint8Array(headerInfo.size)
    const romWithHeader = new BinFile(headerInfo.size + romFile.fileSize)
    
    romWithHeader.fileName = romFile.fileName
    romWithHeader.writeBytes(fakeHeader)
    romWithHeader.writeBytes(romFile.getBytes())

    return romWithHeader
  }

  /**
   * Fix ROM header checksum (placeholder implementation)
   */
  static fixRomHeaderChecksum(romFile: BinaryFile): void {
    // This would need to be implemented based on specific ROM system requirements
    // For now, this is a placeholder
  }

  /**
   * Get ROM system-specific additional checksum
   */
  static getRomAdditionalChecksum(romFile: BinaryFile): string | null {
    const romSystem = this.getRomSystem(romFile)
    
    if (romSystem === 'n64') {
      romFile.seek(0x3c)
      const cartId = romFile.readString(3, 'ascii')

      romFile.seek(0x10)
      const crcData = romFile.readBytes(8)
      const crc = Array.from(crcData, b => b.toString(16).padStart(2, '0')).join('')
      return `${cartId} (${crc})`
    }
    
    return null
  }

  /**
   * Check if ROM is too big
   */
  static isRomTooBig(romFile: BinaryFile): boolean {
    return romFile.fileSize > this.TOO_BIG_ROM_SIZE
  }

  /**
   * Detect ROM system
   */
  private static getRomSystem(romFile: BinaryFile): string | null {
    const extension = romFile.getExtension()
    
    if (romFile.fileSize > 0x0200 && romFile.fileSize % 4 === 0) {
      if ((extension === 'gb' || extension === 'gbc') && romFile.fileSize % 0x4000 === 0) {
        romFile.seek(0x0104)
        let valid = true
        
        for (let i = 0; i < this.GAME_BOY_NINTENDO_LOGO.length && valid; i++) {
          if (this.GAME_BOY_NINTENDO_LOGO[i] !== romFile.readU8()) {
            valid = false
          }
        }
        
        if (valid) return 'gb'
      } else if (extension === 'md' || extension === 'bin') {
        romFile.seek(0x0100)
        const signature = romFile.readString(12, 'ascii')
        if (/SEGA (GENESIS|MEGA DR)/.test(signature)) {
          return 'smd'
        }
      } else if (extension === 'z64' && romFile.fileSize >= 0x400000) {
        return 'n64'
      }
    } else if (extension === 'fds' && romFile.fileSize % 65500 === 0) {
      return 'fds'
    }
    
    return null
  }
}
