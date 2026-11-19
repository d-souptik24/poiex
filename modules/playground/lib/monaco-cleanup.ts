import { loader } from "@monaco-editor/react";

/**
 * Disposes a specific Monaco text model by its file path or URI.
 * Safely guards against SSR and already-disposed models.
 */
export function disposeMonacoModel(filePath: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const monaco = loader.__getMonacoInstance();
    if (!monaco || !monaco.editor || !monaco.Uri) return false;

    const cleanTarget = filePath.replace(/^\/+/, "");
    const targetUri = monaco.Uri.parse(cleanTarget);
    const directModel = monaco.editor.getModel(targetUri);

    if (directModel && typeof directModel.dispose === "function" && !directModel.isDisposed()) {
      directModel.dispose();
      return true;
    }

    // Fallback scan: match by exact normalized modelPath to prevent accidental collisions across subdirectories
    const models = monaco.editor.getModels?.() || [];
    for (const model of models) {
      if (model && typeof model.dispose === "function" && !model.isDisposed()) {
        const modelPath = model.uri?.path ? model.uri.path.replace(/^\/+/, "") : "";
        if (modelPath === cleanTarget) {
          model.dispose();
          return true;
        }
      }
    }
  } catch (err) {
    console.warn("Failed to dispose Monaco model:", err);
  }

  return false;
}

/**
 * Disposes all active Monaco text models in memory.
 * Used when exiting the playground workspace or switching projects.
 */
export function disposeAllMonacoModels(): number {
  if (typeof window === "undefined") return 0;

  try {
    const monaco = loader.__getMonacoInstance();
    if (!monaco || !monaco.editor || typeof monaco.editor.getModels !== "function") return 0;

    let count = 0;
    const models = monaco.editor.getModels() || [];
    for (const model of models) {
      if (model && typeof model.dispose === "function" && !model.isDisposed()) {
        model.dispose();
        count++;
      }
    }
    return count;
  } catch (err) {
    console.warn("Failed to dispose all Monaco models:", err);
    return 0;
  }
}
