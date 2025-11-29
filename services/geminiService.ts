


import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Attachment, StudySession, StudyPlanItem, getAdjustedDate, QuizQuestion, DayPlan, Block, MentorMemory, TimeLogCategory, AISettings } from "../types";

const apiKey = process.env.API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey: apiKey });
} else {
  console.warn("Gemini API key not found.");
}

// --- Audio Helper Functions ---

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

let currentSource: AudioBufferSourceNode | null = null;
let audioContext: AudioContext | null = null;

export const speakText = async (text: string): Promise<() => void> => {
  if (!ai) return () => {};

  if (currentSource) {
      try { currentSource.stop(); } catch(e) {}
      currentSource = null;
  }

  try {
      const safeText = text.substring(0, 3000); 
      const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: safeText }] }],
          config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                  voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Kore' },
                  },
              },
          },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) return () => {};

      if (!audioContext) {
          audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      }

      const audioBuffer = await decodeAudioData(
          decode(base64Audio),
          audioContext,
          24000,
          1
      );

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
      currentSource = source;
      
      source.onended = () => {
          currentSource = null;
      };

      return () => {
          if (currentSource) {
              try { currentSource.stop(); } catch(e) {}
              currentSource = null;
          }
      };

  } catch (error) {
      console.error("TTS Error", error);
      return () => {};
  }
}

export const extractTextFromMedia = async (base64Data: string, mimeType: string): Promise<string | null> => {
    if (!ai) return null;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                    }
                },
                {
                    text: "Transcribe all text from this document/image verbatim. Do not summarize or interpret. Just output the raw text found."
                }
            ]}
        });

        return response.text || null;
    } catch (error) {
        console.error("Error extracting text:", error);
        return null;
    }
};

export const summarizeTextToTopics = async (text: string): Promise<{ topic: string, subTopics: string[] } | null> => {
    if (!ai) return null;

    const truncatedText = text.substring(0, 15000);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [
                {
                    text: `Analyze the following medical study text. Identify the main topic title and a list of key sub-topics or headings.
                    The main topic should be a concise, overarching title. Sub-topics should be specific concepts or sections.
                    Return a strict JSON object: { "topic": "Main Topic Title", "subTopics": ["Sub-topic 1", "Sub-topic 2", ...] }.

                    TEXT TO ANALYZE:
                    ---
                    ${truncatedText}
                    ---
                    `
                }
            ]},
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        topic: { type: Type.STRING },
                        subTopics: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["topic", "subTopics"]
                }
            }
        });

        const responseText = response.text;
        if (!responseText) return null;
        return JSON.parse(responseText);

    } catch (error) {
        console.error("Error summarizing text to topics:", error);
        return null;
    }
};

export const generateStudyChecklist = async (topic: string, duration: number): Promise<string[]> => {
  if (!ai) {
    return [
      "Review core definitions (Mock)",
      "Practice 3 basic problems (Mock)",
      "Summarize key concepts (Mock)"
    ];
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Create a concise, actionable study checklist for the topic: "${topic}". 
      The study session is ${duration} minutes long. 
      Return strictly a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);

  } catch (error) {
    console.error("Error generating study plan:", error);
    return ["Review key concepts", "Practice problems", "Summarize notes"];
  }
};

export const analyzeProgress = async (sessions: any[]): Promise<string> => {
    if (!ai) return "Connect API Key for insights.";

    try {
        const sessionsSummary = JSON.stringify(sessions.slice(0, 10).map(s => ({
            task: s.taskName,
            progress: s.progress,
            revision: s.needsRevision
        })));

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Based on this recent study data: ${sessionsSummary}, give me a 1-sentence motivational insight or tip focusing on items needing revision.`,
        });
        
        return response.text || "Keep up the good work!";
    } catch (e) {
        return "Great job tracking your study sessions!";
    }
}

const urlToBase64 = async (url: string): Promise<{data: string, mimeType: string}> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
             const base64Content = base64data.split(',')[1];
             const mimeType = base64data.split(';')[0].split(':')[1];
             resolve({ data: base64Content, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export const extractTopicFromImage = async (attachment: Attachment): Promise<{ topic: string, subTopics: string[] } | null> => {
  if (!ai) {
      console.warn("Gemini API Key missing.");
      return null;
  }

  try {
      let base64Data = '';
      let mimeType = '';

      if (attachment.data.startsWith('http')) {
          try {
              const result = await urlToBase64(attachment.data);
              base64Data = result.data;
              mimeType = result.mimeType;
          } catch (e) {
              console.error("Failed to fetch image from URL for AI analysis", e);
              return null;
          }
      } else {
          base64Data = attachment.data.split(',')[1];
          mimeType = attachment.data.split(';')[0].split(':')[1];
      }

      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts: [
              {
                  inlineData: {
                      mimeType: mimeType,
                      data: base64Data
                  }
              },
              {
                  text: "Analyze this study page/document. Identify the Main Topic Title and a list of 3-5 specific Sub-topics covered in it. Return strict JSON: { \"topic\": string, \"subTopics\": string[] }."
              }
          ]},
          config: {
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      topic: { type: Type.STRING },
                      subTopics: { 
                          type: Type.ARRAY,
                          items: { type: Type.STRING }
                      }
                  },
                  required: ["topic", "subTopics"]
              }
          }
      });

      const text = response.text;
      if(!text) return null;
      return JSON.parse(text);

  } catch (error) {
      console.error("Error extracting topics from image:", error);
      return null;
  }
};

export const parseStudyRequest = async (userInput: string): Promise<{
    pageNumber: string | null;
    topic: string | null;
    videoUrl: string | null;
    duration: number | null;
    ankiCount: number | null;
} | null> => {
    if (!ai) return null;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Extract study plan details from this user request: "${userInput}".
            Return a JSON object with these fields (use null if not mentioned):
            - pageNumber (string): The page number mentioned.
            - topic (string): A short title for what they want to study.
            - videoUrl (string): Any URL mentioned.
            - duration (number): Estimated study time in minutes.
            - ankiCount (number): Number of flashcards mentioned.
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        pageNumber: { type: Type.STRING },
                        topic: { type: Type.STRING },
                        videoUrl: { type: Type.STRING },
                        duration: { type: Type.INTEGER },
                        ankiCount: { type: Type.INTEGER }
                    }
                }
            }
        });

        const text = response.text;
        if (!text) return null;
        return JSON.parse(text);
    } catch (error) {
        console.error("Error parsing study request:", error);
        return null;
    }
};

// --- TIME LOGGER PARSER ---
export const parseTimeLogRequest = async (userInput: string, referenceTimeISO: string): Promise<{
    startTime: string; // ISO
    endTime: string; // ISO
    activity: string;
    category: TimeLogCategory;
    durationMinutes: number;
} | null> => {
    if (!ai) return null;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `
                Current Reference Time (NOW): ${referenceTimeISO}.
                Analyze the user's activity log text: "${userInput}".
                
                Instructions:
                1. Identify the activity description.
                2. Identify the time range or duration relative to NOW.
                   - If user says "10 mins", assume it ENDED NOW and started 10 mins ago.
                   - If user says "from 5pm to 6pm", use those times for today (unless implied yesterday).
                   - If user says "30 mins ago", that's the start time.
                3. Categorize into one of: STUDY, REVISION, QBANK, ANKI, VIDEO, NOTE_TAKING, BREAK, PERSONAL, SLEEP, ENTERTAINMENT, OUTING, LIFE, OTHER.
                4. Return strict JSON with start/end times in ISO 8601 format.
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        startTime: { type: Type.STRING, description: "ISO 8601 Start Time" },
                        endTime: { type: Type.STRING, description: "ISO 8601 End Time" },
                        activity: { type: Type.STRING },
                        category: { type: Type.STRING, enum: ['STUDY', 'REVISION', 'QBANK', 'ANKI', 'VIDEO', 'NOTE_TAKING', 'BREAK', 'PERSONAL', 'SLEEP', 'ENTERTAINMENT', 'OUTING', 'LIFE', 'OTHER'] },
                        durationMinutes: { type: Type.INTEGER }
                    },
                    required: ["startTime", "endTime", "activity", "category", "durationMinutes"]
                }
            }
        });

        const text = response.text;
        if (!text) return null;
        return JSON.parse(text);
    } catch (error) {
        console.error("Error parsing time log:", error);
        return null;
    }
};

export const generateQuiz = async (topic: string): Promise<QuizQuestion[]> => {
    if (!ai) return [];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a 3-question multiple choice quiz about "${topic}" for a medical student.
            Return JSON: Array of objects with question, options (array of 4 strings), correctAnswer (0-3 index), explanation.`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswer: { type: Type.INTEGER },
                            explanation: { type: Type.STRING }
                        },
                        required: ["question", "options", "correctAnswer", "explanation"]
                    }
                }
            }
        });
        const text = response.text;
        if(!text) return [];
        return JSON.parse(text);
    } catch (e) {
        console.error("Quiz gen error", e);
        return [];
    }
}

export const explainTopic = async (topic: string): Promise<string> => {
    if (!ai) return "AI not connected.";
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Explain the medical concept "${topic}" simply but accurately. Use bullet points for key mechanisms. Keep it under 200 words.`,
        });
        return response.text || "Could not generate explanation.";
    } catch (e) {
        console.error("Explain error", e);
        return "Error generating explanation.";
    }
}

// --- AI MENTOR FUNCTIONS ---

const getContextSummary = (sessions: any[], plan: StudyPlanItem[], streak: number, todaysBlocks?: Block[], displayName?: string) => {
    const now = new Date();
    const todayStr = getAdjustedDate(now);
    const nameContext = displayName ? `USER'S NAME: ${displayName}` : "USER'S NAME: Not provided.";

    const totalMinutes = 0; // Deprecated
    const totalPages = 0; // Deprecated
    const revisionsDue = 0; // Deprecated
    
    const todaysPlan = plan.filter(p => p.date === todayStr);
    const doneToday = todaysPlan.filter(p => p.isCompleted).length;
    const pendingToday = todaysPlan.length - doneToday;

    let blockSummary = "";
    if (todaysBlocks && todaysBlocks.length > 0) {
        try {
            blockSummary = `TODAY'S TIME BLOCKS STATUS (Current Time: ${now.toLocaleTimeString()}):\n` + todaysBlocks.map(b => 
                `- [${b.index}] ID:${b.id} | Title:${b.title} | Status:${b.status} | Planned:${b.plannedStartTime}-${b.plannedEndTime} | Type:${b.type} ${b.status === 'PAUSED' ? '[PAUSED]' : ''}`
            ).join('\n');
        } catch (e) {
            console.warn("Error processing block summary for AI context", e);
            blockSummary = "Could not load detailed block summary.";
        }
    }

    return `
      ${nameContext}
      CURRENT DATE: ${now.toLocaleDateString()} (YYYY-MM-DD: ${todayStr})
      CURRENT TIME: ${now.toLocaleTimeString()}
      USER CONTEXT: Medical Student / Doctor.
      STATS:
      - Current Study Streak: ${streak} days.
      
      IMMEDIATE STATUS:
      - Revisions Due Now: ${revisionsDue} pages.
      - Today's Plan: ${doneToday} finished, ${pendingToday} pending.

      ${blockSummary}
    `;
};

// --- ROBUST GEMINI WRAPPER ---
/**
 * Wraps Gemini API calls to handle errors, including rate limiting, and verify structure.
 * Implements exponential backoff for retries.
 */
const MAX_RETRIES = 5; // Increased retries for more resilience
const INITIAL_BACKOFF_MS = 2000; // Start with a 2s backoff, but grow exponentially

async function callGemini(
    apiCall: () => Promise<any>,
    fallbackMessage: string = "I had trouble understanding the AI response just now. Please try again in a moment."
): Promise<{ text: string; toolCalls?: any[]; raw?: any; error?: string }> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const result = await apiCall();

            if (!result) {
                console.error("Gemini API returned null/undefined result");
                return { text: fallbackMessage, error: "empty-result" };
            }
            
            const candidates = result.candidates;

            if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
                if (result.promptFeedback?.blockReason) {
                    return { 
                        text: "I cannot fulfill this request because it triggered safety guidelines.", 
                        raw: result, 
                        error: "safety-block" 
                    };
                }
                console.error("Gemini response has no candidates", result);
                return { text: fallbackMessage, raw: result, error: "no-candidates" };
            }

            const text = result.text || ""; 
            const toolCalls = result.functionCalls;

            return { text, toolCalls, raw: result }; // Success, exit loop

        } catch (err: any) {
            console.error(`GEMINI CALL FAILED (Attempt ${attempt + 1}/${MAX_RETRIES})`, err);
            
            const errMsg = err.message || JSON.stringify(err);
            const isRateLimitError = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED");
            const isServerError = errMsg.includes("500") || errMsg.includes("Rpc failed") || errMsg.includes("XHR") || errMsg.includes("internal error");

            if ((isRateLimitError || isServerError) && attempt < MAX_RETRIES - 1) { // Only retry if not the last attempt
                const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                const jitter = Math.random() * 1000; // Add up to 1 second of randomness
                const waitTime = backoffTime + jitter;
                console.log(`API error hit (${isRateLimitError ? 'Rate limit' : 'Server error'}). Retrying in ${Math.round(waitTime)}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue; // Go to next attempt
            }

            // Final error handling after all retries or for non-retriable errors
            let friendlyError = "I encountered a connection error. Please try again.";
            
            if (isServerError) {
                friendlyError = "The AI service is currently busy (Server Error 500). Please try again in a few seconds.";
            } else if (errMsg.includes("400")) {
                friendlyError = "The request was invalid. Please try rephrasing.";
            } else if (errMsg.includes("fetch failed") || errMsg.includes("NetworkError") || errMsg.includes("Failed to fetch")) {
                friendlyError = "Network connection lost. Please check your internet.";
            } else if (isRateLimitError) { // This will now be hit on the last retry
                friendlyError = "The AI service is still overloaded after multiple retries. This can happen with heavy usage. Please wait a minute before trying again.";
            }

            return {
                text: friendlyError,
                error: errMsg
            };
        }
    }

    // This part should not be reachable, but as a fallback
    return {
        text: "An unexpected error occurred after all retries.",
        error: "max-retries-unhandled"
    };
}


export const generateMentorDailyBrief = async (sessions: any[], plan: StudyPlanItem[], streak: number, displayName?: string): Promise<{ message: string, quote: string }> => {
    if (!ai) return { message: "AI not connected.", quote: "Medicine is a science of uncertainty and an art of probability." };

    const context = getContextSummary(sessions, plan, streak, undefined, displayName);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `
                ${context}
                
                ROLE: You are a Senior Residency Program Director and Mentor. You are strict but encouraging. You care deeply about the student's consistency.
                TASK: Analyze stats, urge revision if needed, congratulate streak, provide short quote. Refer to the user by name if available.
                OUTPUT FORMAT (JSON): { "message": "...", "quote": "..." }
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        message: { type: Type.STRING },
                        quote: { type: Type.STRING }
                    }
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response text");
        return JSON.parse(text);
    } catch (error) {
        console.warn("Daily Brief Error", error);
        return {
            message: "Consistency is key in medicine. Check your due revisions today.",
            quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit. - Aristotle"
        };
    }
};

const logFAStudyTool: FunctionDeclaration = {
  name: 'logFAStudy',
  description: 'Logs that a user has studied or revised a First Aid (FA) page. Can handle multiple pages at once from a single message.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      updates: {
        type: Type.ARRAY,
        description: 'An array of page updates to log.',
        items: {
          type: Type.OBJECT,
          properties: {
            pageNumber: { type: Type.INTEGER, description: 'The FA page number, e.g., 147.' },
            isRevision: { type: Type.BOOLEAN, description: 'Set to true if the user explicitly said they "revised" it. Otherwise, the system will determine if it is a revision.' },
            topics: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Specific topics or subtopics the user mentioned studying on that page, e.g., ["nephritic syndrome", "RPGN"].' },
            date: { type: Type.STRING, description: 'Optional. The date of study in YYYY-MM-DD format. If not provided, it defaults to today. Extract from phrases like "yesterday", "on Jan 5th", etc.' },
          },
          required: ['pageNumber']
        }
      }
    },
    required: ['updates']
  }
};

const addStudyTaskTool: FunctionDeclaration = {
  name: 'addStudyTask',
  description: 'Adds a SINGLE small study target to the user\'s simple planner list.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: { type: Type.STRING },
      pageNumber: { type: Type.STRING },
      durationMinutes: { type: Type.INTEGER },
      ankiCount: { type: Type.INTEGER },
      videoUrl: { type: Type.STRING }
    },
    required: ['topic', 'pageNumber', 'durationMinutes']
  }
};

const createDayPlanTool: FunctionDeclaration = {
    name: 'createDayPlan',
    description: 'Creates or overwrites a comprehensive "Today\'s Plan" or schedule. Use this when the user provides a schedule or asks for a plan.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            date: { type: Type.STRING },
            startTimePlanned: { type: Type.STRING },
            faPages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            faPagesCount: { type: Type.INTEGER },
            faStudyMinutesPlanned: { type: Type.INTEGER, nullable: true },
            videos: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        subject: { type: Type.STRING },
                        topic: { type: Type.STRING },
                        totalContentHours: { type: Type.NUMBER },
                        playbackRate: { type: Type.NUMBER },
                        effectiveStudyMinutes: { type: Type.NUMBER }
                    },
                    required: ['totalContentHours', 'playbackRate', 'effectiveStudyMinutes']
                }
            },
            anki: {
                type: Type.OBJECT,
                nullable: true,
                properties: {
                    totalCards: { type: Type.INTEGER },
                    plannedMinutes: { type: Type.INTEGER },
                    timeWindowStart: { type: Type.STRING },
                    timeWindowEnd: { type: Type.STRING }
                },
                required: ['totalCards', 'plannedMinutes']
            },
            qbank: {
                type: Type.OBJECT,
                nullable: true,
                properties: {
                    totalQuestions: { type: Type.INTEGER },
                    plannedMinutes: { type: Type.INTEGER },
                    timeWindowStart: { type: Type.STRING },
                    timeWindowEnd: { type: Type.STRING }
                },
                required: ['totalQuestions', 'plannedMinutes']
            },
            breaks: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        label: { type: Type.STRING },
                        startTime: { type: Type.STRING },
                        endTime: { type: Type.STRING },
                        durationMinutes: { type: Type.INTEGER }
                    },
                    required: ['label', 'durationMinutes']
                }
            },
            blocks: {
                type: Type.ARRAY,
                description: 'Specific timeline blocks extracted from user input. Use this if the user provides explicit times.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        plannedStartTime: { type: Type.STRING, description: "HH:mm format" },
                        plannedEndTime: { type: Type.STRING, description: "HH:mm format" },
                        title: { type: Type.STRING },
                        type: { type: Type.STRING, enum: ['VIDEO', 'REVISION_FA', 'ANKI', 'QBANK', 'BREAK', 'OTHER', 'MIXED'] },
                        tasks: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING, enum: ['FA', 'VIDEO', 'ANKI', 'QBANK', 'OTHER'] },
                                    detail: { type: Type.STRING },
                                    meta: {
                                        type: Type.OBJECT,
                                        properties: {
                                            playbackSpeed: { type: Type.NUMBER },
                                            topic: { type: Type.STRING },
                                            videoStartTime: { type: Type.NUMBER },
                                            videoEndTime: { type: Type.NUMBER }
                                        }
                                    }
                                },
                                required: ['type', 'detail']
                            }
                        }
                    },
                    required: ['plannedStartTime', 'plannedEndTime', 'title', 'type']
                }
            },
            notesFromUser: { type: Type.STRING },
            notesFromAI: { type: Type.STRING },
            totalStudyMinutesPlanned: { type: Type.INTEGER },
            totalBreakMinutes: { type: Type.INTEGER }
        },
        required: ['date', 'faPages', 'faPagesCount', 'videos', 'notesFromUser', 'notesFromAI', 'totalStudyMinutesPlanned', 'totalBreakMinutes']
    }
};

const controlSessionTool: FunctionDeclaration = {
    name: 'controlSession',
    description: 'Control the execution of the current or specific time block (Start, Pause, Resume, Finish). The FINISH action is critical for logging what was actually studied.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            action: { type: Type.STRING, enum: ['START', 'PAUSE', 'RESUME', 'FINISH'] },
            blockIndex: { type: Type.INTEGER, description: 'The 0-based index of the block to control.' },
            reason: { type: Type.STRING, description: 'Reason for pausing.' },
            notes: { type: Type.STRING, description: 'User-provided notes about the session.' },
            completionStatus: { type: Type.STRING, enum: ['COMPLETED', 'PARTIAL', 'NOT_DONE'], description: 'How much of the planned work was finished.' },
            pagesCovered: { 
                type: Type.ARRAY, 
                description: "List of page numbers the user explicitly states they covered.",
                items: { type: Type.INTEGER } 
            },
            carryForwardPages: { 
                type: Type.ARRAY, 
                description: "List of page numbers the user did not finish and wants to study later.",
                items: { type: Type.INTEGER } 
            },
            interruptions: {
                type: Type.ARRAY,
                description: 'List of breaks or interruptions that occurred during the study block. Only use for FINISH action.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        start: { type: Type.STRING, description: 'Start time of the break in HH:mm format.' },
                        end: { type: Type.STRING, description: 'End time of the break in HH:mm format.' },
                        reason: { type: Type.STRING, description: 'Short reason for the break (e.g., Phone call, Lunch).' }
                    },
                    required: ['start', 'end', 'reason']
                }
            }
        },
        required: ['action']
    }
};

const updateUserMemoryTool: FunctionDeclaration = {
    name: 'updateUserMemory',
    description: 'Updates the AI Mentor\'s personal memory about the user.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            examTarget: { type: Type.STRING },
            examDate: { type: Type.STRING },
            learningStyle: { type: Type.STRING },
            typicalDelaysIn: { type: Type.ARRAY, items: { type: Type.STRING } },
            preferredTone: { type: Type.STRING },
            averageOverrunMinutes: { type: Type.NUMBER },
            notes: { type: Type.STRING },
            backlog: {
                type: Type.ARRAY,
                items: {
                     type: Type.OBJECT,
                     properties: {
                         id: { type: Type.STRING },
                         dateOriginal: { type: Type.STRING },
                         task: { type: Type.STRING },
                         estimatedMinutes: { type: Type.NUMBER }
                     }
                }
            }
        }
    }
};

const deleteDayPlanTool: FunctionDeclaration = {
  name: 'deleteDayPlan',
  description: 'Deletes the entire study plan for a specific date. This is a destructive action and should only be used after getting explicit confirmation from the user.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING, description: 'The date of the plan to delete in YYYY-MM-DD format. Defaults to today if not specified.' },
    },
    required: ['date']
  }
};

export const chatWithMentor = async (
    history: { role: 'user' | 'model', text: string }[], 
    newMessage: string, 
    sessions: any[], 
    plan: StudyPlanItem[], 
    streak: number,
    attachedImage?: { data: string; mimeType: string },
    todaysBlocks?: Block[],
    mentorMemory?: MentorMemory | null,
    displayName?: string,
    activeMaterialText?: string,
    retrievedContext?: string, // New param for RAG
    aiSettings?: AISettings | null,
    modelName: string = 'gemini-2.5-flash'
): Promise<{ text: string, toolCalls?: any[] }> => {
    if (!ai) return { text: "AI Service unavailable." };

    let context = "";
    try {
        context = getContextSummary(sessions, plan, streak, todaysBlocks, displayName);
    } catch (e) {
        console.error("Failed to generate context summary", e);
        context = "Context summary unavailable due to error.";
    }
    
    let memoryInstruction = "";
    let backlogInstruction = "";
    
    if (mentorMemory) {
        memoryInstruction = `
        PERSONAL MEMORY OF USER (FROM FIRESTORE):
        - Exam Target: ${mentorMemory.examTarget || 'Unknown'}
        - Preferred Tone: ${mentorMemory.preferredTone || 'strict'}
        - Learning Style: ${mentorMemory.learningStyle || 'Unknown'}
        `;

        if (mentorMemory.backlog && mentorMemory.backlog.length > 0) {
            backlogInstruction = `
            CRITICAL BACKLOG:
            ${JSON.stringify(mentorMemory.backlog, null, 2)}
            `;
        }
    }

    let activeMaterialContext = "";
    if (activeMaterialText && aiSettings?.memoryPermissions?.canReadInfoFiles) {
        const MAX_CHARS = 20000; // Limit context to avoid overly large prompts
        const truncatedMaterial = activeMaterialText.length > MAX_CHARS 
            ? activeMaterialText.substring(0, MAX_CHARS) + "\n...[Material Truncated]..."
            : activeMaterialText;
        activeMaterialContext = `
        USER'S ACTIVE INFO FILE (FOR CONTEXT):
        ---
        ${truncatedMaterial}
        ---
        `;
    }

    let infoFilesContext = "";
    if (retrievedContext && aiSettings?.memoryPermissions?.canReadInfoFiles) {
        infoFilesContext = `
        RELEVANT KNOWLEDGE FROM INFO FILES (RAG):
        The following text snippets were found in the user's uploaded materials and might be relevant to their query:
        ---
        ${retrievedContext}
        ---
        Use this information to answer specific medical or study-related questions if applicable.
        `;
    }

    // Dynamic Personality/Behavior Instructions
    let personalityInstruction = "You are a world-class Medical Mentor embedded in 'FocusFlow'.";
    if (aiSettings) {
        switch (aiSettings.personalityMode) {
            case 'calm':
                personalityInstruction += " Your personality is calm, reassuring, and patient. You focus on steady progress and well-being.";
                break;
            case 'strict':
                personalityInstruction += " Your personality is strict, direct, and exam-focused (like a 'C-Mode' mentor). You tolerate no excuses and constantly push the user towards their goal.";
                break;
            case 'balanced':
            default:
                personalityInstruction += " Your personality is balanced: encouraging but firm. You keep the user on track while being supportive.";
                break;
        }

        switch (aiSettings.talkStyle) {
            case 'short':
                personalityInstruction += " Your communication style is short and to-the-point.";
                break;
            case 'teaching':
                personalityInstruction += " You often take on a teaching role, explaining concepts and providing context.";
                break;
            case 'motivational':
                personalityInstruction += " You use motivational language and inspiring quotes to keep the user going.";
                break;
        }
        
        personalityInstruction += ` Your discipline level is ${aiSettings.disciplineLevel}/5 (5 being extremely strict). Adapt your strictness accordingly.`;
    }

    const systemInstruction = `
        ${personalityInstruction}
        USER DATA:
        ${context}
        ${memoryInstruction}
        ${backlogInstruction}
        ${activeMaterialContext}
        ${infoFilesContext}

        CORE DIRECTIVES:
        1.  **ALWAYS PROVIDE TEXT:** Your primary function is to converse. Every single response you generate MUST contain a user-visible \`text\` component.
        2.  **CONFIRM TOOL USE:** When you use a tool (like \`logFAStudy\` or \`controlSession\`), you MUST accompany the tool call with a confirmation message in the \`text\` component. For example: "Okay, I've started the timer for 'Cardio Block'." or "Logged page 151 for you. Nice work!". A response containing ONLY tool calls is a failure.
        3.  **HANDLE GREETINGS:** If the user provides a simple greeting like "Hi" or "Hello", or a conversational filler, simply respond with a friendly greeting. Do NOT try to call a tool for this. Just be conversational.
        4.  **DO NOT DELETE DATA UNLESS CONFIRMED:** You are NOT allowed to use \`deleteDayPlan\` or remove blocks via \`createDayPlan\` unless the user explicitly types a confirmation phrase like "I confirm delete" or "Yes delete the plan". If they ask to delete something, warn them first that it cannot be undone.

        DETAILED INSTRUCTIONS:
        - Refer to the user by their name if it is provided. Be conversational and motivational based on your personality settings.
        - **PLAN-MODIFYING ACTIONS**: For any request that creates, overwrites, or deletes the daily plan, you MUST ask for user confirmation first. The \`createDayPlan\` tool can overwrite an existing plan, so it requires confirmation.
          - When creating/overwriting a plan with \`createDayPlan\`: First, present the key details of the plan you've generated (e.g., total study time, number of videos/pages). Then ask, "Does this look good? I can set this as your schedule for today." Wait for a confirmation like "yes," "confirm," or "go ahead" before calling the tool.
          - **SCHEDULE PARSING INSTRUCTIONS**: If the user pastes a detailed schedule (e.g., "09:00 – 09:30 → Watch OBG Day-2 (Video: 0:00 – 60:00)"), YOU MUST use the \`blocks\` property in the \`createDayPlan\` tool to exactly replicate it.
            - **EXACT TIMES**: Use the start and end times provided (e.g., "09:00", "09:30").
            - **TYPE MAPPING**: 
              - If the line says "Watch", map to \`type: 'VIDEO'\`.
              - If the line says "Revise", map to \`type: 'REVISION_FA'\`.
            - **TASKS**: Create a task for the block.
              - For "Watch" items:
                - Set \`tasks[0].type = 'VIDEO'\`.
                - **EXTRACT TIMESTAMPS**: If the schedule specifies a video range (e.g., "0:00-60:00", "0-60m", "60 to 120"), you MUST extract these numbers.
                  - Set \`tasks[0].meta.videoStartTime\` to the start minute (e.g., 0 or 60).
                  - Set \`tasks[0].meta.videoEndTime\` to the end minute (e.g., 60 or 120).
                  - Set \`tasks[0].detail\` to the video title WITHOUT the raw timestamp (e.g., "Watch OBG Day-2"). Do NOT duplicate the time range in the detail text if you put it in the meta boxes.
              - **2X SPEED INFERENCE**: If the user's schedule shows a short duration (e.g., 30 mins) for a long video segment (e.g., 60 mins), calculate the playback speed (60/30 = 2x). Set \`tasks[0].meta.playbackSpeed\` to this calculated value (e.g., 2).
            - **TITLE**: Use the main action and subject as the title (e.g., "Watch OBG Day-2").
          - When deleting a plan with \`deleteDayPlan\`: Ask, "Are you sure you want to delete the plan for today? This cannot be undone." Wait for confirmation before calling the tool.
        - If the user says they studied a page (e.g., "finished FA 147") but doesn't specify the topic, you MUST ask: "Great, what topics did you cover? Or upload a photo of the page so I can extract it for you."
        - **PARTIAL COMPLETION:** If the user says they only studied some topics from a page, you MUST ask for clarification on which topics were completed and which are pending. Use this to update the log and potentially the backlog.
        - **DATE LOGGING:** If the user mentions a date for their study log (e.g., "yesterday", "on Friday", "Jan 5"), you MUST calculate the date in YYYY-MM-DD format and pass it to the 'date' field in the 'logFAStudy' tool. Today's date is ${getAdjustedDate(new Date())}.
        - **CRITICAL: IMAGE HANDLING:** 
          If the user sends an image along with a study log request (e.g., "Studied page 26" + Image), you MUST:
          1. Analyze the image to extract the main Topic and Subtopics.
          2. IMMEDIATELY call the 'logFAStudy' tool with the page number AND the extracted topics in the 'topics' array.
          3. Do NOT ask the user for the topic if you can see it in the image. Just log it.
        - When logging study via 'logFAStudy', always try to include the 'topics' array if the user provided context or an image.
        - When finishing a block (action: FINISH), you MUST ask the user about their progress (if they completed everything).
        - If a block took longer than planned, you MUST ask if they took any breaks.
    `;

    // Convert history to safe format
    const validHistory = history
        .filter(h => h.text && h.text.trim().length > 0)
        .map(h => ({
            role: h.role,
            parts: [{ text: h.text }]
        }));

    const chat = ai.chats.create({
        model: modelName,
        config: {
            systemInstruction: systemInstruction,
            tools: [{ functionDeclarations: [logFAStudyTool, addStudyTaskTool, createDayPlanTool, controlSessionTool, updateUserMemoryTool, deleteDayPlanTool] }]
        },
        history: validHistory
    });

    const userMessageParts: ({ text: string } | { inlineData: { data: string; mimeType: string; } })[] = [];
    if (attachedImage) {
        userMessageParts.push({
            inlineData: {
                data: attachedImage.data,
                mimeType: attachedImage.mimeType,
            }
        });
    }
    if (newMessage.trim()) {
      userMessageParts.push({ text: newMessage });
    } else if (!attachedImage) {
        // Fallback if empty
        return { text: "" };
    }

    // Use robust wrapper
    const response = await callGemini(() => chat.sendMessage({ message: userMessageParts }));
    
    // If error, return simple text error
    if (response.error) {
        return { text: response.text };
    }

    return { 
        text: response.text, 
        toolCalls: response.toolCalls 
    };
};

export const chatWithStudyBuddy = async (
    history: { role: 'user' | 'model', text: string }[],
    newMessage: string,
    studyMaterial: string,
    modelName: string = 'gemini-2.5-flash'
): Promise<{ text: string }> => {
    if (!ai) return { text: "AI Service unavailable." };

    const MAX_CHARS = 100000;
    const processedMaterial = studyMaterial.length > MAX_CHARS 
        ? studyMaterial.substring(0, MAX_CHARS) + "\n...[Material Truncated]..."
        : studyMaterial;

    const systemInstruction = `
You are my Study Buddy inside a medical study app called FocusFlow.
PRIMARY REFERENCE MATERIAL:
${processedMaterial}
    `;

    const chat = ai.chats.create({
        model: modelName, 
        config: {
            systemInstruction: systemInstruction,
        },
        history: history.map(h => ({
            role: h.role,
            parts: [{ text: h.text }]
        }))
    });

    // Use robust wrapper
    const response = await callGemini(() => chat.sendMessage({ message: newMessage }));
    
    return {
        text: response.text || "I couldn't generate a response."
    };
};