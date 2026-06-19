import { Download, Eye, FileCheck2, RefreshCw } from "lucide-react";

const auditItems = [
  {
    icon: Eye,
    title: "Documento visualizado",
    description: "Fabian N. acessou os detalhes da NF-e.",
    date: "18 jun 2026, 13:18",
  },
  {
    icon: RefreshCw,
    title: "XML processado",
    description: "docZip decodificado, hash SHA-256 validado e metadados indexados.",
    date: "18 jun 2026, 12:04",
  },
  {
    icon: Download,
    title: "XML armazenado",
    description: "Arquivo original preservado no storage versionado.",
    date: "18 jun 2026, 12:04",
  },
  {
    icon: FileCheck2,
    title: "Documento localizado",
    description: "Retornado pela Distribuição DF-e com cStat 138.",
    date: "18 jun 2026, 12:03",
  },
];

export function AuditTimeline() {
  return (
    <div className="space-y-0">
      {auditItems.map(({ icon: Icon, title, description, date }, index) => (
        <div key={title} className="relative flex gap-4 pb-6 last:pb-0">
          {index < auditItems.length - 1 && (
            <span className="absolute left-5 top-10 h-[calc(100%-1.25rem)] w-px bg-line" />
          )}
          <div className="z-10 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
            <Icon className="h-4 w-4" />
          </div>
          <div className="pt-0.5">
            <p className="text-xs font-extrabold">{title}</p>
            <p className="mt-1 text-[10px] leading-4 text-subtle">{description}</p>
            <p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-subtle/60">
              {date}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

