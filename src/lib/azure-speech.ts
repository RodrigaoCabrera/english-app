export interface WordAssessment {
  word: string;
  accuracyScore: number;
  errorType: "None" | "Omission" | "Insertion" | "Mispronunciation" | "UnexpectedBreak" | "MissingBreak" | "Monotone";
}

export interface PronunciationScore {
  recognizedText: string;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  pronScore: number;
  words: WordAssessment[];
}

interface AzureWord {
  Word: string;
  AccuracyScore?: number;
  ErrorType?: string;
}

interface AzureNBest {
  Words?: AzureWord[];
  AccuracyScore?: number;
  FluencyScore?: number;
  CompletenessScore?: number;
  PronScore?: number;
}

interface AzureResponse {
  RecognitionStatus: string;
  DisplayText?: string;
  NBest?: AzureNBest[];
}

export async function assessPronunciation(
  audioBuffer: Buffer,
  referenceText: string
): Promise<PronunciationScore> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;

  if (!key || !region) {
    throw new Error("AZURE_SPEECH_KEY or AZURE_SPEECH_REGION is not set");
  }

  const assessmentConfig = {
    ReferenceText: referenceText,
    GradingSystem: "HundredMark",
    Dimension: "Comprehensive",
    EnableMiscue: false,
  };

  const assessmentHeader = Buffer.from(
    JSON.stringify(assessmentConfig)
  ).toString("base64");

  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/interactive/cognitiveservices/v1?language=en-US&format=detailed`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
      "Pronunciation-Assessment": assessmentHeader,
    },
    body: audioBuffer as unknown as BodyInit,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Azure Speech API error ${response.status}: ${body}`);
  }

  const data: AzureResponse = await response.json();

  if (data.RecognitionStatus !== "Success" || !data.NBest?.length) {
    throw new Error(
      `Recognition failed: ${data.RecognitionStatus}. No speech detected.`
    );
  }

  const best = data.NBest[0];

  const words: WordAssessment[] = (best.Words ?? []).map((w) => ({
    word: w.Word,
    accuracyScore: w.AccuracyScore ?? 0,
    errorType: (w.ErrorType ?? "None") as WordAssessment["errorType"],
  }));

  return {
    recognizedText: data.DisplayText ?? "",
    accuracyScore: best.AccuracyScore ?? 0,
    fluencyScore: best.FluencyScore ?? 0,
    completenessScore: best.CompletenessScore ?? 0,
    pronScore: best.PronScore ?? 0,
    words,
  };
}
