"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type AnyExtension, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Palette,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isRichHtml, RICH_CONTENT_CLASS } from "@/lib/rich-text";

export const TUTORIAL_DESCRIPTION_MAX = 10_000;

type TutorialDescriptionEditorProps = {
  value: string;
  onChange: (html: string, text: string) => void;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Legacy descriptions are plain text; load them as paragraphs. */
function toEditorContent(value: string): string {
  if (!value) return "";
  if (isRichHtml(value)) return value;
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function TutorialDescriptionEditor({ value, onChange }: TutorialDescriptionEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      // extension-image is pinned to a nested @tiptap/core copy, so its types differ.
      Image.configure({ inline: false, allowBase64: false }) as unknown as AnyExtension,
    ],
    content: toEditorContent(value),
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: cn("min-h-[180px] px-3 py-2 text-foreground outline-none", RICH_CONTENT_CLASS),
      },
    },
    onUpdate: ({ editor: ed }) => {
      const text = ed.getText();
      if (text.length > TUTORIAL_DESCRIPTION_MAX) return;
      onChange(ed.isEmpty ? "" : ed.getHTML(), text);
    },
  });

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const next = toEditorContent(value);
    if (next !== editor.getHTML()) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  const textLen = editor?.getText().length ?? 0;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card focus-within:border-[var(--theme-primary)] focus-within:ring-2 focus-within:ring-[var(--theme-primary)]/15">
      <Toolbar editor={editor} />
      <div className="max-h-[360px] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
      <div className="border-t border-border px-3 py-1.5 text-right text-xs text-muted-foreground">
        {textLen} / {TUTORIAL_DESCRIPTION_MAX}
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function chain() {
    return editor!.chain().focus();
  }

  function toggleLink() {
    if (!editor) return;
    if (editor.isActive("link")) {
      chain().unsetLink().run();
      return;
    }
    const href = window.prompt("Enter URL");
    if (!href) return;
    chain().extendMarkRange("link").setLink({ href }).run();
  }

  async function uploadImage(file: File | null) {
    if (!file || !editor) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/v1/builder/assets", { method: "POST", body });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error?.message ?? "Upload failed");
      const url = payload?.data?.url as string | undefined;
      if (!url) throw new Error("Upload failed");
      chain().insertContent({ type: "image", attrs: { src: url } }).run();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const disabled = !editor;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/50 px-2 py-1.5">
      <ToolbarBtn label="Heading 2" disabled={disabled} active={editor?.isActive("heading", { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn label="Heading 3" disabled={disabled} active={editor?.isActive("heading", { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <Divider />
      <ToolbarBtn label="Bold" disabled={disabled} active={editor?.isActive("bold")} onClick={() => chain().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn label="Italic" disabled={disabled} active={editor?.isActive("italic")} onClick={() => chain().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn label="Underline" disabled={disabled} active={editor?.isActive("underline")} onClick={() => chain().toggleUnderline().run()}>
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn label="Strikethrough" disabled={disabled} active={editor?.isActive("strike")} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ColorBtn
        label="Text color"
        disabled={disabled}
        icon={<Palette className="h-3.5 w-3.5" />}
        onPick={(color) => chain().setColor(color).run()}
      />
      <ColorBtn
        label="Highlight"
        disabled={disabled}
        defaultColor="#fef08a"
        icon={<Highlighter className="h-3.5 w-3.5" />}
        onPick={(color) => chain().setHighlight({ color }).run()}
      />
      <ToolbarBtn label="Clear formatting" disabled={disabled} onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        <RemoveFormatting className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <Divider />
      <ToolbarBtn label="Bullet list" disabled={disabled} active={editor?.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()}>
        <List className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn label="Numbered list" disabled={disabled} active={editor?.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn label="Quote" disabled={disabled} active={editor?.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()}>
        <Quote className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <Divider />
      <ToolbarBtn label="Align left" disabled={disabled} active={editor?.isActive({ textAlign: "left" })} onClick={() => chain().setTextAlign("left").run()}>
        <AlignLeft className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn label="Align center" disabled={disabled} active={editor?.isActive({ textAlign: "center" })} onClick={() => chain().setTextAlign("center").run()}>
        <AlignCenter className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn label="Align right" disabled={disabled} active={editor?.isActive({ textAlign: "right" })} onClick={() => chain().setTextAlign("right").run()}>
        <AlignRight className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <Divider />
      <ToolbarBtn label="Link" disabled={disabled} active={editor?.isActive("link")} onClick={toggleLink}>
        <Link2 className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn label="Image" disabled={disabled || uploading} onClick={() => fileRef.current?.click()}>
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
      </ToolbarBtn>
      <ToolbarBtn label="Divider line" disabled={disabled} onClick={() => chain().setHorizontalRule().run()}>
        <Minus className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <Divider />
      <ToolbarBtn label="Undo" disabled={disabled || !editor?.can().undo()} onClick={() => chain().undo().run()}>
        <Undo2 className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn label="Redo" disabled={disabled || !editor?.can().redo()} onClick={() => chain().redo().run()}>
        <Redo2 className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => uploadImage(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

function ColorBtn({
  label,
  icon,
  disabled,
  defaultColor = "#4F46F5",
  onPick,
}: {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  defaultColor?: string;
  onPick: (color: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <span className="relative inline-flex">
      <ToolbarBtn label={label} disabled={disabled} onClick={() => inputRef.current?.click()}>
        {icon}
      </ToolbarBtn>
      <input
        ref={inputRef}
        type="color"
        defaultValue={defaultColor}
        aria-label={label}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        onChange={(e) => onPick(e.target.value)}
      />
    </span>
  );
}

function ToolbarBtn({
  children,
  label,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-background text-[var(--theme-primary)] shadow-sm",
      )}
    >
      {children}
    </button>
  );
}
