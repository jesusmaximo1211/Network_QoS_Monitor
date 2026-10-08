# Network QoS Monitor - TP5

Analizador y visualizador de calidad de red móvil en tiempo real con mapeo de cobertura personal.

## 🚀 Arquitectura del Proyecto

El proyecto está construido en **React Native CLI** siguiendo una arquitectura estructurada en capas para mantener el rendimiento y desacoplar la lógica intensiva del hilo principal (UI Thread):

1.  **Capa Nativa (Native Bridge)**: 
    Implementada en Kotlin (`TelephonyModule.kt`). Se encarga de acceder al `TelephonyManager` de Android, saltando las restricciones de React Native, para extraer métricas duras de telefonía como la fuerza de señal real (RSSI en dBm), el operador y la tecnología específica de la celda (LTE, WCDMA, NR, etc).
2.  **Motor de Medición (Measurement Engine)**:
    -   *Ping & Latencia*: Implementado sobre `react-native-tcp-socket` (`PingEngine.ts`). Mide el RTT real basado en el *TCP Handshake*, lo que permite calcular Jitter y porcentaje de pérdida de paquetes.
    -   *Throughput*: Implementado mediante `axios` (`ThroughputEngine.ts`). Ejecuta un test de descarga y subida asimétrica calculando los Mbps efectivos.
3.  **Persistencia (Persistence Layer)**:
    Utiliza `react-native-sqlite-storage` (`Database.ts`). Guarda eficientemente un historial de cada medición y coordina los tipos de datos generados.
4.  **Capa Geográfica (Geo Layer)**:
    Usa `react-native-geolocation-service` para capturar la ubicación exacta en cada muestreo (tanto en primer plano como en background) y cruzar calidad vs territorio.
5.  **Capa de Presentación y Visualización**:
    -   *Dashboard*: Estado actual detallado de la conexión.
    -   *Heatmap*: Mapeo de la cobertura usando `react-native-maps` ponderando la intensidad de señal (RSSI).
    -   *Gráficos*: Histórico temporal de latencias y velocidades empleando `victory-native`.

## ⚙️ Decisiones de Diseño

*   **TCP RTT vs ICMP Pings**: Se optó por medir el tiempo de establecimiento de conexión TCP en lugar de ICMP, ya que iOS y las versiones modernas de Android (sin Root) bloquean la creación de RAW Sockets. El TCP Handshake (RTT) es un acercamiento sumamente preciso a la latencia real que experimenta la capa de aplicación.
*   **Background Fetch Activo**: Se utilizó `react-native-background-fetch` mediante una *Headless JS Task*. Aunque un *Foreground Service* persistente hubiera permitido medición cada segundo, este consumiría excesiva batería. El Background Fetch es el estándar moderno recomendado por Google/Apple para balancear recolección de datos y consumo de batería.
*   **Alertas Reactivas (Notifee)**: Se desacopló la lógica de evaluación. Si la tarea en background detecta que la red supera los 300ms de latencia o hay severa pérdida de paquetes, despacha una notificación de alerta alta al usuario.

## ⚠️ Limitaciones Conocidas

1.  **Frecuencia en Background Impredescible**: Especialmente en iOS, el sistema operativo usa Machine Learning para determinar la frecuencia real de los "wake-ups" en background. No se garantiza una ejecución exacta cada "N" minutos matemáticos.
2.  **API Restringida en iOS**: Este proyecto implementa la extracción de RSSI puro mediante Android `TelephonyManager`. En iOS, Apple ha bloqueado el acceso al RSSI desde hace varias versiones a nivel de APIs públicas (requiere CoreTelephony privado).
3.  **Protección de Datos (Throughput en Background)**: Se decidió intencionalmente **no** ejecutar el motor de Throughput (carga/descarga de MBs) durante los escaneos en background. Realizar esto periódicamente sin el usuario saberlo derretiría sus gigabytes del plan de datos. Solo se mide latencia/RSSI en background.

## 📦 Exportación de Datos

La aplicación incorpora una función de exportación que realiza un volcado de todos los datos en SQLite y los compila en un archivo estandarizado `.CSV`, el cual es persistido en el sistema de archivos del usuario (mediante `react-native-fs`), dejándolo listo para su posterior análisis con herramientas de Big Data o GIS.
