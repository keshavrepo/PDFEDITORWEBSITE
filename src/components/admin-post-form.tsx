"use client";

import {
  type DragEvent as ReactDragEvent,
  FormEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Bold,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
} from "lucide-react";
import { BlogImageUpload } from "@/components/blog-image-upload";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSlug } from "@/lib/blog";
import { uploadBlogImage } from "@/lib/upload-blog-image";

export interface EditablePost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage: string | null;
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  category: string | null;
  tags: string[];
}

interface AdminPostFormProps {
  post?: EditablePost;
  categories: string[];
}

const textareaClass =
  "flex min-h-[110px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function AdminPostForm({ post, categories }: AdminPostFormProps) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const editorImageInputRef = useRef<HTMLInputElement>(null);
  const editorSelectionRef = useRef<Range | null>(null);
  const [title, setTitle] = useState(post?.title || "");
  const [slug, setSlug] = useState(post?.slug || "");
  const [slugEdited, setSlugEdited] = useState(Boolean(post));
  const [featuredImage, setFeaturedImage] = useState(post?.featuredImage || "");
  const [status, setStatus] = useState(post?.status || "draft");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editorImageUploading, setEditorImageUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function format(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  function addLink() {
    const href = window.prompt("Enter an https:// URL");
    if (href?.startsWith("https://") || href?.startsWith("http://")) {
      format("createLink", href);
    }
  }

  function openEditorImagePicker() {
    const selection = window.getSelection();
    if (
      selection?.rangeCount &&
      editorRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      editorSelectionRef.current = selection.getRangeAt(0).cloneRange();
    } else {
      editorSelectionRef.current = null;
    }
    editorImageInputRef.current?.click();
  }

  async function addEditorImage(file?: File) {
    if (!file) return;
    setEditorImageUploading(true);
    setError(null);
    try {
      const uploaded = await uploadBlogImage(file, "content");
      editorRef.current?.focus();
      const selection = window.getSelection();
      if (selection && editorSelectionRef.current) {
        selection.removeAllRanges();
        selection.addRange(editorSelectionRef.current);
      }
      if (!document.execCommand("insertImage", false, uploaded.url) && editorRef.current) {
        const image = document.createElement("img");
        image.src = uploaded.url;
        image.alt = "";
        editorRef.current.append(image);
      }
      editorSelectionRef.current = null;
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Unable to upload editor image"
      );
    } finally {
      setEditorImageUploading(false);
      if (editorImageInputRef.current) editorImageInputRef.current.value = "";
    }
  }

  function handleEditorDrop(event: ReactDragEvent<HTMLDivElement>) {
    const file = Array.from(event.dataTransfer.files).find((item) =>
      item.type.startsWith("image/")
    );
    if (!file) return;
    event.preventDefault();
    editorSelectionRef.current = null;
    void addEditorImage(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editorImageUploading) {
      setError("Wait for the editor image upload to finish");
      return;
    }
    setBusy(true);
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch(
        post ? `/api/admin/posts/${post.id}` : "/api/admin/posts",
        {
          method: post ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            slug,
            excerpt: data.get("excerpt"),
            content: editorRef.current?.innerHTML || "",
            featuredImage,
            category: data.get("category"),
            tags: data.get("tags"),
            status,
            seoTitle: data.get("seoTitle"),
            seoDescription: data.get("seoDescription"),
            seoKeywords: data.get("seoKeywords"),
          }),
        }
      );
      const result = (await response.json()) as {
        error?: string;
        post?: { id: string };
      };
      if (!response.ok) throw new Error(result.error || "Unable to save post");
      router.push("/admin/posts");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save post");
      setBusy(false);
    }
  }

  async function deletePost() {
    if (!post || !window.confirm("Permanently delete this post?")) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/posts/${post.id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to delete post");
      router.push("/admin/posts");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete post");
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="title" className="text-sm font-medium">Title</label>
            <Input
              id="title"
              value={title}
              onChange={(event) => {
                const value = event.target.value;
                setTitle(value);
                if (!slugEdited) setSlug(createSlug(value));
              }}
              minLength={3}
              maxLength={200}
              required
              disabled={busy}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="slug" className="text-sm font-medium">Slug</label>
            <Input
              id="slug"
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(createSlug(event.target.value));
              }}
              pattern="[a-z0-9-]+"
              required
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">Public URL: /blog/{slug || "post-slug"}</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="excerpt" className="text-sm font-medium">Excerpt</label>
            <textarea id="excerpt" name="excerpt" className={textareaClass} defaultValue={post?.excerpt} minLength={20} maxLength={600} required disabled={busy} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium">Content</label>
            <div className="rounded-lg border border-input overflow-hidden">
              <div className="flex flex-wrap gap-1 border-b bg-muted/30 p-2">
                <Button type="button" variant="ghost" size="icon" onClick={() => format("bold")} aria-label="Bold"><Bold className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => format("italic")} aria-label="Italic"><Italic className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => format("insertUnorderedList")} aria-label="Bulleted list"><List className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => format("insertOrderedList")} aria-label="Numbered list"><ListOrdered className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={addLink} aria-label="Add link"><LinkIcon className="h-4 w-4" /></Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={openEditorImagePicker}
                  disabled={editorImageUploading || busy}
                  aria-label="Upload and insert image"
                >
                  {editorImageUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                </Button>
                <input
                  ref={editorImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => void addEditorImage(event.target.files?.[0])}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => format("formatBlock", "h2")}>Heading</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => format("formatBlock", "p")}>Paragraph</Button>
              </div>
              <div
                ref={editorRef}
                contentEditable={!busy}
                suppressContentEditableWarning
                onDragOver={(event) => {
                  if (Array.from(event.dataTransfer.items).some((item) => item.type.startsWith("image/"))) {
                    event.preventDefault();
                  }
                }}
                onDrop={handleEditorDrop}
                className="min-h-[320px] p-4 text-sm leading-7 focus:outline-none [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:my-4 [&_h3]:text-xl [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_img]:my-5 [&_img]:aspect-video [&_img]:w-full [&_img]:rounded-xl [&_img]:object-cover"
                dangerouslySetInnerHTML={{ __html: post?.content || "" }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Use the image button or drop a JPEG, PNG, or WebP into the editor. Images are optimized before insertion.
            </p>
          </div>

          <div className="sm:col-span-2">
            <BlogImageUpload
              value={featuredImage}
              onChange={setFeaturedImage}
              purpose="featured"
              label="Featured image"
              disabled={busy || deleting}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="category" className="text-sm font-medium">Category</label>
            <Input id="category" name="category" list="blog-categories" defaultValue={post?.category || ""} maxLength={100} disabled={busy} />
            <datalist id="blog-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
          </div>
          <div className="space-y-2">
            <label htmlFor="tags" className="text-sm font-medium">Tags</label>
            <Input id="tags" name="tags" defaultValue={post?.tags.join(", ")} placeholder="PDF, productivity, security" maxLength={720} disabled={busy} />
          </div>
          <div className="space-y-2">
            <label htmlFor="status" className="text-sm font-medium">Status</label>
            <select id="status" value={status} onChange={(event) => setStatus(event.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" disabled={busy}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-6 sm:p-8 space-y-5">
        <div><h2 className="text-xl font-semibold">Search appearance</h2><p className="text-sm text-muted-foreground">Optional SEO fields. The title and excerpt are used as fallbacks.</p></div>
        <div className="space-y-2"><label htmlFor="seoTitle" className="text-sm font-medium">SEO title</label><Input id="seoTitle" name="seoTitle" defaultValue={post?.seoTitle || ""} maxLength={200} disabled={busy} /></div>
        <div className="space-y-2"><label htmlFor="seoDescription" className="text-sm font-medium">SEO description</label><textarea id="seoDescription" name="seoDescription" className={textareaClass} defaultValue={post?.seoDescription || ""} maxLength={320} disabled={busy} /></div>
        <div className="space-y-2"><label htmlFor="seoKeywords" className="text-sm font-medium">SEO keywords</label><Input id="seoKeywords" name="seoKeywords" defaultValue={post?.seoKeywords || ""} placeholder="comma, separated, keywords" maxLength={500} disabled={busy} /></div>
      </Card>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex flex-wrap justify-between gap-3">
        <div>{post && <Button type="button" variant="destructive" onClick={deletePost} disabled={busy || deleting}>{deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete post</Button>}</div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/admin/posts")} disabled={busy}>Cancel</Button>
          <Button disabled={busy || deleting || editorImageUploading}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{post ? "Save changes" : "Create post"}</Button>
        </div>
      </div>
    </form>
  );
}
