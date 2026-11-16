"use client";

import Image from "next/image";
import { format } from "date-fns";
import type { Project } from "../types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Edit3,
  Trash2,
  ExternalLink,
  Copy,
  Download,
  Eye,
  Star,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { MarkedToggleButton } from "./marked-toggle";
import { exportProjectAsZip } from "@/modules/playground/lib/export-zip";
import { getPlaygroundById } from "@/modules/playground/actions";
import type { TemplateFolder } from "@/modules/playground/lib/path-to-json";

interface ProjectTableProps {
  projects: Project[];
  onUpdateProject?: (
    id: string,
    data: { title: string; description: string },
  ) => Promise<void>;
  onDeleteProject?: (id: string) => Promise<void>;
  onDuplicateProject?: (id: string) => Promise<void>;
}

interface EditProjectData {
  title: string;
  description: string;
}

export default function ProjectTable({
  projects,
  onUpdateProject,
  onDeleteProject,
  onDuplicateProject,
}: ProjectTableProps) {
  const router = useRouter();
  const [projectList, setProjectList] = useState<Project[]>(projects);
  const [prevProjects, setPrevProjects] = useState<Project[]>(projects);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editData, setEditData] = useState<EditProjectData>({
    title: "",
    description: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Adjust state during render when server props change (React 19 pattern avoiding cascading renders)
  if (prevProjects !== projects) {
    setPrevProjects(projects);
    setProjectList(projects);
  }

  // Optimistic listener for real-time favorite toggling
  useEffect(() => {
    const handleStarToggle = (event: Event) => {
      const customEvent = event as CustomEvent<{
        id: string;
        isMarked: boolean;
      }>;
      const { id, isMarked } = customEvent.detail;
      setProjectList((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                Starmark: isMarked ? [{ isMarked: true }] : [],
              }
            : p,
        ),
      );
    };

    window.addEventListener("poiex:star-toggle", handleStarToggle);
    return () =>
      window.removeEventListener("poiex:star-toggle", handleStarToggle);
  }, []);

  const handleEditClick = (project: Project) => {
    setSelectedProject(project);
    setEditData({
      title: project.title,
      description: project.description || "",
    });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = async (project: Project) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };

  const handleUpdateProject = async () => {
    if (!selectedProject || !onUpdateProject) return;

    const updatedId = selectedProject.id;
    const previousData = {
      title: selectedProject.title,
      description: selectedProject.description,
    };

    // Optimistic local update (instant render)
    setProjectList((prev) =>
      prev.map((p) => (p.id === updatedId ? { ...p, ...editData } : p)),
    );
    setEditDialogOpen(false);

    setIsLoading(true);
    try {
      await onUpdateProject(updatedId, editData);
      toast.success("Project updated successfully");
      router.refresh();
    } catch (error) {
      // Rollback on failure
      setProjectList((prev) =>
        prev.map((p) => (p.id === updatedId ? { ...p, ...previousData } : p)),
      );
      toast.error("Failed to update project");
      console.error("Error updating project:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject || !onDeleteProject) return;

    const deletedId = selectedProject.id;
    const backupProject = selectedProject;

    // Optimistic removal (instant render)
    setProjectList((prev) => prev.filter((p) => p.id !== deletedId));
    setDeleteDialogOpen(false);
    setSelectedProject(null);
    window.dispatchEvent(
      new CustomEvent("poiex:project-delete", { detail: { id: deletedId } }),
    );

    setIsLoading(true);
    try {
      await onDeleteProject(deletedId);
      toast.success("Project deleted successfully");
      router.refresh();
    } catch (error) {
      // Rollback on failure
      setProjectList((prev) => [...prev, backupProject]);
      toast.error("Failed to delete project");
      console.error("Error deleting project:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuplicateProject = async (project: Project) => {
    if (!onDuplicateProject) return;

    setIsLoading(true);
    try {
      await onDuplicateProject(project.id);
      toast.success("Project duplicated successfully");
      router.refresh();
    } catch (error) {
      toast.error("Failed to duplicate project");
      console.error("Error duplicating project:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyProjectUrl = (projectId: string) => {
    const url = `${window.location.origin}/playground/${projectId}`;
    navigator.clipboard.writeText(url);
    toast.success("Project url copied to clipboard");
  };

  const handleDownloadZip = async (project: Project) => {
    try {
      setExportingId(project.id);
      toast.loading(`Packaging ${project.title}...`, {
        id: `zip-${project.id}`,
      });

      let templateFolder: TemplateFolder | null = null;
      try {
        const data = await getPlaygroundById(project.id);
        const rawContent = data?.templateFiles?.[0]?.content;
        let parsedContent: unknown = rawContent;
        while (typeof parsedContent === "string") {
          try {
            parsedContent = JSON.parse(parsedContent);
          } catch {
            break;
          }
        }
        if (
          parsedContent &&
          typeof parsedContent === "object" &&
          ("items" in parsedContent || "folderName" in parsedContent)
        ) {
          templateFolder = parsedContent as TemplateFolder;
        }
      } catch (err) {
        console.warn(
          "Could not load playground from database, falling back to template endpoint",
          err,
        );
      }

      if (!templateFolder) {
        const res = await fetch(`/api/template/${project.id}`);
        if (!res.ok) {
          throw new Error("Failed to load project template files");
        }
        const templateRes = await res.json();
        if (
          templateRes.templateJson &&
          Array.isArray(templateRes.templateJson)
        ) {
          templateFolder = {
            folderName: "Root",
            items: templateRes.templateJson,
          };
        } else if (templateRes.templateJson?.items) {
          templateFolder = templateRes.templateJson as TemplateFolder;
        } else {
          throw new Error("Invalid project structure");
        }
      }

      await exportProjectAsZip(templateFolder, project.title);
      toast.success(`Exported ${project.title} as ZIP`, {
        id: `zip-${project.id}`,
      });
    } catch (error) {
      console.error("ZIP export error:", error);
      toast.error("Failed to export project as ZIP", {
        id: `zip-${project.id}`,
      });
    } finally {
      setExportingId(null);
    }
  };

  const getTemplateBadgeStyle = (template: string) => {
    const lower = (template || "").toLowerCase();
    if (lower.includes("next")) {
      return "bg-zinc-800/80 text-zinc-100 border-zinc-700/80 hover:bg-zinc-800";
    }
    if (lower.includes("hono")) {
      return "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20";
    }
    if (lower.includes("express")) {
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20";
    }
    if (lower.includes("react")) {
      return "bg-cyan-500/10 text-cyan-500 border-cyan-500/30 hover:bg-cyan-500/20";
    }
    return "bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20";
  };

  return (
    <>
      <div className="w-full bg-white dark:bg-card border border-zinc-200/90 dark:border-zinc-800 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden transition-colors">
        <div className="px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Projects
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {projectList.length}
            </span>
          </div>
        </div>
        <Table className="table-fixed w-full">
          <TableHeader className="bg-zinc-50/70 dark:bg-zinc-950/30">
            <TableRow className="border-b border-zinc-200/90 dark:border-zinc-800 hover:bg-transparent">
              <TableHead className="w-[45%] pl-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Project
              </TableHead>
              <TableHead className="w-[14%] py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Template
              </TableHead>
              <TableHead className="w-[16%] py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Created
              </TableHead>
              <TableHead className="w-[18%] py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                User
              </TableHead>
              <TableHead className="w-[7%] pr-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectList.map((project) => {
              const isStarred = Boolean(project.Starmark?.[0]?.isMarked);
              return (
                <TableRow
                  key={project.id}
                  className="border-b border-zinc-200/80 dark:border-zinc-800/80 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50 transition-colors"
                >
                  <TableCell className="font-medium pl-5 py-3.5 max-w-0">
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Link
                          href={`/playground/${project.id}`}
                          className="hover:underline flex items-center gap-1.5 group/title truncate"
                        >
                          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover/title:text-rose-500 transition-colors truncate">
                            {project.title}
                          </span>
                        </Link>
                        {isStarred && (
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                      </div>
                      <span
                        className="text-xs text-muted-foreground truncate block mt-0.5"
                        title={project.description || ""}
                      >
                        {project.description || "No description provided"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-semibold tracking-wide py-0.5 px-2 uppercase ${getTemplateBadgeStyle(project.template)}`}
                    >
                      {project.template}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span className="text-xs text-muted-foreground font-mono">
                      {project.createdAt
                        ? format(new Date(project.createdAt), "MMM dd, yyyy")
                        : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 max-w-0">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div className="w-6 h-6 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0">
                        <Image
                          src={project.user?.image || "/placeholder.svg"}
                          alt={project.user?.name || "User"}
                          width={24}
                          height={24}
                          className="object-cover"
                        />
                      </div>
                      <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                        {project.user?.name || "Anonymous"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="pr-5 py-3.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          nativeButton
                          render={
                            <MarkedToggleButton
                              markedForRevision={
                                project.Starmark?.[0]?.isMarked ?? false
                              }
                              id={project.id}
                            />
                          }
                        />
                        <DropdownMenuItem
                          render={
                            <Link
                              href={`/playground/${project.id}`}
                              className="flex items-center"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Open Project
                            </Link>
                          }
                        />
                        <DropdownMenuItem
                          render={
                            <Link
                              href={`/playground/${project.id}`}
                              target="_blank"
                              className="flex items-center"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open in New Tab
                            </Link>
                          }
                        />
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleEditClick(project)}
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit Project
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicateProject(project)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDownloadZip(project)}
                          disabled={exportingId === project.id}
                        >
                          {exportingId === project.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin text-[#E93F3F]" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Download as ZIP
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => copyProjectUrl(project.id)}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Copy URL
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(project)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Make changes to your project details here. Click save when
              you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                value={editData.title}
                onChange={(e) =>
                  setEditData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Enter project title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editData.description}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Enter project description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpdateProject}
              disabled={isLoading || !editData.title.trim()}
              className="flex items-center gap-1.5"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isLoading ? "Saving..." : "Save Changes"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="gap-2.5">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedProject?.title}
              &quot;? This action cannot be undone. All files and data
              associated with this project will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="-mx-4 -mb-4 -mt-1 px-4 py-2.5 flex sm:justify-end gap-2 border-t bg-muted/50">
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
