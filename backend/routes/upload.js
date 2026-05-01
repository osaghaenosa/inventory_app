const express = require('express');
const multer = require('multer');
const ImageKit = require('imagekit');
const { auth } = require('../middleware/auth');
const router = express.Router();

const imagekit = new ImageKit({
    publicKey : process.env.IMAGEKIT_PUBLIC_KEY || 'dummy_public',
    privateKey : process.env.IMAGEKIT_PRIVATE_KEY || 'dummy_private',
    urlEndpoint : process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/dummy'
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/', auth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        if (!process.env.IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_URL_ENDPOINT) {
            return res.status(500).json({ message: 'ImageKit credentials are not configured in backend/.env. Please add IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT.' });
        }

        const response = await imagekit.upload({
            file : req.file.buffer, // required
            fileName : req.file.originalname, // required
            folder: '/inventory_items'
        });

        res.json({ url: response.url });
    } catch (error) {
        console.error('Image upload failed:', error);
        res.status(500).json({ message: 'Image upload failed: ' + error.message });
    }
});

module.exports = router;
