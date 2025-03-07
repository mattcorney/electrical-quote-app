import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { jobDescription, previousAnswers } = await req.json();

    if (!jobDescription) {
      return NextResponse.json({ error: "Job description is required" }, { status: 400 });
    }

    if (!previousAnswers) {
      // First step: Ask AI to generate multiple-choice clarifying questions
      const prompt = `
        The user wants a quote for electrical work in England under BS7671 regulations based on this description: "${jobDescription}". 
        Provide up to 5 multiple-choice questions to clarify the work. Each question should have 3-5 options.
        Format the response as a JSON array like this:
        [
          { "question": "What type of socket?", "options": ["MK Logic Plus Double Socket", "BG Nexus USB Double Socket", "Hager Sollysta 13A Socket"] },
          { "question": "What type of lighting?", "options": ["Aurora Enlite LED Downlights", "Collingwood H2 Pro Fire-Rated Downlights", "Pendant Light (E27)"] }
        ]
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
      });

      const questions = JSON.parse(response.choices[0]?.message?.content || "[]");

      return NextResponse.json({ questions });
    } else {
      // Second step: Generate a detailed work breakdown based on user answers
      const answersText = previousAnswers.map((q) => `${q.question}: ${q.answer}`).join("\n");
      const prompt = `
        The user described this electrical work for an installation in England following BS7671: "${jobDescription}".
        They answered these clarifying questions:
        ${answersText}

        Now, break down the work into specific jobs. For each job, estimate the time required (in hours) and list every material needed in extreme detail.
        The materials should include:
        - Exact socket, switch, or lighting types with brand recommendations (e.g., MK, Hager, Schneider).
        - Exact cable types and lengths (e.g., "5m of 2.5mm² Twin & Earth (6242Y)").
        - Fixings (e.g., "47mm Galvanised Steel Backbox for a flush-mounted socket").
        - Required accessories (e.g., "20mm PVC Conduit for cable protection").
        - BS7671 compliance notes where needed.
        
        Format the response as a JSON array like this:
        [
          { 
            "job": "Install MK Logic Plus Double Socket", 
            "time": 1.5, 
            "materials": [
              "1x MK Logic Plus 13A Double Socket (K2747WHI)",
              "3m of 2.5mm² Twin & Earth (6242Y) Cable",
              "1x 47mm Galvanised Steel Backbox",
              "1x 20mm PVC Conduit with Bends & Couplings",
              "1x WAGO 221 Lever Connectors (3-port)",
              "1x 10A BS88 Fuse for Protection"
            ]
          },
          { 
            "job": "Install Fire-Rated Downlights", 
            "time": 2, 
            "materials": [
              "4x Collingwood H2 Pro 550 Fire-Rated Downlights",
              "5m of 1.5mm² Twin & Earth (6242Y) Cable",
              "4x 60mm Holesaw Cutouts for Downlight Installation",
              "4x GU10 LED Bulbs (Cool White, 5W)",
              "1x Junction Box (Maintenance Free, WAGO Compatible)"
            ]
          }
        ]
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 700,
      });

      const parsedResponse = JSON.parse(response.choices[0]?.message?.content || "[]");

      if (!Array.isArray(parsedResponse) || parsedResponse.length === 0) {
        throw new Error("Invalid AI response format.");
      }

      return NextResponse.json({ jobs: parsedResponse });
    }
  } catch (error) {
    console.error("AI Estimation Error:", error);
    return NextResponse.json({ error: "AI estimation failed. Please try again later." }, { status: 500 });
  }
}
