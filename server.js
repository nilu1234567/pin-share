const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// In-memory storage for file metadata (PIN -> file info)
const fileStore = new Map();

// Generate random 2-digit ID (10-99)
function generateID() {
    return Math.floor(10 + Math.random() * 90).toString();
}

// Upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const id = generateID();
        const fileInfo = {
            originalName: req.file.originalname,
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploadTime: Date.now()
        };

        fileStore.set(id, fileInfo);

        // Auto-delete after 1 hour
        setTimeout(() => {
            const file = fileStore.get(id);
            if (file) {
                const filePath = path.join(uploadsDir, file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                fileStore.delete(id);
            }
        }, 60 * 60 * 1000); // 1 hour

        res.json({
            success: true,
            id: id,
            downloadUrl: `/download/${id}`,
            fileName: req.file.originalname,
            fileSize: formatFileSize(req.file.size)
        });
    } catch (error) {
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Verify ID endpoint
app.post('/api/verify', (req, res) => {
    const { id } = req.body;
    
    if (!id || id.length !== 2) {
        return res.status(400).json({ valid: false, error: 'Invalid ID' });
    }

    const fileInfo = fileStore.get(id);
    
    if (fileInfo) {
        res.json({
            valid: true,
            fileName: fileInfo.originalName,
            fileSize: formatFileSize(fileInfo.size)
        });
    } else {
        res.json({ valid: false, error: 'Invalid or expired PIN' });
    }
});

// Download endpoint
app.get('/api/download/:id', (req, res) => {
    const id = req.params.id;
    const fileInfo = fileStore.get(id);

    if (!fileInfo) {
        return res.status(404).send('File not found or expired');
    }

    const filePath = path.join(uploadsDir, fileInfo.filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    res.download(filePath, fileInfo.originalName);
});

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Download page - serves file info and download
app.get('/:id', (req, res) => {
    const id = req.params.id;
    
    // Check if it's a valid 2-digit ID
    if (id && /^[0-9]{2}$/.test(id)) {
        res.sendFile(path.join(__dirname, 'public', 'download.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// View message page (same as download but for messages)
app.get('/view/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'message.html'));
});

// Share message endpoint
app.post('/api/share-message', (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'No message provided' });
        }

        const id = generateID();
        const messageInfo = {
            message: message,
            type: 'message',
            uploadTime: Date.now()
        };

        fileStore.set(id, messageInfo);

        // Auto-delete after 1 hour
        setTimeout(() => {
            fileStore.delete(id);
        }, 60 * 60 * 1000);

        res.json({
            success: true,
            id: id,
            viewUrl: `/view/${id}`
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to share message' });
    }
});

// View message endpoint
app.get('/api/view/:id', (req, res) => {
    const id = req.params.id;
    const info = fileStore.get(id);

    if (!info || info.type !== 'message') {
        return res.status(404).json({ error: 'Message not found or expired' });
    }

    res.json({
        message: info.message
    });
});

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Generate QR code endpoint
app.get('/api/qrcode', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: 'URL required' });
        }
        
        const qrCodeDataUrl = await QRCode.toDataURL(url, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
        
        res.json({ qrCode: qrCodeDataUrl });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
