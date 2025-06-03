import type { BinaryFile } from '../types/rom-patcher'

export class BinFile implements BinaryFile {
  public fileName: string = ''
  public fileSize: number = 0
  public littleEndian: boolean = false
  public offset: number = 0
  public data: Uint8Array
  
  private _lastRead: any = null
  private _offsetsStack: number[] = []
  public _u8array: Uint8Array  // For compatibility with original code

  constructor(source: File | Uint8Array | number | string) {
    if (typeof source === 'number') {
      // Create empty file with specified size
      this.data = new Uint8Array(source)
      this.fileSize = source
    } else if (source instanceof Uint8Array) {
      // Create from Uint8Array
      this.data = new Uint8Array(source)
      this.fileSize = source.length
    } else if (source instanceof File) {
      // Will be handled asynchronously
      this.data = new Uint8Array(0)
      this.fileName = source.name
    } else if (typeof source === 'string') {
      // File path (for Node.js compatibility)
      this.fileName = source
      this.data = new Uint8Array(0)
    } else {
      throw new Error('Invalid source type for BinFile')
    }
    
    // Set up compatibility array reference
    this._u8array = this.data
  }

  // Static method to create from File object (async)
  static async fromFile(file: File): Promise<BinFile> {
    const binFile = new BinFile(0)
    binFile.fileName = file.name
    
    const arrayBuffer = await file.arrayBuffer()
    binFile.data = new Uint8Array(arrayBuffer)
    binFile.fileSize = arrayBuffer.byteLength
    binFile._u8array = binFile.data
    
    return binFile
  }

  // File position methods
  seek(offset: number): void {
    this.offset = Math.max(0, Math.min(offset, this.fileSize))
  }

  tell(): number {
    return this.offset
  }

  skip(bytes: number): void {
    this.seek(this.offset + bytes)
  }

  // Stack operations for saving/restoring positions
  save(): void {
    this._offsetsStack.push(this.offset)
  }

  restore(): void {
    if (this._offsetsStack.length > 0) {
      this.offset = this._offsetsStack.pop()!
    }
  }

  // File info methods
  getExtension(): string {
    const lastDot = this.fileName.lastIndexOf('.')
    return lastDot !== -1 ? this.fileName.substring(lastDot + 1).toLowerCase() : ''
  }

  getName(): string {
    const lastSlash = Math.max(
      this.fileName.lastIndexOf('/'),
      this.fileName.lastIndexOf('\\')
    )
    const nameWithExt = lastSlash !== -1 ? this.fileName.substring(lastSlash + 1) : this.fileName
    const lastDot = nameWithExt.lastIndexOf('.')
    return lastDot !== -1 ? nameWithExt.substring(0, lastDot) : nameWithExt
  }

  setName(name: string): void {
    this.fileName = name
  }

  // Check if at end of file
  isEOF(): boolean {
    return this.offset >= this.fileSize
  }

  // Reading methods
  readU8(): number {
    if (this.offset >= this.fileSize) {
      this._lastRead = 0
      return 0
    }
    
    const value = this.data[this.offset]
    this.offset++
    this._lastRead = value
    return value
  }

  readU16(): number {
    const byte1 = this.readU8()
    const byte2 = this.readU8()
    
    return this.littleEndian ? 
      (byte2 << 8) | byte1 : 
      (byte1 << 8) | byte2
  }

  readU24(): number {
    const byte1 = this.readU8()
    const byte2 = this.readU8()
    const byte3 = this.readU8()
    
    return this.littleEndian ?
      (byte3 << 16) | (byte2 << 8) | byte1 :
      (byte1 << 16) | (byte2 << 8) | byte3
  }

  readU32(): number {
    const byte1 = this.readU8()
    const byte2 = this.readU8()
    const byte3 = this.readU8()
    const byte4 = this.readU8()
    
    return this.littleEndian ?
      ((byte4 << 24) | (byte3 << 16) | (byte2 << 8) | byte1) >>> 0 :
      ((byte1 << 24) | (byte2 << 16) | (byte3 << 8) | byte4) >>> 0
  }

  readBytes(length: number): Uint8Array {
    const end = Math.min(this.offset + length, this.fileSize)
    const result = this.data.slice(this.offset, end)
    this.offset = end
    return result
  }

  readString(length: number, encoding: string = 'utf8'): string {
    const bytes = this.readBytes(length)
    
    if (encoding === 'ascii') {
      return Array.from(bytes, byte => String.fromCharCode(byte)).join('')
    }
    
    // UTF-8 decoding
    const decoder = new TextDecoder(encoding)
    return decoder.decode(bytes).replace(/\0.*$/, '') // Remove null terminator and everything after
  }

  // Writing methods
  writeU8(value: number): void {
    if (this.offset >= this.data.length) {
      this.expand(this.offset + 1)
    }
    
    this.data[this.offset] = value & 0xFF
    this.offset++
    
    if (this.offset > this.fileSize) {
      this.fileSize = this.offset
    }
  }

  writeU16(value: number): void {
    if (this.littleEndian) {
      this.writeU8(value & 0xFF)
      this.writeU8((value >> 8) & 0xFF)
    } else {
      this.writeU8((value >> 8) & 0xFF)
      this.writeU8(value & 0xFF)
    }
  }

  writeU24(value: number): void {
    if (this.littleEndian) {
      this.writeU8(value & 0xFF)
      this.writeU8((value >> 8) & 0xFF)
      this.writeU8((value >> 16) & 0xFF)
    } else {
      this.writeU8((value >> 16) & 0xFF)
      this.writeU8((value >> 8) & 0xFF)
      this.writeU8(value & 0xFF)
    }
  }

  writeU32(value: number): void {
    if (this.littleEndian) {
      this.writeU8(value & 0xFF)
      this.writeU8((value >> 8) & 0xFF)
      this.writeU8((value >> 16) & 0xFF)
      this.writeU8((value >> 24) & 0xFF)
    } else {
      this.writeU8((value >> 24) & 0xFF)
      this.writeU8((value >> 16) & 0xFF)
      this.writeU8((value >> 8) & 0xFF)
      this.writeU8(value & 0xFF)
    }
  }

  writeBytes(data: Uint8Array): void {
    const requiredSize = this.offset + data.length
    if (requiredSize > this.data.length) {
      this.expand(requiredSize)
    }
    
    this.data.set(data, this.offset)
    this.offset += data.length
    
    if (this.offset > this.fileSize) {
      this.fileSize = this.offset
    }
  }

  writeString(str: string, encoding: string = 'utf8'): void {
    let bytes: Uint8Array
    
    if (encoding === 'ascii') {
      bytes = new Uint8Array(str.length)
      for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i) & 0xFF
      }
    } else {
      // UTF-8 encoding
      const encoder = new TextEncoder()
      bytes = encoder.encode(str)
    }
    
    this.writeBytes(bytes)
  }

  // Utility methods
  expand(newSize: number): void {
    if (newSize <= this.data.length) return
    
    const newData = new Uint8Array(newSize)
    newData.set(this.data)
    this.data = newData
    this._u8array = this.data
  }

  truncate(size: number): void {
    this.fileSize = Math.min(size, this.data.length)
    if (this.offset > this.fileSize) {
      this.offset = this.fileSize
    }
  }

  clone(): BinFile {
    const cloned = new BinFile(this.data.slice())
    cloned.fileName = this.fileName
    cloned.fileSize = this.fileSize
    cloned.littleEndian = this.littleEndian
    cloned.offset = 0 // Reset offset for cloned file
    return cloned
  }

  copyTo(target: BinFile, targetOffset: number = 0, sourceLength?: number): void {
    const length = sourceLength ?? (this.fileSize - this.offset)
    const sourceData = this.data.slice(this.offset, this.offset + length)
    
    target.seek(targetOffset)
    target.writeBytes(sourceData)
  }

  getBytes(): Uint8Array {
    return this.data.slice(0, this.fileSize)
  }

  // Hash calculation methods
  hashCRC32(startOffset: number = 0, endOffset?: number): number {
    const end = endOffset ?? this.fileSize
    const data = this.data.slice(startOffset, end)
    
    let crc = 0xffffffff
    const table = this._getCRC32Table()
    
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
    }
    
    return (crc ^ 0xffffffff) >>> 0
  }

  hashCRC16(startOffset: number = 0, length?: number): number {
    const endOffset = length ? startOffset + length : this.fileSize
    const data = this.data.slice(startOffset, Math.min(endOffset, this.fileSize))
    
    let crc = 0xffff
    
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i] << 8
      
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ 0x1021
        } else {
          crc <<= 1
        }
      }
    }
    
    return crc & 0xffff
  }

  hashMD5(): string {
    // Simplified MD5 - in a real implementation, you'd use a proper MD5 library
    return this._simpleHash('md5')
  }

  hashSHA1(): string {
    // Simplified SHA1 - in a real implementation, you'd use a proper SHA1 library  
    return this._simpleHash('sha1')
  }

  private _getCRC32Table(): number[] {
    const table: number[] = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1))
      }
      table[n] = c
    }
    return table
  }

  private _simpleHash(algorithm: string): string {
    // This is a placeholder - use crypto.subtle for real implementations
    let hash = 0
    const data = this.data.slice(0, this.fileSize)
    
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data[i]) & 0xffffffff
    }
    
    return Math.abs(hash).toString(16).padStart(algorithm === 'md5' ? 32 : 40, '0')
  }

  // Variable Length Value methods for UPS format
  readVLV(): number {
    let value = 0
    let shift = 1
    
    while (true) {
      const byte = this.readU8()
      value += (byte & 0x7f) * shift
      
      if ((byte & 0x80) === 0) break
      
      shift <<= 7
      value += shift
    }
    
    return value
  }

  writeVLV(value: number): void {
    while (true) {
      let byte = value & 0x7f
      value >>= 7
      
      if (value === 0) {
        this.writeU8(byte)
        break
      }
      
      this.writeU8(byte | 0x80)
    }
  }

  // Helper method for VLV length calculation
  getVLVLength(value: number): number {
    let length = 0
    
    while (true) {
      length++
      value >>= 7
      if (value === 0) break
    }
    
    return length  }
}
