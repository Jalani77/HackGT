import { env } from '../../config/env';
import type { AIRecognitionService } from './AIRecognitionService';
import { MockRecognitionService } from './MockRecognitionService';
import { OpenAIRecognitionService } from './OpenAIRecognitionService';

export type { AIRecognitionService, ObjectAnalysis } from './AIRecognitionService';

/** Provider factory — add Gemini/Claude/etc. here without touching the pipeline. */
function createRecognitionService(): AIRecognitionService {
  switch (env.aiProvider) {
    case 'openai':
      return new OpenAIRecognitionService(env.AI_API_KEY, env.AI_MODEL, env.AI_TIMEOUT_MS);
    case 'mock':
      return new MockRecognitionService();
  }
}

export const recognitionService = createRecognitionService();
