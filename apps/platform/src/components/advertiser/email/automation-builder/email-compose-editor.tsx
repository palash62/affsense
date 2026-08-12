"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontSize } from "@tiptap/extension-text-style/font-size";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { Extension } from "@tiptap/core";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Paperclip,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Tags,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export const EMAIL_MERGE_TAGS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "campaign_name",
  "company_name",
  "unsubscribe_url",
] as const;

const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
  { label: "System", value: "system-ui, sans-serif" },
] as const;

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"] as const;

const TEXT_COLORS = [
  "#0f172a",
  "#334155",
  "#64748b",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ffffff",
] as const;

const HIGHLIGHT_COLORS = [
  "#fef08a",
  "#bbf7d0",
  "#bfdbfe",
  "#fecaca",
  "#e9d5ff",
  "#fed7aa",
  "#e2e8f0",
] as const;

const FontFamily = Extension.create({
  name: "fontFamily",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element) =>
              (element as HTMLElement).style.fontFamily?.replace(/['"]+/g, "") || null,
            renderHTML: (attributes) => {
              if (!attributes.fontFamily) return {};
              return { style: `font-family: ${attributes.fontFamily}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontFamily:
        (fontFamily: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontFamily }).run(),
      unsetFontFamily:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontFamily: null }).run(),
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (fontFamily: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
    };
  }
}

type Props = {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  readOnly?: boolean;
};

function ToolbarBtn({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 disabled:opacity-40",
        active && "bg-slate-200 text-slate-900",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarSelect({
  value,
  title,
  options,
  onChange,
  className,
}: {
  value: string;
  title: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <select
      title={title}
      value={value}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-7 max-w-[110px] rounded-md border border-slate-200 bg-white px-1.5 text-[11px] text-slate-700 outline-none focus:border-slate-400",
        className,
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function ComposeToolbar({ editor }: { editor: Editor }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // TipTap command typings break across workspace duplicate @tiptap packages.
  const chain = () => (editor.chain() as any).focus();

  const currentFamily =
    (editor.getAttributes("textStyle").fontFamily as string | undefined) ||
    FONT_FAMILIES[0].value;
  const currentSize =
    (editor.getAttributes("textStyle").fontSize as string | undefined) || "16px";

  async function handleImageFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/v1/builder/assets", {
        method: "POST",
        body,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "Upload failed");
      }
      const uploadedUrl = payload?.data?.url as string | undefined;
      if (!uploadedUrl) throw new Error("Upload failed");
      chain().setImage({ src: uploadedUrl }).run();
      toast.success("Image added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/80 px-1.5 py-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex size-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100"
          title="Insert merge tag"
        >
          <Tags className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-64 min-w-44 overflow-y-auto">
          {EMAIL_MERGE_TAGS.map((tag) => (
            <DropdownMenuItem
              key={tag}
              onClick={() => chain().insertContent(`{{${tag}}}`).run()}
            >
              {`{{${tag}}}`}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="mx-1 h-4 w-px bg-slate-200" />

      <ToolbarBtn
        title="Undo"
        disabled={!editor.can().undo()}
        onClick={() => chain().undo().run()}
      >
        <Undo2 className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Redo"
        disabled={!editor.can().redo()}
        onClick={() => chain().redo().run()}
      >
        <Redo2 className="size-3.5" />
      </ToolbarBtn>

      <span className="mx-1 h-4 w-px bg-slate-200" />

      <ToolbarSelect
        title="Font family"
        value={currentFamily}
        className="max-w-[120px]"
        options={FONT_FAMILIES.map((f) => ({ label: f.label, value: f.value }))}
        onChange={(v) => chain().setFontFamily(v).run()}
      />
      <ToolbarSelect
        title="Font size"
        value={currentSize}
        className="max-w-[72px]"
        options={FONT_SIZES.map((s) => ({ label: s, value: s }))}
        onChange={(v) => chain().setFontSize(v).run()}
      />
      <ToolbarSelect
        title="Paragraph style"
        value={
          editor.isActive("heading", { level: 1 })
            ? "h1"
            : editor.isActive("heading", { level: 2 })
              ? "h2"
              : editor.isActive("heading", { level: 3 })
                ? "h3"
                : "p"
        }
        className="max-w-[90px]"
        options={[
          { label: "Paragraph", value: "p" },
          { label: "Heading 1", value: "h1" },
          { label: "Heading 2", value: "h2" },
          { label: "Heading 3", value: "h3" },
        ]}
        onChange={(v) => {
          if (v === "p") chain().setParagraph().run();
          else if (v === "h1") chain().toggleHeading({ level: 1 }).run();
          else if (v === "h2") chain().toggleHeading({ level: 2 }).run();
          else if (v === "h3") chain().toggleHeading({ level: 3 }).run();
        }}
      />

      <span className="mx-1 h-4 w-px bg-slate-200" />

      <ToolbarBtn
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => chain().toggleBold().run()}
      >
        <Bold className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => chain().toggleItalic().run()}
      >
        <Italic className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Underline"
        active={editor.isActive("underline")}
        onClick={() => chain().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => chain().toggleStrike().run()}
      >
        <Strikethrough className="size-3.5" />
      </ToolbarBtn>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex size-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100"
          title="Text color"
        >
          <span className="relative text-[11px] font-bold">
            A
            <span
              className="absolute right-0 -bottom-0.5 left-0 h-0.5 rounded"
              style={{
                backgroundColor:
                  (editor.getAttributes("textStyle").color as string | undefined) ||
                  "#0f172a",
              }}
            />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="grid w-auto grid-cols-6 gap-1 p-2">
          {TEXT_COLORS.map((c) => (
            <DropdownMenuItem
              key={c}
              className="size-6 justify-center rounded-md p-0"
              onClick={() => chain().setColor(c).run()}
            >
              <span
                className="size-4 rounded-full border border-slate-200"
                style={{ backgroundColor: c }}
              />
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            className="col-span-6 justify-center text-xs"
            onClick={() => chain().unsetColor().run()}
          >
            Reset color
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex size-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100"
          title="Highlight"
        >
          <Highlighter className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="grid w-auto grid-cols-4 gap-1 p-2">
          {HIGHLIGHT_COLORS.map((c) => (
            <DropdownMenuItem
              key={c}
              className="size-6 justify-center rounded-md p-0"
              onClick={() => chain().toggleHighlight({ color: c }).run()}
            >
              <span
                className="size-4 rounded-full border border-slate-200"
                style={{ backgroundColor: c }}
              />
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            className="col-span-4 justify-center text-xs"
            onClick={() => chain().unsetHighlight().run()}
          >
            Clear highlight
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="mx-1 h-4 w-px bg-slate-200" />

      <ToolbarBtn
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => chain().toggleBulletList().run()}
      >
        <List className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => chain().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => chain().toggleBlockquote().run()}
      >
        <Quote className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Horizontal rule"
        onClick={() => chain().setHorizontalRule().run()}
      >
        <Minus className="size-3.5" />
      </ToolbarBtn>

      <span className="mx-1 h-4 w-px bg-slate-200" />

      <ToolbarBtn
        title="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => chain().setTextAlign("left").run()}
      >
        <AlignLeft className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Align center"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => chain().setTextAlign("center").run()}
      >
        <AlignCenter className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => chain().setTextAlign("right").run()}
      >
        <AlignRight className="size-3.5" />
      </ToolbarBtn>

      <span className="mx-1 h-4 w-px bg-slate-200" />

      <ToolbarBtn
        title="Link"
        active={editor.isActive("link")}
        onClick={() => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("URL", prev ?? "https://");
          if (url === null) return;
          if (!url.trim()) {
            chain().extendMarkRange("link").unsetLink().run();
            return;
          }
          chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
        }}
      >
        <Link2 className="size-3.5" />
      </ToolbarBtn>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleImageFile(e.target.files?.[0] ?? null)}
      />
      <ToolbarBtn
        title={uploading ? "Uploading…" : "Attach image"}
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <ImageIcon className="size-3.5 animate-pulse" />
        ) : (
          <Paperclip className="size-3.5" />
        )}
      </ToolbarBtn>

      <ToolbarBtn
        title="Clear formatting"
        onClick={() => chain().unsetAllMarks().clearNodes().run()}
      >
        <RemoveFormatting className="size-3.5" />
      </ToolbarBtn>
    </div>
  );
}

function countText(html: string) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text ? text.split(/\s+/).length : 0;
  return { characters: text.length, words };
}

export function EmailComposeEditor({ value, onChange, className, readOnly = false }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      FontSize,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: value || "",
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[180px] px-3 py-2 outline-none focus:outline-none [&_img]:max-w-full [&_img]:rounded-md",
      },
    },
    onUpdate: ({ editor: ed }: { editor: Editor }) => {
      if (readOnly) return;
      onChange(ed.getHTML());
    },
  } as any);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  const counts = useMemo(() => countText(value || ""), [value]);

  if (!editor) {
    return (
      <div className={cn("rounded-lg border border-slate-200 bg-white", className)}>
        <div className="h-[220px] animate-pulse bg-slate-50" />
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-slate-200 bg-white", className)}>
      {!readOnly ? <ComposeToolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
      <div className="flex items-center justify-end border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-500">
        {counts.characters} characters · {counts.words} words
      </div>
    </div>
  );
}
