import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

export interface MeasurementRecord {
  id?: number;
  timestamp: number;
  latitude: number | null;
  longitude: number | null;
  networkType: string;
  operator: string | null;
  rssi: number | null;
  avgPing: number | null;
  jitter: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
}

export class DBService {
  private static db: SQLite.SQLiteDatabase;

  static async initDB() {
    if (!this.db) {
      try {
        this.db = await SQLite.openDatabase({
          name: 'qosmonitor.db',
          location: 'default'
        });
        await this.db.executeSql(`
          CREATE TABLE IF NOT EXISTS measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER,
            latitude REAL,
            longitude REAL,
            networkType TEXT,
            operator TEXT,
            rssi INTEGER,
            avgPing REAL,
            jitter REAL,
            downloadMbps REAL,
            uploadMbps REAL
          );
        `);
        console.log("DB initialized");
      } catch (e) {
        console.error("DB Init error", e);
      }
    }
  }

  static async insertMeasurement(record: MeasurementRecord) {
    await this.initDB();
    const query = `
      INSERT INTO measurements (
        timestamp, latitude, longitude, networkType, operator, rssi, avgPing, jitter, downloadMbps, uploadMbps
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      record.timestamp,
      record.latitude,
      record.longitude,
      record.networkType,
      record.operator,
      record.rssi,
      record.avgPing,
      record.jitter,
      record.downloadMbps,
      record.uploadMbps
    ];

    try {
      await this.db.executeSql(query, params);
      console.log("Measurement inserted successfully");
    } catch (e) {
      console.error("Insert failed", e);
    }
  }

  static async getHistory(
    networkTypeFilter?: string,
    startDate?: number,
    endDate?: number,
    geoZone?: { lat: number, lon: number, radiusKm: number }
  ): Promise<MeasurementRecord[]> {
    await this.initDB();
    try {
      let query = 'SELECT * FROM measurements WHERE 1=1';
      let params: any[] = [];
      
      if (networkTypeFilter && networkTypeFilter !== 'ALL') {
        query += ' AND networkType = ?';
        params.push(networkTypeFilter);
      }
      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }
      
      query += ' ORDER BY timestamp DESC LIMIT 200';

      const [results] = await this.db.executeSql(query, params);
      
      let records: MeasurementRecord[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        records.push(results.rows.item(i));
      }

      // Geo Zone Filter (Haversine Formula in JS)
      if (geoZone) {
        records = records.filter(r => {
          if (!r.latitude || !r.longitude) return false;
          const R = 6371; // Earth radius in km
          const dLat = (r.latitude - geoZone.lat) * (Math.PI/180);
          const dLon = (r.longitude - geoZone.lon) * (Math.PI/180);
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(geoZone.lat * (Math.PI/180)) * Math.cos(r.latitude * (Math.PI/180)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2); 
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
          const distance = R * c;
          return distance <= geoZone.radiusKm;
        });
      }

      return records;
    } catch (e) {
      console.error("Failed to fetch history", e);
      return [];
    }
  }
}
