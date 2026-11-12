import JSZip from "jszip";
import type { TemplateFile, TemplateFolder } from "@/modules/playground/lib/path-to-json";

/**
 * Recursively packages a TemplateFolder structure into a downloadable .zip archive.
 */
export async function exportProjectAsZip(
    templateData: TemplateFolder,
    projectName: string = "poiex-project"
): Promise<void> {
    const zip = new JSZip();

    function addFolderToZip(folder: TemplateFolder, currentZip: JSZip) {
        if (!folder || !folder.items || !Array.isArray(folder.items)) return;

        for (const item of folder.items) {
            if ("fileExtension" in item) {
                const file = item as TemplateFile;
                const fileName = file.fileExtension
                    ? `${file.filename}.${file.fileExtension}`
                    : file.filename;
                currentZip.file(fileName, file.content || "");
            } else if ("items" in item && "folderName" in item) {
                const subFolder = item as TemplateFolder;
                const nestedZip = currentZip.folder(subFolder.folderName);
                if (nestedZip) {
                    addFolderToZip(subFolder, nestedZip);
                }
            }
        }
    }

    addFolderToZip(templateData, zip);

    const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cleanName = (projectName || "poiex-project")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .toLowerCase();
    a.download = `${cleanName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
