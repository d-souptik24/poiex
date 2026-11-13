import { useState, useEffect, useCallback } from "react";
import { WebContainer } from "@webcontainer/api";

interface UseWebContaierReturn {
  serverUrl: string | null;
  isLoading: boolean;
  error: string | null;
  instance: WebContainer | null;
  writeFileSync: (path: string, content: string) => Promise<void>;
  /** Tears down the singleton WebContainer instance and resets state. */
  destroy: () => void;
}

let webcontainerBootPromise: Promise<WebContainer> | null = null;

async function getBootedWebContainer(): Promise<WebContainer> {
  if (!webcontainerBootPromise) {
    webcontainerBootPromise = WebContainer.boot().catch((err) => {
      webcontainerBootPromise = null;
      throw err;
    });
  }
  return webcontainerBootPromise;
}

export const useWebContainer = (): UseWebContaierReturn => {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [instance, setInstance] = useState<WebContainer | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initializeWebContainer() {
      try {
        const webcontainerInstance = await getBootedWebContainer();

        if (!mounted) return;

        setInstance(webcontainerInstance);
        setIsLoading(false);

        // Register the server-ready listener. The `mounted` flag in the closure
        // prevents stale state updates after unmount. WebContainer v1's .on()
        // does not expose an .off() method, so the guard is our safety net.
        webcontainerInstance.on("server-ready", (_port: number, url: string) => {
          if (mounted) {
            setServerUrl(url);
          }
        });
      } catch (error) {
        console.error("Failed to initialize WebContainer:", error);
        if (mounted) {
          setError(
            error instanceof Error
              ? error.message
              : "Failed to initialize WebContainer"
          );
          setIsLoading(false);
        }
      }
    }

    initializeWebContainer();

    return () => {
      mounted = false;
    };
  }, []);

  const writeFileSync = useCallback(
    async (path: string, content: string): Promise<void> => {
      if (!instance) {
        throw new Error("WebContainer instance is not available");
      }

      try {
        const cleanPath = path.replace(/^\/+/, "");
        const pathParts = cleanPath.split("/");
        const folderPath = pathParts.slice(0, -1).join("/");

        if (folderPath) {
          await instance.fs.mkdir(folderPath, { recursive: true }).catch(() => {});
        }

        await instance.fs.writeFile(cleanPath, content);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to write file";
        console.error(`Failed to write file at ${path}:`, err);
        throw new Error(`Failed to write file at ${path}: ${errorMessage}`);
      }
    },
    [instance]
  );

  const destroy = useCallback(() => {
    if (instance) {
      instance.teardown();
      setInstance(null);
      setServerUrl(null);
      webcontainerBootPromise = null;
    }
  }, [instance]);

  return { serverUrl, isLoading, error, instance, writeFileSync, destroy }
};
