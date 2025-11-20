
import { GoogleGenAI, Type, FunctionDeclaration, Tool } from "@google/genai";
import { Attachment, StudySession, StudyPlanItem, getAdjustedDate } from "../types";

const apiKey = process.env.API_KEY || '';

let ai: GoogleGenAI | null = null;

// Initialize safely
try {
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey: apiKey });
  }
} catch (error) {
  console.error("Failed to initialize GoogleGenAI:", error);
}

// --- Existing Functions ---

export const generateStudyChecklist = async (topic: string, duration: number): Promise<string[]> => {
  if (!ai) {
    console.warn("Gemini API key not found. Mocking response.");
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
      Return strictly a JSON array of strings, where each string is a specific subtask. 
      Do not include markdown code blocks or 'json' labels, just the raw array string.`,
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
    
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini", text);
        return ["Review key concepts", "Practice problems", "Summarize notes"];
    }

  } catch (error) {
    console.error("Error generating study plan:", error);
    throw error;
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

export const extractTopicFromImage = async (attachment: Attachment): Promise<{ topic: string, subTopics: string[] } | null> => {
  if (!ai) {
      console.warn("Gemini API Key missing.");
      return null;
  }

  try {
      // Parse base64 data
      const base64Data = attachment.data.split(',')[1];
      const mimeType = attachment.data.split(';')[0].split(':')[1];

      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
              {
                  inlineData: {
                      mimeType: mimeType,
                      data: base64Data
                  }
              },
              {
                  text: "Analyze this study page/document. Identify the Main Topic Title and a list of 3-5 specific Sub-topics covered in it. Return strict JSON: { \"topic\": string, \"subTopics\": string[] }."
              }
          ],
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
                        pageNumber: { type: Type.STRING, nullable: true },
                        topic: { type: Type.STRING, nullable: true },
                        videoUrl: { type: Type.STRING, nullable: true },
                        duration: { type: Type.INTEGER, nullable: true },
                        ankiCount: { type: Type.INTEGER, nullable: true }
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

// --- NEW AI MENTOR FUNCTIONS ---

const getContextSummary = (sessions: StudySession[], plan: StudyPlanItem[], streak: number) => {
    const now = new Date();
    const todayStr = getAdjustedDate(now);

    // Calc Stats
    const totalMinutes = sessions.reduce((acc, s) => acc + s.history.reduce((hAcc, h) => hAcc + h.durationMinutes, 0), 0);
    const totalPages = sessions.length;
    const revisionsDue = sessions.filter(s => s.nextRevisionDate && new Date(s.nextRevisionDate) <= now).length;
    
    const todaysPlan = plan.filter(p => p.date === todayStr);
    const doneToday = todaysPlan.filter(p => p.isCompleted).length;
    const pendingToday = todaysPlan.length - doneToday;

    return `
      CURRENT DATE: ${now.toLocaleDateString()}
      USER CONTEXT: Medical Student / Doctor.
      STATS:
      - Current Study Streak: ${streak} days.
      - Total Study Time: ${Math.round(totalMinutes/60)} hours.
      - Total Pages Covered: ${totalPages}.
      
      IMMEDIATE STATUS:
      - Revisions Due Now: ${revisionsDue} pages (Prioritize these!).
      - Today's Plan: ${doneToday} finished, ${pendingToday} pending.
    `;
};

export const generateMentorDailyBrief = async (sessions: StudySession[], plan: StudyPlanItem[], streak: number): Promise<{ message: string, quote: string }> => {
    if (!ai) return { message: "AI not connected.", quote: "Medicine is a science of uncertainty and an art of probability." };

    const context = getContextSummary(sessions, plan, streak);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `
                ${context}
                
                ROLE: You are a Senior Residency Program Director and Mentor. You are strict but encouraging. You care deeply about the student's consistency.
                
                TASK:
                1. Analyze the stats above.
                2. If revisions are high, urge them to clear the backlog.
                3. If streak is high, congratulate them.
                4. If no plan for today, tell them to set targets.
                5. Speak directly to the user ("You"). Keep it under 3 sentences.
                6. Provide a short, powerful quote from a famous physician or philosopher (e.g., Osler, Hippocrates, Stoics) relevant to hard work.

                OUTPUT FORMAT (JSON):
                {
                    "message": "Your mentorship feedback here...",
                    "quote": "The quote here - Author"
                }
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
        if (!text) throw new Error("No response");
        return JSON.parse(text);
    } catch (error) {
        console.error("Error generating mentor brief:", error);
        return {
            message: "Consistency is key in medicine. Check your due revisions today.",
            quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit. - Aristotle"
        };
    }
};

// Define the Tool for Adding Tasks
const addStudyTaskTool: FunctionDeclaration = {
  name: 'addStudyTask',
  description: 'Adds a new study target to the user\'s planner. Use this ONLY after the user has confirmed details.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: { type: Type.STRING, description: 'The subject or topic name.' },
      pageNumber: { type: Type.STRING, description: 'The page number in the book.' },
      durationMinutes: { type: Type.INTEGER, description: 'Planned duration in minutes.' },
      ankiCount: { type: Type.INTEGER, description: 'Number of flashcards to do.' },
      videoUrl: { type: Type.STRING, description: 'Optional video URL if mentioned.' }
    },
    required: ['topic', 'pageNumber', 'durationMinutes']
  }
};

export const chatWithMentor = async (
    history: { role: 'user' | 'model', text: string }[], 
    newMessage: string, 
    sessions: StudySession[], 
    plan: StudyPlanItem[], 
    streak: number
): Promise<{ text: string, toolCalls?: any[] }> => {
    if (!ai) return { text: "AI Service unavailable." };

    const context = getContextSummary(sessions, plan, streak);
    const systemInstruction = `
        You are a world-class Medical Mentor embedded in the 'FocusFlow' app.
        
        USER DATA:
        ${context}

        YOUR BEHAVIOR:
        1. **Act like a strict but caring friend.** Use phrases like "Let's be real," "I got you," or "Don't slack off."
        2. **Negotiate Time:** If the user sets a duration that is too long (e.g., > 90 mins for one topic) or unrealistic given their Revisions Due backlog, TELL THEM. Suggest a shorter, more intense sprint (e.g., "2 hours is too loose. Let's do 60 mins intense focus. Deal?").
        3. **Gather Details:** If the user says "I want to study Cardio", DO NOT just say okay. Ask: "Which Page #? How many Anki cards? How long do you need?"
        4. **Action:** ONLY when you have the Page #, Duration, and Topic, call the 'addStudyTask' tool to add it to their plan.
        5. **Confirmation:** After calling the tool, tell them "I've added it to your board. Clock starts when you do."

        GOAL: Optimize their schedule. Don't let them over-plan or under-deliver.
    `;

    try {
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: systemInstruction,
                tools: [{ functionDeclarations: [addStudyTaskTool] }]
            },
            history: history.map(h => ({
                role: h.role,
                parts: [{ text: h.text }]
            }))
        });

        const result = await chat.sendMessage({ message: newMessage });
        
        // Extract Tool Calls if any
        const toolCalls = result.functionCalls;

        return { 
            text: result.text || "", 
            toolCalls: toolCalls 
        };

    } catch (error) {
        console.error("Chat error:", error);
        return { text: "I'm having trouble accessing your charts right now. Try again in a moment." };
    }
};
