import {GoogleGenAI, Type} from '@google/genai';
import 'dotenv/config';
import express from 'express';
import type {Request, Response} from 'express';
import fs from 'fs';
import path from 'path';

const ADMIN_EMAIL = 'milanacharya9999224925@gmail.com';
const PORT = Number(process.env.PORT) || 3000;

interface FirebaseClientConfig {
  apiKey?: string;
}

function loadFirebaseApiKey(): string {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as FirebaseClientConfig;
    return typeof parsed.apiKey === 'string' ? parsed.apiKey : '';
  } catch {
    return '';
  }
}

async function verifyAdminFirebaseToken(idToken: string): Promise<{email: string} | null> {
  const apiKey = loadFirebaseApiKey();
  if (!apiKey || !idToken) return null;

  const lookupRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({idToken}),
    }
  );
  if (!lookupRes.ok) return null;

  const data = (await lookupRes.json()) as {
    users?: Array<{email?: string; emailVerified?: boolean}>;
  };
  const user = data.users?.[0];
  if (!user?.email || !user.emailVerified) return null;
  if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return null;

  return {email: user.email};
}

interface InvoiceGenerateBody {
  paymentRequestId?: unknown;
  userDisplayName?: unknown;
  userEmail?: unknown;
  planId?: unknown;
  planName?: unknown;
  originalAmountInr?: unknown;
  discountPercent?: unknown;
  paidAmountInr?: unknown;
  amountUsd?: unknown;
  transactionRef?: unknown;
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '64kb'}));

  app.post('/api/generate-invoice', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!token) {
        res.status(401).json({error: 'Missing authorization token.'});
        return;
      }

      const verifiedAdmin = await verifyAdminFirebaseToken(token);
      if (!verifiedAdmin) {
        res.status(403).json({error: 'Only the verified admin can generate official invoices.'});
        return;
      }

      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured. Please add it in Settings > Secrets.',
        });
        return;
      }

      const body = (req.body || {}) as InvoiceGenerateBody;
      const paymentRequestId = String(body.paymentRequestId || '').trim().slice(0, 128);
      const userDisplayName = String(body.userDisplayName || 'MAIND GO Member').trim().slice(0, 80);
      const userEmail = String(body.userEmail || '').trim().slice(0, 160);
      const planId = body.planId === 'PRO_MONTHLY' ? 'PRO_MONTHLY' : 'VIP_ANNUAL';
      const planName = String(
        body.planName || (planId === 'VIP_ANNUAL' ? 'VIP Atmospheric Master' : 'PRO Forecaster')
      )
        .trim()
        .slice(0, 80);
      const originalAmountInr = Number(body.originalAmountInr) || (planId === 'VIP_ANNUAL' ? 2999 : 399);
      const discountPercent = Math.max(0, Math.min(95, Number(body.discountPercent) || 0));
      const paidAmountInr = Math.max(1, Number(body.paidAmountInr) || originalAmountInr);
      const amountUsd = Math.max(0.01, Number(body.amountUsd) || (planId === 'VIP_ANNUAL' ? 39.99 : 4.99));
      const transactionRef = String(body.transactionRef || '').trim().slice(0, 80);

      if (!paymentRequestId || !transactionRef) {
        res.status(400).json({error: 'paymentRequestId and transactionRef are required.'});
        return;
      }

      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const todayStr = new Date().toISOString().slice(0, 10);
      const prompt = [
        'Generate an authentic, formal digital purchase invoice payload in JSON for MAIND GO (Global Weather & Satellite Telemetry Platform).',
        `Customer Name: ${userDisplayName}`,
        `Customer Email: ${userEmail || 'Verified Account'}`,
        `Plan: ${planName} (${planId})`,
        `Original List Price: INR ${originalAmountInr.toFixed(2)}`,
        `Spin Wheel Discount Applied: ${discountPercent}% OFF`,
        `Net Amount Paid via UPI (tntmilan06@slc): INR ${paidAmountInr.toFixed(2)} ($${amountUsd.toFixed(2)})`,
        `UPI UTR / Reference: ${transactionRef}`,
        `Issue Date: ${todayStr}`,
        'Requirements:',
        '- Create a realistic invoiceNumber starting with MGO-2026- and 6 digits.',
        '- Provide 3 concise lineItems summing accurately from the base plan price minus the Spin Wheel discount down to the net UPI paid.',
        '- Include clear termsAndConditions stating that VIP cancellation refunds 86% of the paid UPI amount after deducting a 14% administration charge.',
        '- Keep all strings concise and professional.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are the automated billing and tax invoice generator for MAIND GO Weather Intelligence. Produce crisp, realistic, accurate financial invoice fields matching the provided numbers.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              invoiceNumber: {type: Type.STRING},
              issueDate: {type: Type.STRING},
              billingPeriod: {type: Type.STRING},
              summaryHeadline: {type: Type.STRING},
              lineItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    description: {type: Type.STRING},
                    amount: {type: Type.STRING},
                  },
                  required: ['description', 'amount'],
                },
              },
              termsAndConditions: {type: Type.STRING},
              aiVerificationNote: {type: Type.STRING},
            },
            required: [
              'invoiceNumber',
              'issueDate',
              'billingPeriod',
              'summaryHeadline',
              'lineItems',
              'termsAndConditions',
              'aiVerificationNote',
            ],
          },
        },
      });

      const rawText = (response.text || '').trim();
      if (!rawText) {
        res.status(502).json({error: 'AI invoice generator returned an empty response.'});
        return;
      }

      const cleanedJson = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      let parsed: {
        invoiceNumber?: string;
        issueDate?: string;
        billingPeriod?: string;
        summaryHeadline?: string;
        lineItems?: Array<{description?: string; amount?: string}>;
        termsAndConditions?: string;
        aiVerificationNote?: string;
      };
      try {
        parsed = JSON.parse(cleanedJson) as typeof parsed;
      } catch {
        res.status(502).json({
          error: 'AI invoice generator returned an unexpected format. Please try again.',
        });
        return;
      }

      const ensureMinLen = (val: unknown, fallback: string, min: number, max: number) => {
        const s = String(val || '').trim().slice(0, max);
        return s.length >= min ? s : fallback.slice(0, max);
      };

      const sanitizedItems = (Array.isArray(parsed.lineItems) ? parsed.lineItems : [])
        .slice(0, 6)
        .map((item) => ({
          description: ensureMinLen(item?.description, planName, 1, 160),
          amount: ensureMinLen(item?.amount, `₹${paidAmountInr.toFixed(2)}`, 1, 40),
        }));

      if (sanitizedItems.length === 0) {
        sanitizedItems.push({
          description: `${planName} (${discountPercent}% Spin Discount)`.slice(0, 160),
          amount: `₹${paidAmountInr.toFixed(2)}`,
        });
      }

      res.json({
        invoiceNumber: ensureMinLen(
          parsed.invoiceNumber,
          `MGO-2026-${Date.now().toString().slice(-6)}`,
          4,
          40
        ),
        issueDate: ensureMinLen(parsed.issueDate, todayStr, 4, 60),
        billingPeriod: ensureMinLen(
          parsed.billingPeriod,
          planId === 'VIP_ANNUAL' ? '12 Months Active Access' : '30 Days Active Access',
          4,
          80
        ),
        summaryHeadline: ensureMinLen(
          parsed.summaryHeadline,
          `Official Paid Receipt — ${planName}`,
          4,
          180
        ),
        lineItems: sanitizedItems,
        termsAndConditions: ensureMinLen(
          parsed.termsAndConditions,
          'Cancellations refund 86% of the paid amount via UPI after a 14% administration charge.',
          4,
          600
        ),
        aiVerificationNote: ensureMinLen(
          parsed.aiVerificationNote,
          `Payment UTR ${transactionRef} verified and approved by MAIND GO Administration.`,
          4,
          400
        ),
        sentByAdminEmail: verifiedAdmin.email,
      });
    } catch (err) {
      console.error('Invoice generation error:', err);
      let message = err instanceof Error ? err.message : 'Failed to generate AI invoice.';
      try {
        const maybeObj = JSON.parse(message) as {error?: {message?: string; status?: string}};
        if (maybeObj?.error?.message) {
          message = maybeObj.error.message;
        }
      } catch {
        // Keep original message
      }
      res.status(500).json({error: message});
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MAIND GO server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
