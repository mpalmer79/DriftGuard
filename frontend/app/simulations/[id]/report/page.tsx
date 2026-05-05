"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { MissionReport } from "@/types/api";
import { MissionReportView } from "@/components/MissionReportView";
import { ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDecisions } from "@/lib/hooks/useSimulations";

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [report, setReport] = useState<MissionReport | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState<string | null>(null);
  const decisions = useDecisions(id);

  useEffect(() => {
    Promise.all([api.getReport(id), api.getMarkdownReport(id)])
      .then(([r, m]) => {
        setReport(r);
        setMarkdown(m);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!report) {
    return (
      <div className="space-y-3">
        <Skeleton width="40%" height="2rem" />
        <Skeleton height="6rem" />
        <Skeleton height="12rem" />
      </div>
    );
  }

  return (
    <MissionReportView
      report={report}
      markdown={markdown}
      decisions={decisions.data ?? []}
    />
  );
}
