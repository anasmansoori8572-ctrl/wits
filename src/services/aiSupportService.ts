import fs from 'fs';
import path from 'path';
import { WITS_LINGO_CONFIG } from '../config/witsLingoConfig';

export interface KnowledgeItem {
  id: string;
  category: 'course' | 'fee' | 'schedule' | 'joining_link' | 'refund' | 'certificate' | 'faq' | 'general';
  title: string;
  keywords: string[];
  content: string;
  updatedAt: string;
}

export interface StudentContext {
  studentId?: string;
  name?: string;
  phone: string;
  email?: string;
  enrolledCourses?: Array<{
    courseId: string;
    courseName: string;
    batchName?: string;
    startDate?: string;
    meetLink?: string;
    paymentStatus?: string;
    transactionId?: string;
    amountPaid?: number;
  }>;
}

export interface AIResponseResult {
  replyText: string;
  shouldEscalate: boolean;
  escalationCategory?: string;
  escalationPriority?: 'low' | 'medium' | 'high' | 'urgent';
  matchedKnowledgeId?: string;
  confidence: number;
}

const DATA_DIR = path.join(process.cwd(), 'uploads', 'data');
const KB_FILE = path.join(DATA_DIR, 'knowledge-base.json');

// Default initial knowledge base articles
export const DEFAULT_KNOWLEDGE_BASE: KnowledgeItem[] = [
  {
    id: 'kb-course-foundation',
    category: 'course',
    title: 'English Foundation Course',
    keywords: ['foundation', 'basic', 'beginner', 'alphabet', 'grammar basics', 'start from zero', 'zero level'],
    content: 'English Foundation is designed for learners starting from absolute basics. Fee: ₹1,199. Duration: 2 Months (40 Live Sessions). Includes basic phonetics, alphabet articulation, simple sentence framing without translation, overcoming stage fear, and foundation grammar workbook (PDF).',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'kb-course-spoken',
    category: 'course',
    title: 'Spoken English Course',
    keywords: ['spoken', 'spoken english', 'speaking', 'fluency', 'hesitation', 'breakout rooms', 'conversational'],
    content: 'Spoken English is our most popular practical speaking course with Zia Sir. Fee: ₹1,499. Duration: 2.5 Months (50 Live Sessions). Focuses on eliminating hesitation, daily conversational drills, removal of Mother Tongue Influence (MTI), and thinking directly in English.',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'kb-course-vocabulary',
    category: 'course',
    title: 'English Vocabulary Course',
    keywords: ['vocab', 'vocabulary', 'words', 'idioms', 'phrases', 'collocations'],
    content: 'English Vocabulary course covers 1,000+ active conversational words, idioms, and smart alternatives. Fee: ₹999. Duration: 1.5 Months (30 Interactive Workshops). Includes weekly quizzes and memory retention techniques.',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'kb-course-communication',
    category: 'course',
    title: 'Communication Skills Course',
    keywords: ['communication', 'interview', 'public speaking', 'presentation', 'corporate', 'email etiquette'],
    content: 'Communication Skills is designed for career boost and interview preparation. Fee: ₹1,699. Duration: 2 Months (35 Masterclass Sessions). Includes job interview simulations, stage presence, email writing, and 1-on-1 mentor feedback.',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'kb-course-advanced',
    category: 'course',
    title: 'Advanced English Course',
    keywords: ['advanced', 'executive', 'debate', 'leadership', 'nuanced', 'rhetoric'],
    content: 'Advanced English is for learners seeking executive fluency and leadership speech. Fee: ₹1,999. Duration: 3 Months (60 Executive Sessions). Includes spontaneous debate rounds, tone control, and complex synthesis.',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'kb-fees-all',
    category: 'fee',
    title: 'Wits Lingo Course Fees Overview',
    keywords: ['fees', 'fee', 'price', 'pricing', 'cost', 'kitna hai', 'kitne paise', 'discount'],
    content: 'Wits Lingo Course Fees:\n• English Foundation: ₹1,199\n• Spoken English: ₹1,499\n• English Vocabulary: ₹999\n• English Conversation: ₹1,299\n• Communication Skills: ₹1,699\n• Advanced English: ₹1,999\nAll fees include live sessions, study materials (PDF), and 60-day class recordings access.',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'kb-schedule-timings',
    category: 'schedule',
    title: 'Class Timings & Batch Schedules',
    keywords: ['timing', 'timings', 'schedule', 'time', 'kab hoti hai', 'start date', 'batch start', 'class time'],
    content: `Live batches are held in the evening: ${WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME}. New batches start from the ${WITS_LINGO_CONFIG.FALLBACK_START_DATE}. Full schedules and recording replays are accessible in your Student Dashboard.`,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'kb-joining-meet',
    category: 'joining_link',
    title: 'Live Class Joining Link & Google Meet',
    keywords: ['meet', 'link', 'google meet', 'join', 'class link', 'kaise join karein', 'session link'],
    content: `Official live classes are conducted online via Google Meet.\nPermanent Joining Link: ${WITS_LINGO_CONFIG.GOOGLE_MEET_LINK}\nPlease ensure you are logged in with your registered email before joining the class room.`,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'kb-certificate-policy',
    category: 'certificate',
    title: 'Course Completion Certificate',
    keywords: ['certificate', 'cert', 'completion', 'marksheet', 'diploma'],
    content: 'Students receive an official verifiable Wits Lingo Academy Certificate upon completing the course with at least 80% attendance in live sessions and passing the final practical speaking evaluation.',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'kb-refund-policy',
    category: 'refund',
    title: 'Refund & Cancellation Policy',
    keywords: ['refund', 'money back', 'cancel', 'cancellation', 'wapas', 'return'],
    content: 'Wits Lingo offers a 100% money-back guarantee within the first 7 days of batch commencement if you are not fully satisfied with the teaching quality. To initiate a refund, simply request support here or email witslingo@gmail.com with your transaction ID.',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'kb-founder-zia',
    category: 'general',
    title: 'About Founder Ziyaur Rehman Zia',
    keywords: ['mentor', 'teacher', 'founder', 'zia', 'sir', 'trainer', 'who teaches'],
    content: 'All primary live sessions are personally conducted by Ziyaur Rehman Zia (Zia Sir), celebrated English language educator and founder of Wits Lingo, known for his zero-hesitation, conversational speaking pedagogy.',
    updatedAt: new Date().toISOString()
  }
];

export class AiSupportService {
  private knowledgeBase: KnowledgeItem[] = [];

  constructor() {
    this.loadKnowledgeBase();
  }

  public loadKnowledgeBase(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(KB_FILE)) {
        const raw = fs.readFileSync(KB_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) {
          this.knowledgeBase = data;
          return;
        }
      }
      // Seed default knowledge base
      this.knowledgeBase = [...DEFAULT_KNOWLEDGE_BASE];
      fs.writeFileSync(KB_FILE, JSON.stringify(this.knowledgeBase, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[AI Support] Error loading knowledge base, using in-memory defaults:', err);
      this.knowledgeBase = [...DEFAULT_KNOWLEDGE_BASE];
    }
  }

  public getKnowledgeBase(): KnowledgeItem[] {
    return this.knowledgeBase;
  }

  public saveKnowledgeBase(items: KnowledgeItem[]): void {
    this.knowledgeBase = items;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(KB_FILE, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AI Support] Error saving knowledge base to disk:', err);
    }
  }

  public addOrUpdateKnowledgeItem(item: Omit<KnowledgeItem, 'updatedAt'>): KnowledgeItem {
    const existingIndex = this.knowledgeBase.findIndex(k => k.id === item.id);
    const updated: KnowledgeItem = {
      ...item,
      updatedAt: new Date().toISOString()
    };
    if (existingIndex >= 0) {
      this.knowledgeBase[existingIndex] = updated;
    } else {
      this.knowledgeBase.push(updated);
    }
    this.saveKnowledgeBase(this.knowledgeBase);
    return updated;
  }

  public deleteKnowledgeItem(id: string): boolean {
    const initialLen = this.knowledgeBase.length;
    this.knowledgeBase = this.knowledgeBase.filter(k => k.id !== id);
    if (this.knowledgeBase.length !== initialLen) {
      this.saveKnowledgeBase(this.knowledgeBase);
      return true;
    }
    return false;
  }

  /**
   * Process a student inquiry and return a verified, accurate answer or escalate to human agent.
   */
  public async answerInquiry(
    question: string,
    studentCtx?: StudentContext
  ): Promise<AIResponseResult> {
    const trimmed = (question || '').trim();
    if (!trimmed) {
      return {
        replyText: 'Hi! How can I assist you with your Wits Lingo courses today? Ask me about course fees, class timings, joining links, or your enrollment details.',
        shouldEscalate: false,
        confidence: 1.0
      };
    }

    const lowerQ = trimmed.toLowerCase();

    // 1. Escalation check: Urgent complaints, refund disputes, or human requests
    const isRefundRequest = lowerQ.includes('refund') || lowerQ.includes('cancel my course') || lowerQ.includes('money back') || lowerQ.includes('paise wapas');
    const isPaymentDispute = lowerQ.includes('fraud') || lowerQ.includes('payment failed but debited') || lowerQ.includes('paise kat gaye') || lowerQ.includes('money deducted');
    const isHumanRequest = lowerQ.includes('talk to human') || lowerQ.includes('speak with agent') || lowerQ.includes('call me') || lowerQ.includes('human agent') || lowerQ.includes('zia sir se baat');

    if (isRefundRequest) {
      return {
        replyText: `I understand you have a refund / cancellation request regarding Wits Lingo. Under our 7-day money-back policy, your request has been escalated to our administration desk. A support ticket has been created for you, and our team will contact you within 24 hours to process it.`,
        shouldEscalate: true,
        escalationCategory: 'refund_request',
        escalationPriority: 'high',
        confidence: 0.95
      };
    }

    if (isPaymentDispute) {
      return {
        replyText: `I see that you experienced a payment deduction issue. Please do not worry. If money was debited from your bank/UPI, Razorpay will either auto-reconcile within 24-48 hours or refund it automatically. I have logged an urgent support ticket with our accounts team to verify your payment status manually.`,
        shouldEscalate: true,
        escalationCategory: 'payment_dispute',
        escalationPriority: 'urgent',
        confidence: 0.95
      };
    }

    if (isHumanRequest) {
      return {
        replyText: `Sure! I have forwarded your request to our senior human support team. A team mentor will get in touch with you right away on this WhatsApp number.`,
        shouldEscalate: true,
        escalationCategory: 'human_handover',
        escalationPriority: 'medium',
        confidence: 0.95
      };
    }

    // 2. Check for Student Account / Enrollment / Payment specific questions
    const isPaymentQuery = lowerQ.includes('my payment') || lowerQ.includes('transaction') || lowerQ.includes('receipt') || lowerQ.includes('mera payment') || lowerQ.includes('payment status');
    const isJoiningLinkQuery = lowerQ.includes('joining link') || lowerQ.includes('class link') || lowerQ.includes('meet link') || lowerQ.includes('kaise join') || lowerQ.includes('how to join class') || lowerQ.includes('google meet') || lowerQ.includes('platform') || lowerQ.includes('conducted');

    if (isPaymentQuery && studentCtx?.enrolledCourses && studentCtx.enrolledCourses.length > 0) {
      const activeEnrollment = studentCtx.enrolledCourses[0];
      return {
        replyText: `Hello ${studentCtx.name || 'Student'}! Here is your verified payment record:\n\n• Course: ${activeEnrollment.courseName}\n• Status: ${activeEnrollment.paymentStatus || 'Verified & Paid'}\n• Amount Paid: ₹${activeEnrollment.amountPaid || 'Confirmed'}\n• Transaction ID: ${activeEnrollment.transactionId || 'Verified on Server'}\n\nYour seat is fully confirmed. You can access your full admission slip and materials in your Student Dashboard anytime!`,
        shouldEscalate: false,
        confidence: 0.98
      };
    }

    if (isJoiningLinkQuery) {
      const meetLink = WITS_LINGO_CONFIG.GOOGLE_MEET_LINK;
      if (studentCtx?.enrolledCourses && studentCtx.enrolledCourses.length > 0) {
        const activeEnrollment = studentCtx.enrolledCourses[0];
        return {
          replyText: `Hello ${studentCtx.name || 'Student'}! Here are your live class details for ${activeEnrollment.courseName}:\n\n• Live Platform: Google Meet\n• Joining Link: ${meetLink}\n• Schedule: ${WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME}\n• Start Date: ${activeEnrollment.startDate || WITS_LINGO_CONFIG.FALLBACK_START_DATE}\n\nPlease join 5 minutes before class time!`,
          shouldEscalate: false,
          confidence: 0.98
        };
      } else {
        return {
          replyText: `Our live classes are held online on Google Meet with Zia Sir (${WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME}).\nPermanent Class Link: ${meetLink}\n\nTo enroll in an upcoming batch, please visit our website and select your course!`,
          shouldEscalate: false,
          confidence: 0.9
        };
      }
    }

    // 3. Try external AI API (Gemini or OpenAI) if configured
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();

    if (geminiKey) {
      try {
        const aiRes = await this.queryGemini(trimmed, studentCtx, geminiKey);
        if (aiRes) return aiRes;
      } catch (err) {
        console.warn('[AI Support] Gemini query failed, falling back to local KB engine:', err);
      }
    } else if (openaiKey) {
      try {
        const aiRes = await this.queryOpenAI(trimmed, studentCtx, openaiKey);
        if (aiRes) return aiRes;
      } catch (err) {
        console.warn('[AI Support] OpenAI query failed, falling back to local KB engine:', err);
      }
    }

    // 4. Fallback: Intelligent Keyword and Semantic Matching against Knowledge Base
    return this.matchKnowledgeBase(trimmed, studentCtx);
  }

  /**
   * Internal Semantic / Keyword Matcher over approved Knowledge Base
   */
  private matchKnowledgeBase(query: string, studentCtx?: StudentContext): AIResponseResult {
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    let bestMatch: KnowledgeItem | null = null;
    let maxScore = 0;

    for (const item of this.knowledgeBase) {
      let score = 0;
      for (const kw of item.keywords) {
        const kwLower = kw.toLowerCase();
        if (query.toLowerCase().includes(kwLower)) {
          score += 3;
        } else {
          for (const token of tokens) {
            if (kwLower.includes(token)) score += 1;
          }
        }
      }

      if (query.toLowerCase().includes(item.title.toLowerCase())) {
        score += 4;
      }

      if (score > maxScore) {
        maxScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch && maxScore >= 2) {
      let personalizedContent = bestMatch.content;
      if (studentCtx?.name) {
        personalizedContent = `Hello ${studentCtx.name}!\n\n${personalizedContent}`;
      }
      return {
        replyText: personalizedContent,
        shouldEscalate: false,
        matchedKnowledgeId: bestMatch.id,
        confidence: Math.min(1.0, 0.6 + maxScore * 0.08)
      };
    }

    // Low confidence: escalate to human support
    return {
      replyText: `Thank you for reaching out to Wits Lingo! I don't have the exact answer to your question in my knowledge base right now. I have created a support ticket for you so our academic team can review your inquiry and message you directly here on WhatsApp.`,
      shouldEscalate: true,
      escalationCategory: 'general_query',
      escalationPriority: 'medium',
      confidence: 0.3
    };
  }

  /**
   * Query Google Gemini API
   */
  private async queryGemini(
    query: string,
    studentCtx?: StudentContext,
    apiKey?: string
  ): Promise<AIResponseResult | null> {
    if (!apiKey) return null;

    const systemPrompt = `You are the official AI Student Assistant for Wits Lingo — A Global Language Platform founded by Ziyaur Rehman Zia (Zia Sir).
Your goal is to assist students politely and accurately regarding courses, schedules, fees, Google Meet joining links, and study materials.

STRICT ACCURACY RULES:
1. ONLY provide facts stated in the Knowledge Base below or verified student records. NEVER invent prices, joining links, certificates, or dates.
2. If student asks about live class link, provide: ${WITS_LINGO_CONFIG.GOOGLE_MEET_LINK}.
3. Support both English and polite conversational Hinglish.
4. Keep responses concise, clear, and student-friendly.
5. If the user asks for a refund, has a payment dispute, or asks something outside the knowledge base, state that you are escalating to a human support agent.

VERIFIED KNOWLEDGE BASE:
${JSON.stringify(this.knowledgeBase.map(k => ({ title: k.title, content: k.content })))}

STUDENT CONTEXT (IF ENROLLED):
${studentCtx ? JSON.stringify(studentCtx) : 'Visitor (not yet logged in)'}
`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nStudent Question: "${query}"` }] }
        ],
        generationConfig: {
          maxOutputTokens: 350,
          temperature: 0.3
        }
      })
    });

    if (!res.ok) return null;

    const data = (await res.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const shouldEscalate = text.toLowerCase().includes('escalat') || text.toLowerCase().includes('support ticket') || text.toLowerCase().includes('human agent');

    return {
      replyText: text.trim(),
      shouldEscalate,
      escalationCategory: shouldEscalate ? 'ai_handover' : undefined,
      escalationPriority: 'medium',
      confidence: 0.95
    };
  }

  /**
   * Query OpenAI API
   */
  private async queryOpenAI(
    query: string,
    studentCtx?: StudentContext,
    apiKey?: string
  ): Promise<AIResponseResult | null> {
    if (!apiKey) return null;

    const systemPrompt = `You are the official AI Student Assistant for Wits Lingo Academy founded by Zia Sir.
Answer questions based on the Knowledge Base. Keep responses concise and friendly.
Approved Meet Link: ${WITS_LINGO_CONFIG.GOOGLE_MEET_LINK}
Knowledge: ${JSON.stringify(this.knowledgeBase.map(k => ({ title: k.title, content: k.content })))}
Student: ${studentCtx ? JSON.stringify(studentCtx) : 'Visitor'}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        max_tokens: 350,
        temperature: 0.3
      })
    });

    if (!res.ok) return null;

    const data = (await res.json()) as any;
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return null;

    const shouldEscalate = text.toLowerCase().includes('escalat') || text.toLowerCase().includes('support ticket') || text.toLowerCase().includes('human agent');

    return {
      replyText: text.trim(),
      shouldEscalate,
      escalationCategory: shouldEscalate ? 'ai_handover' : undefined,
      confidence: 0.95
    };
  }
}

let aiServiceInstance: AiSupportService | null = null;
export function getAiSupportService(): AiSupportService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AiSupportService();
  }
  return aiServiceInstance;
}
export const aiSupportService = getAiSupportService();

