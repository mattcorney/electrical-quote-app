"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ElectricalQuoteApp() {
  const [projects, setProjects] = useState<{ name: string; jobs: any[] }[]>([]);
  const [newProjectName, setNewProjectName] = useState("");

  const addProject = () => {
    if (newProjectName.trim() !== "") {
      setProjects([...projects, { name: newProjectName, jobs: [] }]);
      setNewProjectName("");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Electrical Quote Generator</h1>
      <Card>
        <CardContent className="p-4">
          <Label htmlFor="projectName">New Project Name</Label>
          <Input
            id="projectName"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Enter project name"
          />
          <Button onClick={addProject} className="mt-2">
            Add Project
          </Button>
        </CardContent>
      </Card>
      <div className="mt-6">
        {projects.map((project, index) => (
          <Card key={index} className="mt-2">
            <CardContent className="p-4">
              <h2 className="text-xl font-semibold">{project.name}</h2>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
