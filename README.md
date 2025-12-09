# Quick Context

Generate clean, LLM-ready markdown prompts from selected files and folders in VS Code.

Quick Context creates one or more `quick-context-N.md` documents containing, for each file:

1. File name  
   Relative path  

   (followed by the original file contents wrapped in a language-aware fenced code block when generated in VS Code)

You paste those documents directly into ChatGPT / other LLMs as “catch-up” context for new conversations.

---

## Features

### File & folder support

- Works on **files**, **folders**, or a **mixed selection** in the Explorer.
- Folders are processed **recursively**.
- Common build / meta directories are ignored:
  - `node_modules`, `.git`, `.next`, `dist`, `build`, `out`.

### Language-aware code fences

- Uses the file extension to choose the fenced code language:
  - `.ts` → `ts`
  - `.tsx` → `tsx`
  - `.js` / `.jsx` → `javascript` / `jsx`
  - `.json` → `json`
  - `.md` → `markdown`
  - `.css`, `.scss`, `.sass` → `css` / `scss`
  - `.html`, `.htm` → `html`
  - `.py` → `python`
  - `.rb` → `ruby`
  - `.php` → `php`
  - everything else → `text`

This makes the generated prompt much easier to read inside LLM UIs.

### Automatic splitting into multiple prompts

- Keeps each generated markdown document under a configurable character limit  
  (`INPUT_LIMIT_CHARS` in `src/extension.ts`, default ≈ 60 000 characters).
- When the combined content would exceed that limit, it:
  - Starts a new document.
  - Continues with the next file.
- **Never** splits a single file across documents.

Generated documents are named:

- `quick-context-1.md`
- `quick-context-2.md`
- `quick-context-3.md`
- …

### Safety guard on huge files

- If a **single file’s** markdown block (name + path + fenced code) would exceed
  the `INPUT_LIMIT_CHARS` limit **by itself**, the extension:
  - Aborts the operation.
  - Shows an error message indicating which file is too large.

This prevents you from accidentally trying to paste something that one LLM input cannot realistically handle.

---

## Usage

1. In the Explorer:
   - Select one or more **files**, **folders**, or both.
2. Right-click the selection.
3. Choose **Quick Context: Generate Catch-up Prompt**.
4. One or more tabs open:
   - `quick-context-1.md`
   - `quick-context-2.md`
   - …

Each document contains a numbered list of files with their relative paths and fenced contents, for example (conceptually):

    1. OrderForm.tsx
    src/components/OrderForm.tsx

        // full contents of OrderForm.tsx
        // (wrapped in a TSX code fence in the generated markdown)

You can now copy the contents of `quick-context-1.md` (and subsequent files) directly into your LLM chat.

If you have no selection in the Explorer but an active editor file, the command uses the currently open file.

---

## Command

- **Quick Context: Generate Catch-up Prompt**
  - Command ID: `quickContext.generateFromSelection`
  - Available from:
    - Explorer context menu (files and folders)
    - Editor context menu (active file, if nothing is selected in Explorer)

---

## Configuration (developer-side)

There is currently no user-facing settings UI.  
Two key constants live in `src/extension.ts`:

    // Soft limit per generated markdown document.
    // Used to keep each "prompt" under a typical ChatGPT input size.
    const INPUT_LIMIT_CHARS = 60000;

    // Directories ignored when recursing through folders.
    const IGNORE_DIRS = ["node_modules", ".git", ".next", "dist", "build", "out"];

If you fork or customize the extension, adjust these constants, rebuild, and republish.

---

## Limitations

- If a single file’s markdown block exceeds `INPUT_LIMIT_CHARS`, the entire operation
  is aborted and an error is shown.
- There is no per-workspace configuration yet; limits and ignore lists are compile-time
  constants in `src/extension.ts`.

---

## Release Notes

### 1.0.1

- Added README and repository metadata.
- Clarified behavior and documented limits.

### 1.0.0

- Initial release.
- File/folder selection.
- Recursive folder traversal with ignore list.
- Language-aware code fences.
- Automatic splitting into `quick-context-N.md` with per-document size limit.
- Guard against single-file overflow.
