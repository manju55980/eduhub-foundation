import { useState } from "react";

import { EmptyState, ErrorState } from "@/components/app-shell/page-state";
import { MetaItem, MetaList } from "@/components/app-shell/record-card";
import { Button } from "@/components/ui/button";

import { createMaterialDownloadUrl } from "@/features/instructor/course-materials-api";
import { materialSizeLabel, type CourseMaterial } from "@/features/instructor/course-material";

export function CourseMaterialList({ materials }: { materials: CourseMaterial[] }) {
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");

  async function download(material: CourseMaterial) {
    if (downloadingId) return;
    setDownloadingId(material.id);
    setError("");
    const result = await createMaterialDownloadUrl(material.storagePath);
    setDownloadingId("");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  if (materials.length === 0) {
    return <EmptyState message="This course has no files yet." />;
  }

  return (
    <div className="space-y-3">
      {error ? <ErrorState message={error} /> : null}
      <div className="divide-y divide-border border-t border-border">
        {materials.map((material) => (
          <div key={material.id} className="space-y-2 py-3">
            <h3 className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">
              {material.fileName}
            </h3>
            <MetaList stacked>
              <MetaItem label="Type" value={material.mimeType} />
              <MetaItem label="Size" value={materialSizeLabel(material.byteSize)} />
            </MetaList>
            <Button
              type="button"
              variant="outline"
              disabled={downloadingId === material.id}
              onClick={() => void download(material)}
            >
              {downloadingId === material.id ? "Downloading…" : "Download"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
