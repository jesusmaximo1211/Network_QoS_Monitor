import TcpSocket from 'react-native-tcp-socket';

export interface PingResult {
  host: string;
  rtt: number; // in ms
  success: boolean;
  error?: string;
}

export interface PingStats {
  min: number;
  max: number;
  avg: number;
  jitter: number;
  packetLoss: number; // percentage
}

export class PingEngine {
  /**
   * Mide la latencia abriendo un socket TCP (TCP Handshake RTT)
   */
  static async measureLatency(host: string, port: number = 80, timeoutMs: number = 3000): Promise<PingResult> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let isResolved = false;

      const client = TcpSocket.createConnection({
        port: port,
        host: host,
      }, () => {
        // ¡Conectado! Medimos el tiempo del Handshake TCP
        const endTime = performance.now();
        if (!isResolved) {
          isResolved = true;
          client.destroy();
          resolve({ host, rtt: endTime - startTime, success: true });
        }
      });

      client.on('error', (error) => {
        if (!isResolved) {
          isResolved = true;
          client.destroy();
          resolve({ host, rtt: 0, success: false, error: error.message });
        }
      });

      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          client.destroy();
          resolve({ host, rtt: 0, success: false, error: 'Timeout' });
        }
      }, timeoutMs);
    });
  }

  /**
   * Ejecuta una serie de pings (sondas) contra múltiples hosts para calcular promedios, jitter y pérdida.
   */
  static async runPingSuite(hosts: string[], countPerHost: number = 5): Promise<Record<string, PingStats>> {
    const results: Record<string, PingStats> = {};

    for (const host of hosts) {
      const rtts: number[] = [];
      let lost = 0;

      for (let i = 0; i < countPerHost; i++) {
        const res = await this.measureLatency(host);
        if (res.success) {
          rtts.push(res.rtt);
        } else {
          lost++;
        }
        // Pequeño delay entre pings para no saturar y simular un ping real
        await new Promise(r => setTimeout(r, 200));
      }

      if (rtts.length > 0) {
        const min = Math.min(...rtts);
        const max = Math.max(...rtts);
        const avg = rtts.reduce((a, b) => a + b, 0) / rtts.length;
        
        // Calcular Jitter (promedio de las diferencias entre RTTs consecutivos)
        let jitterSum = 0;
        for (let i = 1; i < rtts.length; i++) {
          jitterSum += Math.abs(rtts[i] - rtts[i-1]);
        }
        const jitter = rtts.length > 1 ? jitterSum / (rtts.length - 1) : 0;

        results[host] = {
          min,
          max,
          avg,
          jitter,
          packetLoss: (lost / countPerHost) * 100
        };
      } else {
        results[host] = { min: 0, max: 0, avg: 0, jitter: 0, packetLoss: 100 };
      }
    }

    return results;
  }
}
