interface TemplateItem {
  filename?: string;
  fileExtension?: string;
  content?: string;
  folderName?: string;
  items?: TemplateItem[];
}

interface WebContainerFile {
  file: {
    contents: string;
  };
}

interface WebContainerDirectory {
  directory: {
    [key: string]: WebContainerFile | WebContainerDirectory;
  };
}

type WebContainerFileSystem = Record<
  string,
  WebContainerFile | WebContainerDirectory
>;

export function transformToWebContainerFormat(template: {
  folderName: string;
  items: TemplateItem[];
}): WebContainerFileSystem {
  if (!template?.items) return Object.create(null);

  function processItem(
    item: TemplateItem,
  ): WebContainerFile | WebContainerDirectory {
    if (item.folderName && item.items) {
      // This is a directory - use null-prototype object to guard against prototype pollution
      const directoryContents: WebContainerFileSystem = Object.create(null);

      item.items.forEach((subItem) => {
        const key = subItem.folderName
          ? subItem.folderName
          : subItem.fileExtension
            ? `${subItem.filename || ""}.${subItem.fileExtension}`
            : subItem.filename || "";
        if (key && key !== "__proto__" && key !== "constructor" && key !== "prototype") {
          directoryContents[key] = processItem(subItem);
        }
      });

      return {
        directory: directoryContents,
      };
    } else {
      // This is a file
      return {
        file: {
          contents: item.content || "",
        },
      };
    }
  }

  const result: WebContainerFileSystem = Object.create(null);

  template.items.forEach((item) => {
    const key = item.folderName
      ? item.folderName
      : item.fileExtension
        ? `${item.filename || ""}.${item.fileExtension}`
        : item.filename || "";
    if (key && key !== "__proto__" && key !== "constructor" && key !== "prototype") {
      result[key] = processItem(item);
    }
  });

  return result;
}
