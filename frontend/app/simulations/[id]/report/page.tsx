"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { MissionReport } from "@/types/api";
import { MissionReportView } from "@/components/MissionReportView";

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [report, setReport] = useState<MissionReport | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getReport(id), api.getMarkdownReport(id)])
      .then(([r, m]) => {
        setReport(r);
        setMarkdown(m);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-sentinel-bad">{error}</p>;
  if (!report) return <p className="text-gray-400">Loading…</p>;

  return <MissionReportView report={report} markdown={markdown} />;
}
