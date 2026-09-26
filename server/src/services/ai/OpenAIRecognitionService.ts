import OpenAI from 'openai';
import type { AIRecognitionService, AnalyzeImageInput, ObjectAnalysis } from './AIRecognitionService';
import { analysisJsonSchema, parseAnalysis } from './analysisSchema';

const SYSTEM_PROMPT = `You are the field guide inside a campus exploration game. Students photograph
anything around campus (plants, animals, insects, buildings, art, signs, food, objects, landmarks)
and you identify the main subject for a collectible card.

Rules:
- Identify the single most prominent subject as specifically as you reliably can
  (species for plants/animals, style/type for architecture, the actual name for well-known landmarks).
- Never identify or describe specific people. If the main subject is a person, set
  containsPersonAsSubject=true and identified=false.
- If the image is blank, blurry, or has no clear subject, set identified=false.
- funFact must be true and interesting, written for a curious college student, max 200 characters.
- confidence must honestly reflect your certainty.
- If the subject matches an existing catalog name, use that exact name for canonicalName.`;

export class OpenAIRecognitionService implements AIRecognitionService {
  readonly provider = 'openai';
  private client: OpenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    timeoutMs: number,
  ) {
    this.client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 1 });
  }

  async analyzeImage({ image, mimeType, context }: AnalyzeImageInput): Promise<ObjectAnalysis> {
    const known = context.knownCardNames.length
      ? `Existing catalog names on this campus: ${context.knownCardNames.join('; ')}`
      : 'The campus catalog is empty so far.';

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      max_tokens: 500,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'object_analysis', strict: true, schema: analysisJsonSchema as never },
      },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Campus: ${context.campusName}. Season: ${context.season}.\n${known}\nIdentify the main subject of this photo.`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${image.toString('base64')}`, detail: 'low' },
            },
          ],
        },
      ],
    });

    const message = completion.choices[0]?.message;
    if (message?.refusal) throw new Error(`AI refused: ${message.refusal}`);
    if (!message?.content) throw new Error('AI returned an empty response');
    return parseAnalysis(JSON.parse(message.content));
  }
}
