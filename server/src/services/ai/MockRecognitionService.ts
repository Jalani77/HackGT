import sharp from 'sharp';
import type { AIRecognitionService, AnalyzeImageInput, ObjectAnalysis } from './AIRecognitionService';

/**
 * Offline stand-in used only when no AI_API_KEY is configured. It does NOT pretend to
 * recognize objects: it derives an honest "unidentified specimen" from the photo's actual
 * dominant color so the rest of the pipeline (storage → card → rarity → XP → collection)
 * can be exercised end-to-end. Same interface as the real provider.
 */
export class MockRecognitionService implements AIRecognitionService {
  readonly provider = 'mock';
  readonly model = 'dominant-color-v1';

  async analyzeImage({ image }: AnalyzeImageInput): Promise<ObjectAnalysis> {
    const { dominant, entropy } = await sharp(image).stats();
    const hue = colorName(dominant.r, dominant.g, dominant.b);
    const name = `Unidentified ${hue} Specimen`;

    return {
      identified: true,
      name,
      canonicalName: name,
      category: 'Other',
      description: `A mostly ${hue.toLowerCase()} discovery. Connect a real AI provider (AI_API_KEY) to identify it.`,
      funFact: `This photo's visual complexity (entropy) scored ${entropy.toFixed(2)} — busier scenes score higher.`,
      confidence: 0.7,
      commonness: entropy > 7 ? 3 : 2,
      isLandmark: false,
      containsPersonAsSubject: false,
      tags: ['mock', hue.toLowerCase()],
    };
  }
}

function colorName(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 50) return 'Shadow';
  if (max - min < 25) return max > 200 ? 'Ivory' : 'Slate';
  const h = hueDegrees(r, g, b, max, min);
  if (h < 20 || h >= 340) return 'Crimson';
  if (h < 45) return 'Amber';
  if (h < 70) return 'Golden';
  if (h < 160) return 'Emerald';
  if (h < 200) return 'Teal';
  if (h < 260) return 'Azure';
  if (h < 300) return 'Violet';
  return 'Rose';
}

function hueDegrees(r: number, g: number, b: number, max: number, min: number): number {
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
