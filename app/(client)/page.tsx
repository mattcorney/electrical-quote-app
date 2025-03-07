"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem } from "@/components/ui/select";

export default function ElectricalQuoteApp() {
  const [projects, setProjects] = useState<{ name: string; jobs: any[] }[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [hourlyRate, setHourlyRate] = useState<number>(50);
  const [jobDescription, setJobDescription] = useState("");
  const [questions, setQuestions] = useState<{ question: string; options: string[] }[]>([]);
  const [answers, setAnswers] = useState<{ question: string; answer: string }[]>([]);
  const [jobs, setJobs] = useState<{ job: string; time: number; materials: string[] }[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [error, setError] = useState("");

  const getQuestions = async () => {
    if (jobDescription.trim() === "") return;

    setLoadingQuestions(true);
    setQuestions([]);
    setAnswers([]);
    setJobs([]);
    setError("");

    try {
      const response = await fetch("/api/aiEstimator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription }),
      });

      const data = await response.json();

      if (response.ok) {
        setQuestions(data.questions);
      } else {
        setError(data.error || "An unexpected error occurred.");
      }
    } catch (error) {
      console.error("Error getting AI questions:", error);
      setError("AI failed to generate questions. Please try again later.");
    } finally {
      setLoadingQuestions(false);
    }
  };

  const getEstimates = async () => {
    setLoadingEstimate(true);
    setJobs([]);
    setError("");

    try {
      const response = await fetch("/api/aiEstimator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, previousAnswers: answers }),
      });

      const data = await response.json();

      if (response.ok) {
        setJobs(data.jobs);
      } else {
        setError(data.error || "An unexpected error occurred.");
      }
    } catch (error) {
      console.error("Error getting AI estimate:", error);
      setError("AI estimation failed. Please try again later.");
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
          <Input
            id="hourlyRate"
            type="number"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(Number(e.target.value))}
          />
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardContent className="p-4">
          <Label htmlFor="jobDescription">Enter Job Description</Label>
          <Input id="jobDescription" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
          <Button onClick={getQuestions} className="mt-2" disabled={loadingQuestions || loadingEstimate}>
            {loadingQuestions ? "Generating Questions..." : "Get Questions"}
          </Button>
          {loadingQuestions && <p className="mt-2 text-blue-500">AI is generating questions, please wait...</p>}
        </CardContent>
      </Card>
      {questions.length > 0 && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold">Clarifying Questions</h3>
            {questions.map((q, index) => (
              <div key={index} className="mt-2">
                <Label>{q.question}</Label>
                <Select onValueChange={(value) => {
                  const newAnswers = [...answers];
                  newAnswers[index] = { question: q.question, answer: value };
                  setAnswers(newAnswers);
                }}>
                  {q.options.map((option, i) => <SelectItem key={i} value={option}>{option}</SelectItem>)}
                </Select>
              </div>
            ))}
            <Button onClick={getEstimates} className="mt-2" disabled={loadingEstimate}>
              {loadingEstimate ? "Generating Estimate..." : "Submit Answers"}
            </Button>
            {loadingEstimate && <p className="mt-2 text-blue-500">AI is calculating the work breakdown...</p>}
          </CardContent>
        </Card>
      )}
      {jobs.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Estimated Work Breakdown</h3>
          <table className="w-full mt-2 border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2">Job</th>
                <th className="border border-gray-300 px-4 py-2">Time (hours)</th>
                <th className="border border-gray-300 px-4 py-2">Materials</th>
                <th className="border border-gray-300 px-4 py-2">Price (£)</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, i) => (
                <tr key={i} className="border border-gray-300">
                  <td className="border border-gray-300 px-4 py-2">{job.job}</td>
                  <td className="border border-gray-300 px-4 py-2">{job.time}</td>
                  <td className="border border-gray-300 px-4 py-2">{job.materials.join(", ")}</td>
                  <td className="border border-gray-300 px-4 py-2">£{(job.time * hourlyRate).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="border border-gray-300 px-4 py-2">Total</td>
                <td className="border border-gray-300 px-4 py-2"></td>
                <td className="border border-gray-300 px-4 py-2"></td>
                <td className="border border-gray-300 px-4 py-2">£{jobs.reduce((sum, job) => sum + job.time * hourlyRate, 0).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {error && <p className="mt-4 text-red-500">{error}</p>}
    </div>
  );
}
