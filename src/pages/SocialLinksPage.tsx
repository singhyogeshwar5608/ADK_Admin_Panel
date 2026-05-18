import { socialLinksApi, type SocialLink } from "@/api/socialLinks";
import { LoadingScreen } from "@/components/LoadingScreen";
import { parseApiError } from "@/utils/parseApiError";
import { Facebook, Instagram, Youtube, Save, Link2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function SocialLinksPage() {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLink, setNewLink] = useState({ platform: "youtube", url: "" });

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const { data } = await socialLinksApi.list();
      // Group by platform to ensure one row per platform
      const uniqueLinks: Record<string, SocialLink> = {};
      
      // Safety check: Ensure data.links exists before forEach
      const linksArray = Array.isArray(data?.links) ? data.links : [];
      
      linksArray.forEach(link => {
        uniqueLinks[link.platform] = link;
      });
      setLinks(Object.values(uniqueLinks));
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLinks();
  }, []);

  const handleUrlChange = (platform: string, url: string) => {
    setLinks((prev) =>
      prev.map((link) => (link.platform === platform ? { ...link, url } : link))
    );
  };

  const onSaveAll = async () => {
    setSaving(true);
    try {
      await socialLinksApi.update(links);
      toast.success("All links updated successfully");
      void fetchLinks();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const onAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.url.trim()) return;
    
    setSaving(true);
    try {
      await socialLinksApi.create(newLink.platform, newLink.url);
      toast.success("Link saved successfully");
      setShowAddModal(false);
      setNewLink({ platform: "youtube", url: "" });
      void fetchLinks();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this link?")) return;
    
    try {
      await socialLinksApi.delete(id);
      toast.success("Link deleted successfully");
      setLinks((prev) => prev.filter((link) => link.id !== id));
    } catch (e) {
      toast.error(parseApiError(e));
    }
  };

  if (loading) return <LoadingScreen />;

  const getIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "youtube":
        return <Youtube className="h-5 w-5 text-red-600" />;
      case "facebook":
        return <Facebook className="h-5 w-5 text-blue-600" />;
      case "instagram":
        return <Instagram className="h-5 w-5 text-pink-600" />;
      default:
        return <Link2 className="h-5 w-5 text-slate-400" />;
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Media Links</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Manage your social media presence. One link per platform.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add/Update Link
          </button>
          <button
            onClick={onSaveAll}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save All"}
          </button>
        </div>
      </div>

      <div className="grid gap-6">
        {links.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center dark:border-white/10">
            <Link2 className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">No links added yet. Click "Add Link" to get started.</p>
          </div>
        ) : (
          links.map((link) => (
            <div
              key={link.platform}
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-primary/30 hover:shadow-md dark:border-white/10 dark:bg-slate-950 dark:hover:border-primary/30"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 transition group-hover:bg-primary/5 dark:bg-white/5">
                  {getIcon(link.platform)}
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-sm font-bold capitalize text-slate-700 dark:text-slate-200">
                      {link.platform} URL
                    </label>
                    <button
                      onClick={() => link.id && onDelete(link.id)}
                      className="rounded-lg p-1.5 text-rose-500 opacity-0 transition hover:bg-rose-50 group-hover:opacity-100 dark:hover:bg-rose-500/10"
                      title="Delete link"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="url"
                      placeholder={`https://${link.platform}.com/your-profile`}
                      value={link.url}
                      onChange={(e) => handleUrlChange(link.platform, e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Link Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add/Update Link</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={onAddNew} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Platform
                </label>
                <select
                  value={newLink.platform}
                  onChange={(e) => setNewLink({ ...newLink, platform: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-primary dark:border-white/10 dark:bg-slate-900 dark:text-white"
                >
                  <option value="youtube">YouTube</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  URL
                </label>
                <input
                  required
                  type="url"
                  placeholder="https://..."
                  value={newLink.url}
                  onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-primary dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mt-8 rounded-2xl bg-amber-50 p-4 dark:bg-amber-900/20">
        <div className="flex gap-3">
          <Link2 className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Tip</p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
              Adding a link for a platform that already exists will update that platform's URL instead of creating a new row.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
