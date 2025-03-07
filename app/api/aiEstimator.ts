import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Uses API key from environment
});

export async function POST(req: NextRequest) {
  try {
    const { jobType } = await req.json();

    if (!jobType) {
      return NextResponse.json({ error: "Job type is required" }, { status: 400 });
    }

    const prompt = `Estimate the time required to install ${jobType} for a standard UK home. Provide only a number in hours.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "system", content: prompt }],
      max_tokens: 10,
    });

    return NextResponse.json({ estimatedTime: response.choices[0].message.content });
  } catch (error) {
    console.error("AI Estimation Error:", error);
    return NextResponse.json({ error: "Failed to estimate time" }, { status: 500 });
  }
}
