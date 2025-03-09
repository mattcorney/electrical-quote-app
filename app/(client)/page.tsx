"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { motion } from "framer-motion";


// AI "thinking" animation (bouncing dots)
const TypingDots = () => (
  <motion.div className="flex space-x-2 items-center">
    <span className="text-gray-600">AI is thinking</span>
    {[0, 1, 2].map((_, i) => (
      <motion.span
        key={i}
        className="w-2 h-2 bg-gray-600 rounded-full"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
      />
    ))}
  </motion.div>
);

export default function ElectricalQuoteApp() {
  const [hourlyRate, setHourlyRate] = useState<number>(50);
  const [jobDescription, setJobDescription] = useState(""); 
  const [questions, setQuestions] = useState<{ question: string; options: string[] }[]>([]);
  const [answers, setAnswers] = useState<{ question: string; answer: string }[]>([]);
  const [customAnswers, setCustomAnswers] = useState<{ [key: string]: string }>({});
  const [jobs, setJobs] = useState<{ job: string; time: number; materials: { name: string; price: number }[] }[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("✅ Updated Questions State:", questions);
    console.log("✅ Updated Jobs State:", jobs);
  }, [questions, jobs]);

  const getQuestions = async () => {
    if (jobDescription.trim() === "") return;

    setLoadingQuestions(true);
    setQuestions([]);
    setAnswers([]);
    setCustomAnswers({});
    setJobs([]);
    setError("");

    try {
      const response = await fetch("/api/aiEstimator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription }),
      });

      const data = await response.json();
      console.log("✅ AI Questions Received:", data);

      if (response.ok && data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        const updatedQuestions = data.questions.map(q => ({
          ...q,
          options: [...new Set([...q.options, "Other"])], // Ensure "Other" is always an option
        }));
        setQuestions(updatedQuestions);
      } else {
        setError("No questions generated. Try again.");
      }
    } catch (error) {
      console.error("Error getting AI questions:", error);
      setError("AI failed to generate questions. Please try again.");
    } finally {
      setLoadingQuestions(false);
    }
  };

  const getEstimates = async () => {
    setLoadingEstimate(true);
    setJobs([]);
    setError("");

    for (const q of questions) {
      const answerObj = answers.find(a => a?.question === q.question);
      if (answerObj?.answer === "Other" && (!customAnswers[q.question] || customAnswers[q.question].trim() === "")) {
        setError(`Please provide an answer for: ${q.question}`);
        setLoadingEstimate(false);
        return;
      }
    }

    const finalAnswers = questions.map((q, index) => ({
      question: q.question,
      answer: answers[index]?.answer === "Other" ? customAnswers[q.question] || "" : answers[index]?.answer || "",
    }));

    try {
      const response = await fetch("/api/aiEstimator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, previousAnswers: finalAnswers }),
      });

      const data = await response.json();
      console.log("✅ AI Estimate Received:", JSON.stringify(data, null, 2));

      if (response.ok && Array.isArray(data.jobs) && data.jobs.length > 0) {
        setJobs([...data.jobs]);
      } else {
        setError("No valid jobs received. Please try again.");
      }
    } catch (error) {
      console.error("Error getting AI estimate:", error);
      setError("AI estimation failed. Please try again.");
    } finally {
      setLoadingEstimate(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Electrical Quote Generator</h1>
      <Card>
        <CardContent className="p-4">
          <Label htmlFor="hourlyRate">Hourly Rate (£)</Label>
          <Input id="hourlyRate" type="number" value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value))} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-4">
          <Label htmlFor="jobDescription">Enter Job Description</Label>
          <Textarea id="jobDescription" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
          <Button onClick={getQuestions} className="mt-2" disabled={loadingQuestions || loadingEstimate}>
            {loadingQuestions ? <TypingDots /> : "Get Questions"}
          </Button>
        </CardContent>
      </Card>

      {questions.length > 0 && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold">Clarifying Questions</h3>
            {questions.map((q, index) => (
              <div key={index} className="mt-2">
                <Label>{q.question}</Label>
                <Select
                  value={answers[index]?.answer || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    const newAnswers = [...answers];
                    newAnswers[index] = { question: q.question, answer: value || "" };
                    setAnswers([...newAnswers]);

                    if (value === "Other") {
                      setCustomAnswers(prev => ({ ...prev, [q.question]: "" }));
                    } else {
                      setCustomAnswers(prev => {
                        const updated = { ...prev };
                        delete updated[q.question];
                        return updated;
                      });
                    }
                  }}
                >
                  {q.options.map((option, i) => (
                    <option key={i} value={option}>{option}</option>
                  ))}
                </Select>
                {answers[index]?.answer === "Other" && (
                  <Input
                    type="text"
                    placeholder="Enter your custom answer"
                    value={customAnswers[q.question] || ""}
                    onChange={(e) => setCustomAnswers(prev => ({ ...prev, [q.question]: e.target.value }))}
                    required
                  />
                )}
              </div>
            ))}
            <Button onClick={getEstimates} className="mt-2" disabled={loadingEstimate}>
              {loadingEstimate ? <TypingDots /> : "Submit Answers"}
            </Button>
          </CardContent>
        </Card>
      )}

{jobs.length > 0 && (
  <Card className="mt-4">
    <CardContent className="p-4">
      <h3 className="text-lg font-semibold mb-4">Quote Breakdown</h3>
      <table className="w-full border-collapse border border-gray-300">
        <tbody>
          {jobs.map((job, index) => {
            const labourCost = job.time * hourlyRate;
            const materialCost = job.materials.reduce((sum, m) => sum + m.price, 0);
            const totalCost = labourCost + materialCost;

            return (
              <React.Fragment key={index}>
                {/* Spacing between Jobs */}
                {index !== 0 && <tr><td colSpan={3} className="p-2"></td></tr>}

                {/* Job Title */}
                <tr className="bg-gray-100">
                  <td colSpan={3} className="border p-2 font-bold text-lg">{job.job}</td>
                </tr>
                
                {/* Labour Row */}
                <tr>
                  <td className="border p-2"><strong>Labour:</strong></td>
                  <td className="border p-2">{job.time} hours</td>
                  <td className="border p-2">£{labourCost.toFixed(2)}</td>
                </tr>

                {/* Materials Row */}
                <tr>
                  <td className="border p-2"><strong>Materials:</strong></td>
                  <td className="border p-2">
                    {job.materials.length > 0 ? (
                      job.materials.map((m, i) => <div key={i}>{m.name} (£{m.price})</div>)
                    ) : (
                      "None"
                    )}
                  </td>
                  <td className="border p-2">£{materialCost.toFixed(2)}</td>
                </tr>

                {/* Total Cost for Job */}
                <tr className="bg-gray-200">
                  <td colSpan={2} className="border p-2 font-bold">Total for {job.job}</td>
                  <td className="border p-2 font-bold">£{totalCost.toFixed(2)}</td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Grand Total Section */}
      <table className="w-full border-collapse border border-gray-400 mt-4">
        <tbody>
          <tr className="bg-gray-300">
            <td colSpan={2} className="border p-2 text-lg font-bold">Total Labour Cost</td>
            <td className="border p-2 text-lg font-bold">
              £{jobs.reduce((sum, job) => sum + (job.time * hourlyRate), 0).toFixed(2)}
            </td>
          </tr>
          <tr className="bg-gray-300">
            <td colSpan={2} className="border p-2 text-lg font-bold">Total Materials Cost</td>
            <td className="border p-2 text-lg font-bold">
              £{jobs.reduce((sum, job) => sum + job.materials.reduce((mSum, m) => mSum + m.price, 0), 0).toFixed(2)}
            </td>
          </tr>
          <tr className="bg-gray-400">
            <td colSpan={2} className="border p-2 text-lg font-bold">Grand Total</td>
            <td className="border p-2 text-lg font-bold">
              £{jobs.reduce((sum, job) => sum + (job.time * hourlyRate + job.materials.reduce((mSum, m) => mSum + m.price, 0)), 0).toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </CardContent>
  </Card>
)}


    </div>
  );
}
