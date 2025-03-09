import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure this is set in your .env.local
});

export async function POST(req: Request) {
  try {
    const { jobDescription, previousAnswers } = await req.json();

    if (!jobDescription) {
      return NextResponse.json({ error: "Job description is required." }, { status: 400 });
    }

    // If no previous answers exist, AI must ask questions first
    if (!previousAnswers || previousAnswers.length === 0) {
      const questionsPrompt = `
        You are an expert electrical estimator in the UK.
        The user wants an accurate job estimate for the following work: "${jobDescription}".

        Before estimating, ask **5 essential clarifying questions** to fully understand the work.
        - Ask about installation details, cable routing, material choices, and anything necessary to calculate price.
        - Keep questions short, specific, and easy to answer.
        - Each question must have **3-5 answer options**, including an **"Other"** option.

        Respond **only** in valid JSON format, no additional text:
        {
          "questions": [
            { "question": "Clarifying question?", "options": ["Option 1", "Option 2", "Option 3", "Other"] }
          ]
        }
      `;

      console.log("🔹 Requesting AI for clarifying questions...");

      const questionsResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: questionsPrompt }],
        max_tokens: 500,
      });

      console.log("🔍 Full AI Response (Questions):", JSON.stringify(questionsResponse, null, 2));

      const questionsText = questionsResponse.choices[0]?.message?.content || "{}";

      try {
        const parsedQuestions = JSON.parse(questionsText);
        if (!parsedQuestions?.questions || !Array.isArray(parsedQuestions.questions) || parsedQuestions.questions.length === 0) {
          console.error("⚠️ No clarifying questions received. AI response:", questionsText);
          return NextResponse.json({ error: "AI did not return any valid questions." }, { status: 500 });
        }
        return NextResponse.json(parsedQuestions);
      } catch (error) {
        console.error("❌ AI JSON Parsing Error (Questions):", error);
        return NextResponse.json({ error: "AI returned invalid JSON for questions." }, { status: 500 });
      }
    }

    // If previous answers exist, generate job estimate
    const jobsPrompt = `
      You are an expert electrical estimator in the UK.
      The user provided this job description: "${jobDescription}".
      They answered these clarifying questions:
      ${previousAnswers.map((a: { question: string; answer: string }) => `${a.question}: ${a.answer}`).join("\n")}

      Now, generate a **detailed breakdown** of the work, including:
      - Each **specific** job task required.
      - Estimated **time (in hours)** for each task.
      - A **full list of materials** (with exact brands, model numbers, cable sizes, and fixing types).
      - Estimated **material costs** based on UK supplier prices.

      ❗ **Important: Return only JSON format**, with no extra text:
      {
        "jobs": [
          { "job": "Task name", "time": X, "materials": [{ "name": "Material name", "price": X }] }
        ]
      }
    `;

    console.log("🔹 Requesting AI for job breakdown...");

    const jobsResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: jobsPrompt }],
      max_tokens: 1000,
    });

    console.log("🔍 Full AI Response (Jobs):", JSON.stringify(jobsResponse, null, 2));

    let jobsText = jobsResponse.choices[0]?.message?.content || "{}";
    console.log("🔍 Extracted AI Response (Jobs Text):", jobsText);

    try {
      // Remove extra text if AI adds anything outside JSON
      jobsText = jobsText.trim();
      if (!jobsText.startsWith("{")) {
        console.error("⚠️ AI Response is not JSON:", jobsText);
        return NextResponse.json({ error: "AI returned invalid JSON format for jobs." }, { status: 500 });
      }

      let parsedJobs = JSON.parse(jobsText);

      console.log("✅ Parsed AI Jobs:", JSON.stringify(parsedJobs, null, 2));

      if (!parsedJobs?.jobs || !Array.isArray(parsedJobs.jobs) || parsedJobs.jobs.length === 0) {
        console.error("⚠️ No jobs received. AI response:", jobsText);
        return NextResponse.json({ error: "AI did not return a valid job breakdown." }, { status: 500 });
      }

      return NextResponse.json(parsedJobs);
    } catch (error) {
      console.error("❌ AI JSON Parsing Error (Jobs):", error);
      return NextResponse.json({ error: "AI returned invalid JSON for jobs." }, { status: 500 });
    }
  } catch (error) {
    console.error("❌ Server Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
