const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedExtensions = /\.(jpeg|jpg|png|gif|webp|bmp|svg|heic|heif|mp4|mov|avi|mkv|webm)$/i;

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `file-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const hasAllowedExtension = allowedExtensions.test(file.originalname);
  const hasAllowedMime =
    file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');

  if (hasAllowedExtension || hasAllowedMime) {
    cb(null, true);
    return;
  }

  cb(new Error('Only image and video files are allowed (jpg, png, gif, webp, etc.)'));
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

const handleUpload = (fieldName = 'file') => (req, res, next) => {
  upload.single(fieldName)(req, res, (err) => {
    if (err) return next(err);
    next();
  });
};

module.exports = upload;
module.exports.handleUpload = handleUpload;
module.exports.uploadDir = uploadDir;
