import * as vscode from "vscode";
import * as path from "path";

/**
 * Approximate max characters you want to keep per ChatGPT input.
 * Tune as needed.
 */
const INPUT_LIMIT_CHARS = 60000;

/** Directories to skip when walking folders. Adjust as needed. */
const IGNORE_DIRS = ["node_modules", ".git", ".next", "dist", "build", "out"];

function languageFromExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();

  switch (ext) {
    case ".ts":
      return "ts";
    case ".tsx":
      return "tsx";
    case ".js":
      return "javascript";
    case ".jsx":
      return "jsx";
    case ".json":
      return "json";
    case ".md":
      return "markdown";
    case ".css":
      return "css";
    case ".scss":
    case ".sass":
      return "scss";
    case ".html":
    case ".htm":
      return "html";
    case ".py":
      return "python";
    case ".rb":
      return "ruby";
    case ".php":
      return "php";
    default:
      return "text";
  }
}

/**
 * Recursively collect all file URIs from a starting URI.
 * - If it's a file, return it.
 * - If it's a directory, walk it.
 */
async function collectFiles(uri: vscode.Uri): Promise<vscode.Uri[]> {
  const fs = vscode.workspace.fs;
  const result: vscode.Uri[] = [];

  const stat = await fs.stat(uri);

  if (stat.type === vscode.FileType.File) {
    result.push(uri);
    return result;
  }

  if (stat.type === vscode.FileType.Directory) {
    const entries = await fs.readDirectory(uri);

    for (const [name, type] of entries) {
      if (type === vscode.FileType.Directory && IGNORE_DIRS.includes(name)) {
        continue;
      }

      const childUri = vscode.Uri.joinPath(uri, name);

      if (type === vscode.FileType.File) {
        result.push(childUri);
      } else if (type === vscode.FileType.Directory) {
        const nested = await collectFiles(childUri);
        result.push(...nested);
      }
    }
  }

  return result;
}

/**
 * Collect all files from the selection (files and/or directories).
 */
async function collectFilesFromTargets(targetUris: vscode.Uri[]): Promise<vscode.Uri[]> {
  const files: vscode.Uri[] = [];
  for (const uri of targetUris) {
    try {
      const collected = await collectFiles(uri);
      files.push(...collected);
    } catch (err) {
      console.error("Quick Context: error reading", uri.toString(), err);
    }
  }
  return files;
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "quickContext.generateFromSelection",
    async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
      // 1) Determine initial targets (file / folder / editor file)
      let targetUris: vscode.Uri[] = [];

      if (uris && uris.length > 0) {
        targetUris = uris;
      } else if (uri) {
        targetUris = [uri];
      } else if (vscode.window.activeTextEditor) {
        targetUris = [vscode.window.activeTextEditor.document.uri];
      }

      if (targetUris.length === 0) {
        vscode.window.showInformationMessage("Quick Context: No selection to process.");
        return;
      }

      // 2) Expand directories → concrete files
      const fileUris = await collectFilesFromTargets(targetUris);

      if (fileUris.length === 0) {
        vscode.window.showInformationMessage("Quick Context: No files found in selection.");
        return;
      }

      const decoder = new TextDecoder("utf-8");
      const fileBlocks: string[] = [];

      // 3) Build per-file markdown blocks, and check single-file limit
      for (let i = 0; i < fileUris.length; i++) {
        const fileUri = fileUris[i];
        const fileName = path.basename(fileUri.fsPath);
        const relativePath = vscode.workspace.asRelativePath(fileUri, false);
        const fenceLang = languageFromExtension(fileName);

        const contentBytes = await vscode.workspace.fs.readFile(fileUri);
        const content = decoder.decode(contentBytes);

        const block =
          `${i + 1}. ${fileName}\n` +
          `${relativePath}\n\n` +
          "```" + fenceLang + "\n" +
          content +
          "\n```\n";

        if (block.length > INPUT_LIMIT_CHARS) {
          vscode.window.showErrorMessage(
            `Quick Context: File "${relativePath}" alone exceeds the configured input limit (${INPUT_LIMIT_CHARS} characters). Operation aborted.`
          );
          return;
        }

        fileBlocks.push(block);
      }

      // 4) Group blocks into multiple markdown docs, each under INPUT_LIMIT_CHARS
      const documents: string[] = [];
      let current = "";

      for (const block of fileBlocks) {
        if (current.length === 0) {
          current = block;
          continue;
        }

        if (current.length + block.length > INPUT_LIMIT_CHARS) {
          documents.push(current);
          current = block;
        } else {
          current += "\n" + block;
        }
      }

      if (current.length > 0) {
        documents.push(current);
      }

      // 5) Open one or multiple markdown documents with explicit names:
      //    quick-context-1.md, quick-context-2.md, ...
      for (let i = 0; i < documents.length; i++) {
        const index = i + 1;
        const uriUntitled = vscode.Uri.parse(`untitled:quick-context-${index}.md`);

        const doc = await vscode.workspace.openTextDocument(uriUntitled);
        const editor = await vscode.window.showTextDocument(doc, {
          preview: false,
          viewColumn: i === 0 ? vscode.ViewColumn.One : vscode.ViewColumn.Beside,
        });

        await editor.edit(edit =>
          edit.insert(new vscode.Position(0, 0), documents[i])
        );

        // ensure markdown language mode (usually inferred from .md, but enforce)
        await vscode.languages.setTextDocumentLanguage(editor.document, "markdown");
      }

      if (documents.length > 1) {
        vscode.window.showInformationMessage(
          `Quick Context: Generated ${documents.length} prompt documents to stay under the input limit.`
        );
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
