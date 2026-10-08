import RNFS from 'react-native-fs';
import { DBService } from '../db/Database';

export class ExportService {
  static async exportToCSV(): Promise<string | null> {
    try {
      const records = await DBService.getHistory();
      if (records.length === 0) return null;

      const header = "id,timestamp,latitude,longitude,networkType,operator,rssi,avgPing,jitter,downloadMbps,uploadMbps\n";
      const rows = records.map(r => 
        `${r.id},${r.timestamp},${r.latitude},${r.longitude},${r.networkType},${r.operator},${r.rssi},${r.avgPing},${r.jitter},${r.downloadMbps},${r.uploadMbps}`
      ).join('\n');

      const csvString = header + rows;
      const path = `${RNFS.DocumentDirectoryPath}/QoS_History_${Date.now()}.csv`;

      await RNFS.writeFile(path, csvString, 'utf8');
      return path;
    } catch (e) {
      console.error("Failed to export", e);
      return null;
    }
  }
}
