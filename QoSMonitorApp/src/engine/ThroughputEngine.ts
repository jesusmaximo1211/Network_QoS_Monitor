import axios from 'axios';

const CANDIDATE_URLS = [
  'http://127.0.0.1:3000',
  'http://10.0.2.2:3000',
  'http://192.168.1.100:3000',
];

let activeBackendUrl = CANDIDATE_URLS[0];

export interface ThroughputResult {
  downloadMbps: number;
  uploadMbps: number;
}

export class ThroughputEngine {
  private static resolvedUrl: string | null = null;

  private static async getBackendUrl(): Promise<string> {
    if (this.resolvedUrl) return this.resolvedUrl;
    for (const url of CANDIDATE_URLS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        await axios.get(url + "/download?size=0.1", {
          signal: controller.signal,
          responseType: 'text',
        });
        clearTimeout(timeout);
        this.resolvedUrl = url;
        return url;
      } catch { }
    }
    return CANDIDATE_URLS[0];
  }

  static async measureDownload(): Promise<number> {
    try {
      const baseUrl = await this.getBackendUrl();
      const startTime = Date.now();
      const response = await axios.get(baseUrl + "/download?size=10", {
        responseType: 'text',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const endTime = Date.now();
      
      const durationSec = (endTime - startTime) / 1000;
      const bytes = response.data.length;
      const bits = bytes * 8;
      const mbps = (bits / durationSec) / 1000000;
      
      return mbps;
    } catch (error) {
      console.error("Download test failed", error);
      return 0;
    }
  }

  static async measureUpload(payloadSizeMb: number = 2): Promise<number> {
    try {
      const baseUrl = await this.getBackendUrl();
      const sizeInBytes = payloadSizeMb * 1024 * 1024;
      const payload = 'A'.repeat(sizeInBytes);

      const startTime = Date.now();
      await axios.post(baseUrl + "/upload", payload, {
        headers: { 'Content-Type': 'text/plain' }
      });
      const endTime = Date.now();
      
      const durationSec = (endTime - startTime) / 1000;
      const bits = sizeInBytes * 8;
      const mbps = (bits / durationSec) / 1000000;
      
      return mbps;
    } catch (error) {
      console.error("Upload test failed", error);
      return 0;
    }
  }

  static async runFullTest(): Promise<ThroughputResult> {
    const downloadMbps = await this.measureDownload();
    const uploadMbps = await this.measureUpload();
    return { downloadMbps, uploadMbps };
  }
}
