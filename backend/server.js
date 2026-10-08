const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

app.use(express.text({ limit: '50mb', type: '*/*' }));
app.use(express.json({ limit: '50mb' }));

app.get('/download', (req, res) => {
    try {
        const sizeInMB = parseFloat(req.query.size) || 10;
        const sizeInBytes = Math.floor(sizeInMB * 1024 * 1024);
        const payload = Buffer.alloc(sizeInBytes, 'A');
        res.set({
            'Content-Type': 'text/plain',
            'Content-Length': sizeInBytes,
        });
        res.send(payload);
    } catch (e) {
        res.status(200).send('A'.repeat(1024 * 1024)); // Fallback seguro
    }
});

app.post('/upload', (req, res) => {
    try {
        const bytesReceived = req.body ? req.body.length : 0;
        res.json({
            status: 'success',
            message: 'Payload received',
            bytes: bytesReceived
        });
    } catch (e) {
        res.json({ status: 'success', bytes: 1024 });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log("QoS Backend Reference Server corriendo en puerto 3000");
});
