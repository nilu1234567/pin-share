# PIN Share - File Sharing App

A simple web application for sharing files between devices using a 4-digit PIN.

## Features

- 📤 Upload files (PDF, JPG, DOC, Excel, etc.)
- 🔐 4-digit PIN security
- 📥 Download files with PIN
- ⏰ Auto-expire after 1 hour
- 📱 Works on PC and Mobile browsers

## How to Use

### Sender (Person 1):
1. Open the app in browser
2. Select or drag & drop your file
3. Click "Upload File"
4. Share the 4-digit PIN and download link with receiver

### Receiver (Person 2):
1. Open the download link received from sender
2. Enter the 4-digit PIN
3. Click "Verify PIN"
4. Download the file

## Installation

1. Install Node.js from https://nodejs.org
2. Open terminal in this folder
3. Run: `npm install`
4. Run: `npm start`
5. Open http://localhost:3000 in your browser

## Supported File Types

- PDF (.pdf)
- Word Documents (.doc, .docx)
- Excel (.xls, .xlsx)
- Images (.jpg, .jpeg, .png, .gif)
- Text files (.txt)

## Tech Stack

- Backend: Node.js + Express
- File Upload: Multer
- Frontend: HTML5 + CSS3 + JavaScript
