// ROM Patcher TypeScript type definitions

export interface FileHashes {
  crc32: string
  md5: string
  sha1: string
}

export interface HeaderInfo {
  extensions: string[]
  size: number
  romSizeMultiple: number
  name: string
}

export interface PatchRecord {
  offset: number
  type: number
  length: number
  data?: Uint8Array
  byte?: number
}

export interface PatchFile {
  records: PatchRecord[]
  truncate?: number | false
  metadata?: Record<string, string> | null
  validateSource?: (romFile: BinaryFile, skipHeaderSize?: number) => boolean
  apply: (romFile: BinaryFile) => BinaryFile
  export: (fileName?: string) => BinaryFile
  toString: () => string
  getDescription?: () => string | null
}

export interface BinaryFile {
  fileName: string
  fileSize: number
  littleEndian: boolean
  offset: number
  data: Uint8Array
  
  // File operations
  seek(offset: number): void
  tell(): number
  skip(bytes: number): void
  getExtension(): string
  getName(): string
  setName(name: string): void
  isEOF(): boolean
  
  // Reading methods
  readU8(): number
  readU16(): number
  readU24(): number
  readU32(): number
  readBytes(length: number): Uint8Array
  readString(length: number, encoding?: string): string
  readVLV(): number
  
  // Writing methods
  writeU8(value: number): void
  writeU16(value: number): void
  writeU24(value: number): void
  writeU32(value: number): void
  writeBytes(data: Uint8Array): void
  writeString(str: string, encoding?: string): void
  writeVLV(value: number): void
  
  // Utility methods
  save(): void
  getBytes(): Uint8Array
  expand(newSize: number): void
  truncate(size: number): void
  clone(): BinaryFile
  copyTo(target: BinaryFile, targetOffset?: number, sourceLength?: number): void
    // Hash methods
  hashCRC32(startOffset?: number, endOffset?: number): number
  hashCRC16(startOffset?: number, length?: number): number
  hashMD5(): string
  hashSHA1(): string
  
  // Helper methods
  getVLVLength(value: number): number
}

export interface PatchOptions {
  requireValidation?: boolean
  removeHeader?: boolean
  addHeader?: boolean
  fixChecksum?: boolean
  outputSuffix?: boolean
}

export interface RomSystem {
  name: string
  extensions: string[]
  detectSignature?: (file: BinaryFile) => boolean
}

export enum PatchFormat {
  IPS = 'ips',
  UPS = 'ups',
  BPS = 'bps',
  APS_N64 = 'aps_n64',
  APS_GBA = 'aps_gba',
  RUP = 'rup',
  PPF = 'ppf',
  PMSR = 'pmsr',
  VCDIFF = 'vcdiff',
  EBP = 'ebp'
}

export interface PatchFormatModule<T extends PatchFile = PatchFile> {
  name: string
  extension: string
  magic: string
  identify: (data: Uint8Array) => boolean
  create: () => T
  parse: (file: BinaryFile) => T | null
  build: (original: BinaryFile, modified: BinaryFile, metadata?: any) => T
}

export interface HashProgress {
  bytesProcessed: number
  totalBytes: number
  percentage: number
}

export type HashProgressCallback = (progress: HashProgress) => void

export interface RomPatcherError extends Error {
  code: string
  details?: any
}

export class InvalidPatchFileError extends Error implements RomPatcherError {
  code = 'INVALID_PATCH_FILE'
  constructor(message: string, public details?: any) {
    super(message)
    this.name = 'InvalidPatchFileError'
  }
}

export class InvalidRomFileError extends Error implements RomPatcherError {
  code = 'INVALID_ROM_FILE'
  constructor(message: string, public details?: any) {
    super(message)
    this.name = 'InvalidRomFileError'
  }
}

export class PatchValidationError extends Error implements RomPatcherError {
  code = 'PATCH_VALIDATION_ERROR'
  constructor(message: string, public details?: any) {
    super(message)
    this.name = 'PatchValidationError'
  }
}

export class UnsupportedFormatError extends Error implements RomPatcherError {
  code = 'UNSUPPORTED_FORMAT'
  constructor(message: string, public details?: any) {
    super(message)
    this.name = 'UnsupportedFormatError'
  }
}
