import type { CardCategory, Season } from '../../../../shared/types';

/** What the AI tells us about a photo. The AI describes; the server decides rarity/XP/value. */
export interface ObjectAnalysis {
  identified: boolean;
  name: string;
  /** Generic, stable name used to de-duplicate cards across students ("Southern Live Oak"). */
  canonicalName: string;
  category: CardCategory;
  description: string;
  funFact: string;
  /** 0..1 */
  confidence: number;
  /** General-world commonness estimate: 1 = everywhere … 5 = very unusual. One input to rarity. */
  commonness: 1 | 2 | 3 | 4 | 5;
  isLandmark: boolean;
  /** Privacy gate: true if the main subject is a person. We never identify people. */
  containsPersonAsSubject: boolean;
  tags: string[];
}

export interface AnalyzeImageInput {
  image: Buffer;
  mimeType: string;
  context: {
    campusName: string;
    season: Season;
    /** Existing catalog names so the model can reuse them for consistent identity. */
    knownCardNames: string[];
  };
}

export interface AIRecognitionService {
  readonly provider: string;
  readonly model: string;
  analyzeImage(input: AnalyzeImageInput): Promise<ObjectAnalysis>;
}
