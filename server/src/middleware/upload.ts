import multer from 'multer';
import { discoveryConfig } from '../config/discovery.config';
import { AppError } from '../utils/AppError';

/**
 * Keep uploads in memory: they're validated/re-encoded by ImageService before anything is
 * written, so rejected photos are never persisted. Content is verified by decoding, not by MIME.
 */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: discoveryConfig.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new AppError('INVALID_IMAGE', 'Please upload a photo.'));
    cb(null, true);
  },
});
