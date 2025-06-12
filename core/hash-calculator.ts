export class HashCalculator {
  static async calculateSHA256(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  static async calculateSHA1(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  static async calculateHashes(file: File): Promise<{ sha256: string; sha1: string }> {
    const sha256 = await this.calculateSHA256(file);
    const sha1 = await this.calculateSHA1(file);
    return { sha256, sha1 };
  }
}
