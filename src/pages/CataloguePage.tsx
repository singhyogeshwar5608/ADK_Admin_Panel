import { catalogueApi } from "@/api/catalogue";
import type { CatalogueRow } from "@/types/catalogue";
import { parseApiError } from "@/utils/parseApiError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Loader2, Plus, Upload } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { toast } from "sonner";

function mapRawToRow(e: Record<string, unknown>): CatalogueRow {
  const pick = (camel: string, snake: string) =>
    (e[camel] !== undefined ? e[camel] : e[snake]) as unknown;

  return {
    id: Number(e.id ?? 0),
    title: String(e.title ?? "Untitled Page"),
    imageUrl: String(pick("imageUrl", "image_url") ?? ""),
    imagePath: String(pick("imagePath", "image_path") ?? ""),
    orderIndex: Number(pick("orderIndex", "order_index") ?? 0),
    isActive: Boolean(pick("isActive", "is_active") ?? true),
    publishedAt: (pick("publishedAt", "published_at") as string | null) ?? null,
    createdAt: (pick("createdAt", "created_at") as string | null) ?? undefined,
    updatedAt: (pick("updatedAt", "updated_at") as string | null) ?? undefined,
  };
}

const dateIn = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

function formatUpdated(value: string | null | undefined): string {
  if (!value) return "recently";
  try {
    return dateIn.format(new Date(value));
  } catch {
    return "recently";
  }
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-500/90 text-white shadow-sm dark:bg-emerald-400/90 dark:text-slate-950"
          : "bg-white/25 text-white backdrop-blur-sm dark:bg-slate-900/50"
      }`}
    >
      {!active && (
        <span className="h-2 w-2 rounded-full bg-white/80 dark:bg-slate-400" aria-hidden />
      )}
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function moveItem(list: CatalogueRow[], dragId: number, overId: number): CatalogueRow[] {
  const i = list.findIndex((x) => x.id === dragId);
  const j = list.findIndex((x) => x.id === overId);
  if (i < 0 || j < 0 || i === j) return list;
  const next = [...list];
  const [item] = next.splice(i, 1);
  next.splice(j, 0, item);
  return next;
}

export function CataloguePage() {
  const qc = useQueryClient();
  const formSectionRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState("");
  const [activeInApp, setActiveInApp] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["catalogue", { page: 1, limit: 40, scope: "all" }],
    queryFn: async () => {
      const { data } = await catalogueApi.list({ page: 1, limit: 40, isActive: "all" });
      return data;
    },
  });

  const rowsRaw = useMemo(() => {
    const payload = q.data;
    if (!payload || typeof payload !== "object") return [];
    const d = (payload as Record<string, unknown>).data;
    return Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
  }, [q.data]);

  const pagesFromServer = useMemo(() => {
    const mapped = rowsRaw.map(mapRawToRow);
    return [...mapped].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [rowsRaw]);

  const [ordered, setOrdered] = useState<CatalogueRow[]>([]);

  useEffect(() => {
    setOrdered(pagesFromServer);
  }, [pagesFromServer]);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    return () => {
      if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
    };
  }, []);

  const persistReorder = useMutation({
    mutationFn: async (list: CatalogueRow[]) => {
      await catalogueApi.reorder({
        order: list.map((page, idx) => ({ id: page.id, orderIndex: idx + 1 })),
      });
    },
    onSuccess: async () => {
      toast.success("Order synced");
      await qc.invalidateQueries({ queryKey: ["catalogue"] });
    },
    onError: (err) => {
      toast.error(parseApiError(err));
      void qc.invalidateQueries({ queryKey: ["catalogue"] });
    },
  });

  const createMut = useMutation({
    mutationFn: (vars: { title: string; image: File; isActive: boolean }) => {
      const fd = new FormData();
      fd.append("title", vars.title);
      fd.append("is_active", vars.isActive ? "1" : "0");
      fd.append("published_at", "");
      fd.append("image", vars.image);
      return catalogueApi.create(fd);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["catalogue"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => catalogueApi.delete(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["catalogue"] });
    },
  });

  const scrollToForm = useCallback(() => {
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const input = formSectionRef.current?.querySelector<HTMLInputElement>(
      'input[name="catalogue-title"]',
    );
    window.setTimeout(() => input?.focus({ preventScroll: true }), 300);
  }, []);

  const scheduleReorder = useCallback(
    (next: CatalogueRow[]) => {
      setOrdered(next);
      if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
      reorderTimerRef.current = setTimeout(() => {
        void persistReorder.mutateAsync(next);
      }, 400);
    },
    [persistReorder],
  );

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f && f.type.startsWith("image/")) setImageFile(f);
  };

  const onDropZone = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onFiles(e.dataTransfer.files);
  };

  const onDragOverZone = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      toast.error("Please select an image");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    try {
      await createMut.mutateAsync({ title: title.trim(), image: imageFile, isActive: activeInApp });
      toast.success("Catalogue page added");
      setTitle("");
      setImageFile(null);
      setActiveInApp(true);
      await q.refetch();
    } catch (err) {
      toast.error(parseApiError(err));
    }
  };

  const onDelete = async (id: number, label: string) => {
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Catalogue page deleted");
      await q.refetch();
    } catch (err) {
      toast.error(parseApiError(err));
    }
  };

  const handleCardDrop = (dragId: number, overId: number) => {
    if (dragId === overId) return;
    const next = moveItem(ordered, dragId, overId);
    scheduleReorder(next);
  };

  return (
    <div className="space-y-8">
      <header className="rounded-3xl bg-white p-6 shadow-sm dark:border dark:border-white/5 dark:bg-slate-950">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Catalogue</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Product Catalogue Management
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage flip-book pages used by the Flutter app.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={scrollToForm}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg dark:bg-white dark:text-slate-900"
            >
              <Plus size={16} strokeWidth={2.5} />
              Add Page
            </button>
          </div>
        </div>
      </header>

      <section
        ref={formSectionRef}
        id="catalogue-add-form"
        className="rounded-3xl bg-white p-6 shadow-sm dark:border dark:border-white/5 dark:bg-slate-950"
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-white">Add New Page</h2>
        <form
          onSubmit={(e) => void onSubmitForm(e)}
          className="grid gap-6 lg:grid-cols-[2fr,3fr]"
        >
          <label
            onDrop={onDropZone}
            onDragOver={onDragOverZone}
            className="flex min-h-[240px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500 transition hover:border-slate-400 hover:bg-slate-50/80 dark:border-white/20 dark:text-slate-400 dark:hover:bg-white/5"
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                className="h-48 w-full rounded-2xl object-cover"
              />
            ) : (
              <>
                <Upload size={28} className="text-slate-400" strokeWidth={1.5} />
                <span className="text-sm">Drop an image or click to browse</span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>

          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300">
              Title
              <input
                type="text"
                name="catalogue-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                placeholder="E.g. Winter Lookbook"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={activeInApp}
                onChange={(e) => setActiveInApp(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 dark:border-white/30 dark:bg-slate-950 dark:focus:ring-white"
              />
              Active in app
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setTitle("");
                  setImageFile(null);
                  setActiveInApp(true);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={createMut.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
              >
                {createMut.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} strokeWidth={2.5} />
                )}
                Publish Page
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm dark:border dark:border-white/5 dark:bg-slate-950">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Catalogue Pages</h2>
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Drag &amp; Drop</span>
        </div>

        {q.isLoading && (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading catalogue…
          </div>
        )}

        {q.isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 dark:border-red-400/40 dark:bg-red-950/40 dark:text-red-300">
            Failed to load catalogue.{" "}
            <button
              type="button"
              onClick={() => void q.refetch()}
              className="font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {!q.isLoading && !q.isError && ordered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            No pages yet. Add your first catalogue page.
          </div>
        )}

        {!q.isLoading && !q.isError && ordered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {ordered.map((page, ae) => (
              <article
                key={page.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", String(page.id));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = Number(e.dataTransfer.getData("text/plain"));
                  handleCardDrop(fromId, page.id);
                }}
                className="group cursor-grab overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm active:cursor-grabbing dark:border-white/10 dark:bg-slate-900"
              >
                <div className="relative h-52 overflow-hidden">
                  <img
                    src={page.imageUrl}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="pointer-events-none absolute inset-x-0 top-4 flex items-center justify-between px-4 text-xs font-semibold text-white drop-shadow">
                    <span className="inline-flex items-center rounded-full bg-black/35 px-3 py-1 font-mono tabular-nums backdrop-blur-sm">
                      #{ae + 1}
                    </span>
                    <StatusBadge active={page.isActive} />
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent px-4 pb-4 pt-16">
                    <p className="line-clamp-2 text-base font-semibold text-white">{page.title}</p>
                    <p className="text-xs text-white/75">
                      Updated {formatUpdated(page.updatedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-slate-400">
                    <GripVertical className="h-3.5 w-3.5" aria-hidden />
                    Drag to reorder
                  </span>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      void onDelete(page.id, page.title);
                    }}
                    disabled={deleteMut.isPending}
                    className="rounded-full px-3 py-1 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
