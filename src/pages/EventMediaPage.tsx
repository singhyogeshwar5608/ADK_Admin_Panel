import { eventMediaApi } from "@/api/eventMedia";
import { LoadingScreen } from "@/components/LoadingScreen";
import { parseApiError } from "@/utils/parseApiError";
import {
  formatMediaDate,
  type EventMediaRow,
  isVideoRow,
  parseEventMediaListPayload,
} from "@/utils/eventMediaFields";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  ExternalLink,
  Eye,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type MediaTab = "all" | "image" | "video";
type StatusFilter = "all" | "active" | "inactive";
type SortKey = "recent" | "oldest";

const PER_PAGE_OPTIONS = [12, 24, 36];
const ACCEPT_UPLOAD = "image/jpeg,image/png,image/webp,video/mp4,video/webm";
const ACCEPT_SET = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);
const MAX_FILE_MB = 25;
/** Laravel `EventMediaUploadRequest` expects `files` (array), max 10 per request. */
const UPLOAD_FILES_FIELD = "files[]";
const MAX_FILES_PER_UPLOAD = 10;

function parseTime(iso?: string): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** Each item returned from `POST /event-media/upload` (files stored; DB row needs `POST /event-media`). */
type UploadApiFile = {
  url: string;
  mimeType?: string;
  bytes?: number;
  name?: string;
  mediaType?: string;
};

function parseUploadResponse(res: unknown): UploadApiFile[] {
  if (!res || typeof res !== "object") return [];
  const files = (res as Record<string, unknown>).files;
  if (!Array.isArray(files)) return [];
  return files
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const url = typeof o.url === "string" ? o.url : "";
      if (!url) return null;
      return {
        url,
        mimeType:
          typeof o.mimeType === "string"
            ? o.mimeType
            : typeof o.mime_type === "string"
              ? o.mime_type
              : undefined,
        bytes: typeof o.bytes === "number" ? o.bytes : typeof o.size === "number" ? o.size : undefined,
        name: typeof o.name === "string" ? o.name : undefined,
        mediaType:
          typeof o.mediaType === "string"
            ? o.mediaType
            : typeof o.media_type === "string"
              ? o.media_type
              : "IMAGE",
      };
    })
    .filter(Boolean) as UploadApiFile[];
}

function titleFromUpload(it: UploadApiFile): string {
  const raw = (it.name || "Untitled").trim() || "Untitled";
  return raw.length > 150 ? `${raw.slice(0, 147)}…` : raw;
}

export function EventMediaPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<MediaTab>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [dragOver, setDragOver] = useState(false);
  const [previewRow, setPreviewRow] = useState<EventMediaRow | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["event-media"],
    queryFn: async () => {
      try {
        return (await eventMediaApi.list({ limit: 500 })).data;
      } catch {
        const { data } = await eventMediaApi.list();
        return data;
      }
    },
  });

  const { rows: apiRows } = useMemo(() => parseEventMediaListPayload(q.data ?? null), [q.data]);

  const del = useMutation({
    mutationFn: (id: string | number) => eventMediaApi.delete(id),
    onSuccess: () => {
      toast.success("Deleted");
      void qc.invalidateQueries({ queryKey: ["event-media"] });
      setSelectedId(null);
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const mb = file.size / (1024 * 1024);
        if (mb > MAX_FILE_MB) {
          throw new Error(`${file.name} exceeds ${MAX_FILE_MB} MB`);
        }
      }
      let createdCount = 0;
      const createErrors: string[] = [];

      for (let i = 0; i < files.length; i += MAX_FILES_PER_UPLOAD) {
        const slice = files.slice(i, i + MAX_FILES_PER_UPLOAD);
        const fd = new FormData();
        for (const file of slice) {
          fd.append(UPLOAD_FILES_FIELD, file);
        }
        const { data } = await eventMediaApi.upload(fd);
        const uploads = parseUploadResponse(data);
        if (!uploads.length) {
          createErrors.push("Upload succeeded but returned no files");
          continue;
        }
        for (const u of uploads) {
          const mt = String(u.mediaType || "IMAGE").toUpperCase();
          const mediaType = mt === "VIDEO" ? "VIDEO" : "IMAGE";
          try {
            await eventMediaApi.create({
              title: titleFromUpload(u),
              mediaType,
              fileUrl: u.url,
              mime_type: u.mimeType,
              fileSize: u.bytes,
              isActive: true,
            });
            createdCount += 1;
          } catch (e) {
            createErrors.push(parseApiError(e));
          }
        }
      }

      if (createdCount === 0 && createErrors.length > 0) {
        throw new Error(createErrors[0]);
      }
      if (createErrors.length > 0) {
        toast.error(createErrors[0] ?? "Some uploads could not be saved");
      }
      return { createdCount };
    },
    onSuccess: async (result) => {
      const n = result.createdCount;
      toast.success(n === 1 ? "Media uploaded and added to gallery" : `${n} items added to gallery`);
      await qc.invalidateQueries({ queryKey: ["event-media"] });
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const allCount = apiRows.length;
  const imageCount = useMemo(() => apiRows.filter((r) => !isVideoRow(r)).length, [apiRows]);
  const videoCount = useMemo(() => apiRows.filter((r) => isVideoRow(r)).length, [apiRows]);

  const filtered = useMemo(() => {
    let list = [...apiRows];
    if (tab === "image") list = list.filter((r) => !isVideoRow(r));
    if (tab === "video") list = list.filter((r) => isVideoRow(r));
    const qx = search.trim().toLowerCase();
    if (qx) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(qx) ||
          (r.caption && r.caption.toLowerCase().includes(qx)),
      );
    }
    if (statusFilter === "active") list = list.filter((r) => r.isActive);
    if (statusFilter === "inactive") list = list.filter((r) => !r.isActive);
    list.sort((a, b) =>
      sortKey === "recent"
        ? parseTime(b.uploadedAt) - parseTime(a.uploadedAt)
        : parseTime(a.uploadedAt) - parseTime(b.uploadedAt),
    );
    return list;
  }, [apiRows, tab, search, statusFilter, sortKey]);

  const totalFiltered = filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / limit));

  useEffect(() => {
    setPage(1);
  }, [tab, search, statusFilter, sortKey]);

  useEffect(() => {
    setPage((p) => Math.min(p, pageCount));
  }, [pageCount]);

  const currentPage = Math.min(Math.max(1, page), pageCount);
  const pageItems = filtered.slice((currentPage - 1) * limit, currentPage * limit);

  const onPickFiles = useCallback(() => fileInputRef.current?.click(), []);
  const uploadFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (!list?.length) return;
      const files = Array.from(list).filter((f) => {
        if (!ACCEPT_SET.has(f.type)) {
          toast.error(`${f.name}: use JPEG, PNG, WEBP, MP4, or WEBM`);
          return false;
        }
        return true;
      });
      if (!files.length) return;
      uploadMutation.mutate(files);
    },
    [uploadMutation],
  );

  const onDelete = (r: EventMediaRow) => {
    if (!window.confirm(`Delete “${r.title}”?`)) return;
    del.mutate(r.id);
  };

  if (q.isLoading && !q.data) return <LoadingScreen message="Loading event media…" />;

  if (q.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-6 dark:border-rose-400/30 dark:bg-slate-950">
        <p className="mb-4 font-semibold text-rose-600">Unable to load event media.</p>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const tabCls = (t: MediaTab) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition ${
      tab === t
        ? "bg-primary/15 text-primary dark:bg-primary/25"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
    }`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">Events</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Event Media Gallery
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Upload and curate imagery &amp; video assets.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void q.refetch()}
          disabled={q.isFetching}
          className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
        >
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Upload zone */}
      <div
        role="presentation"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          uploadFiles(e.dataTransfer.files);
        }}
        className={`rounded-3xl border-2 border-dashed bg-white p-10 text-center shadow-sm transition dark:bg-slate-950 ${
          dragOver ? "border-primary bg-primary/5 dark:border-primary dark:bg-primary/10" : "border-slate-200 dark:border-white/10"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_UPLOAD}
          multiple
          className="sr-only"
          onChange={(e) => uploadFiles(e.target.files)}
        />
        <div className="mx-auto flex max-w-lg flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CloudUpload className="h-7 w-7" strokeWidth={1.5} />
          </div>
          <p className="text-base font-semibold text-slate-900 dark:text-white">Drag &amp; drop files here</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Supported formats: JPEG, PNG, WEBP, MP4, WEBM. Max size {MAX_FILE_MB} MB per file.
          </p>
          <button
            type="button"
            onClick={onPickFiles}
            disabled={uploadMutation.isPending}
            className="mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-95 disabled:opacity-50"
          >
            Select files
          </button>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Images &amp; videos up to {MAX_FILE_MB}MB each.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-slate-950 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={tabCls("all")} onClick={() => setTab("all")}>
            All media ({allCount})
          </button>
          <button type="button" className={tabCls("image")} onClick={() => setTab("image")}>
            Images ({imageCount})
          </button>
          <button type="button" className={tabCls("video")} onClick={() => setTab("video")}>
            Videos ({videoCount})
          </button>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="relative min-w-[200px] flex-1 lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search by title or caption"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-sm outline-none ring-primary/0 focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white"
          >
            <option value="recent">Recently added</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {pageItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center text-slate-500 shadow-sm dark:border-white/5 dark:bg-slate-950">
          No media matches your filters.
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((r) => {
            const idStr = String(r.id);
            const video = isVideoRow(r);
            const selected = selectedId === idStr;
            return (
              <li
                key={idStr}
                className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/5 dark:bg-slate-950"
              >
                <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-900">
                  {video ? (
                    <video
                      src={r.fileUrl}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img src={r.fileUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                  <button
                    type="button"
                    aria-label="Select media"
                    onClick={() => setSelectedId((cur) => (cur === idStr ? null : idStr))}
                    className={`absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white/90 shadow dark:bg-slate-900/90 ${
                      selected ? "border-primary" : "border-slate-300 dark:border-white/30"
                    }`}
                  >
                    {selected ? <span className="h-3 w-3 rounded-full bg-primary" /> : null}
                  </button>
                  <span className="absolute bottom-2 left-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow bg-slate-900/80">
                    {video ? "Video" : "Image"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewRow(r)}
                    className="absolute bottom-2 right-2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 shadow dark:bg-slate-900 dark:text-white"
                  >
                    Preview
                  </button>
                </div>
                <div className="space-y-1 border-t border-slate-100 p-3 dark:border-white/5">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{r.title}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {formatMediaDate(r.uploadedAt)}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setPreviewRow(r)}
                      className="inline-flex flex-1 min-w-[6rem] items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(r)}
                      disabled={del.isPending}
                      className="inline-flex flex-1 min-w-[6rem] items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-white/5 dark:bg-slate-950 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Showing</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
        </div>
        <div className="font-medium tabular-nums">
          {currentPage} / {pageCount} pages · {totalFiltered} items
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            type="button"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Compact preview dialog (View / Preview on card) */}
      {previewRow ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Media preview"
          onClick={() => setPreviewRow(null)}
        >
          <div
            className="flex max-h-[min(88vh,640px)] w-full max-w-[min(100%,420px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950 sm:max-w-[480px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/10">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{previewRow.title}</p>
                {previewRow.caption ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{previewRow.caption}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                onClick={() => setPreviewRow(null)}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-3 dark:bg-slate-900/80">
              <div className="flex items-center justify-center">
                {isVideoRow(previewRow) ? (
                  <video
                    src={previewRow.fileUrl}
                    controls
                    playsInline
                    className="max-h-[38vh] w-full max-w-full rounded-lg object-contain sm:max-h-[320px]"
                  />
                ) : (
                  <img
                    src={previewRow.fileUrl}
                    alt=""
                    className="max-h-[38vh] w-full max-w-full rounded-lg object-contain sm:max-h-[320px]"
                  />
                )}
              </div>
            </div>
            <div className="shrink-0 border-t border-slate-100 px-3 py-2.5 dark:border-white/10">
              <a
                href={previewRow.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:underline dark:text-sky-400"
                onClick={(e) => e.stopPropagation()}
              >
                Open in new tab <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
