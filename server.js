const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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

// Generate random 4-digit PIN
function generatePIN() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const pin = generatePIN();
        const fileInfo = {
            originalName: req.file.originalname,
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploadTime: Date.now()
        };

        fileStore.set(pin, fileInfo);

        // Auto-delete after 1 hour
        setTimeout(() => {
            const file = fileStore.get(pin);
            if (file) {
                const filePath = path.join(uploadsDir, file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                fileStore.delete(pin);
            }
        }, 60 * 60 * 1000); // 1 hour

        res.json({
            success: true,
            pin: pin,
            downloadUrl: `/download/${pin}`,
            fileName: req.file.originalname,
            fileSize: formatFileSize(req.file.size)
        });
    } catch (error) {
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Verify PIN endpoint
app.post('/api/verify', (req, res) => {
    const { pin } = req.body;
    
    if (!pin || pin.length !== 4) {
        return res.status(400).json({ valid: false, error: 'Invalid PIN' });
    }

    const fileInfo = fileStore.get(pin);
    
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
app.get('/api/download/:pin', (req, res) => {
    const pin = req.params.pin;
    const fileInfo = fileStore.get(pin);

    if (!fileInfo) {
        return res.status(404).send('File not found or PIN expired');
    }

    const filePath = path.join(uploadsDir, fileInfo.filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    res.download(filePath, fileInfo.originalName);
});

// Download page
app.get('/download/:pin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'download.html'));
});

// View message page
app.get('/view/:pin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'message.html'));
});

// Share message endpoint
app.post('/api/share-message', (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'No message provided' });
        }

        const pin = generatePIN();
        const messageInfo = {
            message: message,
            type: 'message',
            uploadTime: Date.now()
        };

        fileStore.set(pin, messageInfo);

        // Auto-delete after 1 hour
        setTimeout(() => {
            fileStore.delete(pin);
        }, 60 * 60 * 1000);

        res.json({
            success: true,
            pin: pin,
            viewUrl: `/view/${pin}`
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to share message' });
    }
});

// View message endpoint
app.get('/api/view/:pin', (req, res) => {
    const pin = req.params.pin;
    const info = fileStore.get(pin);

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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
