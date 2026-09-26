import sharp from 'sharp';
import { AppError } from '../utils/AppError';

export interface ProcessedImage {
  /** Full photo, max 1280px, JPEG. Re-encoding drops EXIF (incl. GPS) metadata. */
  photo: Buffer;
  /** Square card art, 640px, JPEG. */
  cardArt: Buffer;
  /** Small version sent to the AI (cheaper, faster). */
  analysis: Buffer;
  mimeType: 'image/jpeg';
}

const MIN_DIMENSION = 64;

export const ImageService = {
  /** Validate the upload is a real image (by decoding it, not trusting the MIME header) and derive variants. */
  async process(input: Buffer): Promise<ProcessedImage> {
    let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
    try {
      meta = await sharp(input).metadata();
    } catch {
      throw new AppError('INVALID_IMAGE', "That file doesn't look like a photo. Try taking another one.");
    }
    if (!meta.width || !meta.height || meta.width < MIN_DIMENSION || meta.height < MIN_DIMENSION) {
      throw new AppError('INVALID_IMAGE', 'That photo is too small to identify. Try getting closer.');
    }

    // .rotate() applies EXIF orientation before metadata is discarded.
    const base = () => sharp(input, { limitInputPixels: 50_000_000 }).rotate();

    const [photo, cardArt, analysis] = await Promise.all([
      base().resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer(),
      base().resize(640, 640, { fit: 'cover', position: sharp.strategy.attention }).jpeg({ quality: 85 }).toBuffer(),
      base().resize(768, 768, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer(),
    ]);

    return { photo, cardArt, analysis, mimeType: 'image/jpeg' };
  },
};
