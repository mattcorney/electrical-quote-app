import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { jobDescription, previousAnswers, hourlyRate } = await req.json();

    if (!jobDescription) {
      return NextResponse.json({ error: "Job description is required." }, { status: 400 });
    }

    // Use provided hourly rate or fallback
    const rate = typeof hourlyRate === "number" && hourlyRate > 0 ? hourlyRate : 50;

    // Step 1: Ask questions if no answers provided yet
    if (!previousAnswers || previousAnswers.length === 0) {
      const questionsPrompt = `
You are an expert UK electrician and electrical estimator.

The user wants a detailed and accurate quote for: "{jobDescription}".

Before providing an estimate, you must ask clarifying questions until you have enough detail for an accurate quote.

Rules:
- Ask as many questions as you need until you have enough information to produce an accurate and realistic quote.
- Prioritise asking about:
  - Approximate cable run length (if relevant)
  - Installation method (chased into walls, surface trunking, conduit, etc.)
  - Type of property (domestic, commercial, industrial)
  - Whether the work is a new installation, replacement, or upgrade
  - Whether holes or chases are required in walls or ceilings
  - Consumer unit or protection upgrades (if applicable)
- Assume:
  - The electrician already has all standard tools and test equipment.
  - Standard UK regulations apply (bonding, earthing, RCD protection, etc.)
  - Minor fixings (clips, saddles, screws, glands) are always included without listing.
- Use clear, concise, and easy-to-answer language.
- Always use UK terminology and measurement units (e.g., metres, millimetres, amps).
- Focus questions on factors that significantly affect material costs, labour time, or installation difficulty.

Question format:
- Each question must offer 3–5 answer choices, plus an "Other" option.

❗ Respond ONLY in strict valid JSON format:
{
  "questions": [
    { "question": "Example question?", "options": ["Option 1", "Option 2", "Other"] }
  ]
}
`;

      console.log("🔹 Requesting AI for clarifying questions...");

      const questionsResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: questionsPrompt }],
        max_tokens: 500,
      });

      const questionsText = questionsResponse.choices[0]?.message?.content || "{}";
      console.log("🔍 Full AI Response (Questions):", questionsText);

      try {
        const parsedQuestions = JSON.parse(questionsText);
        if (!parsedQuestions?.questions || !Array.isArray(parsedQuestions.questions)) {
          return NextResponse.json({ error: "AI did not return valid clarifying questions." }, { status: 500 });
        }
        return NextResponse.json(parsedQuestions);
      } catch (error) {
        console.error("❌ AI JSON Parsing Error (Questions):", error);
        return NextResponse.json({ error: "AI returned invalid JSON for questions." }, { status: 500 });
      }
    }

    // Step 2: AI job breakdown
    const jobsPrompt = `
      You are an expert UK electrician and estimator.

      Job description: "${jobDescription}".

      Clarifying answers:
      ${previousAnswers.map((a: { question: string; answer: string }) => `${a.question}: ${a.answer}`).join("\n")}

      Your job:
      - Break the work into clear, specific job tasks.
      - For each task:
        - Provide a task name (e.g. "Install new consumer unit")
        - Estimate a realistic time range (in hours): { "min": X, "max": Y }
          - High confidence = narrow range
          - Medium = moderate range
          - Low = wider range
        - Provide a confidence level: "High", "Medium", or "Low"
        - List required materials with:
          - Brand, type, size (e.g. "Prysmian 2.5mm T&E")
          - Fixings (e.g. clips, saddles, glands)
          - Price range for each material in £: { "min": X, "max": Y }
        - ❗ Do not include tools – assume the electrician has all tools/test equipment.

      Only return strict valid JSON in this format:
      {
        "jobs": [
          {
            "job": "Task name",
            "confidence": "High" | "Medium" | "Low",
            "timeRange": { "min": X, "max": Y },
            "materials": [
              { "name": "Material Name", "priceRange": { "min": X, "max": Y } }
            ]
          }
        ]
      }
    `;

    console.log("🔹 Requesting AI for job breakdown...");

    const jobsResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: jobsPrompt }],
      max_tokens: 1500,
    });

    let jobsText = jobsResponse.choices[0]?.message?.content || "{}";
    console.log("🔍 Full AI Response (Jobs):", jobsText);

    try {
      jobsText = jobsText.trim();
      if (!jobsText.startsWith("{")) {
        return NextResponse.json({ error: "AI returned invalid JSON format for jobs." }, { status: 500 });
      }

      const parsedJobs = JSON.parse(jobsText);

      if (!parsedJobs?.jobs || !Array.isArray(parsedJobs.jobs) || parsedJobs.jobs.length === 0) {
        return NextResponse.json({ error: "AI did not return a valid job breakdown." }, { status: 500 });
      }

      const updatedJobs = parsedJobs.jobs.map((job: any) => {
        let timeMin = job.timeRange?.min ?? 0;
        let timeMax = job.timeRange?.max ?? 0;
        const confidence = job.confidence || "Medium";

        if (confidence === "High") {
          const mid = (timeMin + timeMax) / 2;
          timeMin = Math.max(mid * 1, 0);
          timeMax = mid * 1.1;
        } else if (confidence === "Medium") {
          timeMin = timeMin * 1;
          timeMax = timeMax * 1.25;
        } else if (confidence === "Low") {
          timeMin = timeMin * 1;
          timeMax = timeMax * 2;
        }

        const labourCostMin = timeMin * rate;
        const labourCostMax = timeMax * rate;

        const materialCostMin = job.materials.reduce((sum: number, m: any) => sum + (m.priceRange?.min || 0), 0);
        const materialCostMax = job.materials.reduce((sum: number, m: any) => sum + (m.priceRange?.max || 0), 0);

        const totalCostMin = labourCostMin + materialCostMin;
        const totalCostMax = labourCostMax + materialCostMax;

        return {
          ...job,
          timeRange: { min: Number(timeMin.toFixed(2)), max: Number(timeMax.toFixed(2)) },
          costRange: {
            labour: { min: Number(labourCostMin.toFixed(2)), max: Number(labourCostMax.toFixed(2)) },
            materials: { min: Number(materialCostMin.toFixed(2)), max: Number(materialCostMax.toFixed(2)) },
            total: { min: Number(totalCostMin.toFixed(2)), max: Number(totalCostMax.toFixed(2)) },
          },
        };
      });

      return NextResponse.json({ jobs: updatedJobs });
    } catch (error) {
      console.error("❌ AI JSON Parsing Error (Jobs):", error);
      return NextResponse.json({ error: "AI returned invalid JSON for jobs." }, { status: 500 });
    }
  } catch (error) {
    console.error("❌ Server Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}