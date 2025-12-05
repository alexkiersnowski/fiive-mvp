"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ProjectBadge } from "@/components/ui/project-badge";
import { Plus, Eye } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useConnection } from "../ConnectionContext";
import { ProjectDetailModal } from "../projects/ProjectDetailModal";
import { NewProjectModal } from "../projects/NewProjectModal";
import { fetchProjectById } from "../projects/actions";
import type { Project } from "../server";

type CommentItem = {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: Date;
  text: string;
};

type ProjectDetailPayload = {
  projectId: string;
  title: string;
  description: string;
  client?: Project["client"];
  agency?: Project["agency"];
  submittedBy?: Project["submittedBy"];
  assignee?: Project["assignee"];
  type?: Project["type"];
  status?: Project["status"];
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  requestsCount?: number;
  tasksCount?: number;
  createdByOrgId?: string;
  createdByOrgType?: Project["createdByOrgType"];
};

interface ProjectsCardClientProps {
  connectionId: string;
  projects: Project[];
  agencyMembers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    jobTitle?: string;
    orgId?: string;
    orgName?: string;
    orgType?: "agency" | "client";
  }>;
}

const formatCreatedAt = (isoDate?: string | null) => {
  if (!isoDate) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date());
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date());
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
};

export default function ProjectsCardClient({
  connectionId,
  projects,
  agencyMembers,
}: ProjectsCardClientProps) {
  const { snapshot, context } = useConnection();
  const router = useRouter();
  const pathname = usePathname();

  const [prefetchedProjects, setPrefetchedProjects] = useState<Project[]>(projects);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectDetailPayload | null>(null);
  const [selectedComments, setSelectedComments] = useState<CommentItem[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  useEffect(() => {
    setPrefetchedProjects(projects);
  }, [projects]);

  const isAgency = context.variant === "agency";
  const title = "Projects";
  const description = isAgency
    ? "Projects give your team and client a shared view of work and progress."
    : "Projects are created by your agency, giving you a shared view of work and progress.";

  const hasProjects = prefetchedProjects.length > 0;

  const baseRoute = useMemo(() => {
    if (pathname) {
      const [, segment] = pathname.split("/");
      if (segment === "clients" || segment === "agencies") {
        return segment;
      }
    }
    return context.variant === "agency" ? "agencies" : "clients";
  }, [pathname, context.variant]);

  const mapProjectToDetailPayload = useCallback(
    (project: Project): ProjectDetailPayload => ({
      projectId: project.id,
      title: project.title,
      description: project.description,
      client: project.client,
      agency: project.agency,
      submittedBy: project.submittedBy,
      assignee: project.assignee,
      type: project.type,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      createdAt: project.createdAt,
      requestsCount: project.requestsCount,
      tasksCount: project.tasksCount,
      createdByOrgId: project.createdByOrgId,
      createdByOrgType: project.createdByOrgType,
    }),
    []
  );

  const handleRowClick = useCallback(
    (projectId: string) => {
      const target = prefetchedProjects.find((item) => item.id === projectId);
      if (!target) {
        toast.error("Unable to load project details.");
        return;
      }

      setSelectedProjectId(projectId);
      setSelectedProject(mapProjectToDetailPayload(target));
      setSelectedComments([]);
      setIsDetailModalOpen(true);
    },
    [prefetchedProjects, mapProjectToDetailPayload]
  );

  const handleProjectUpdate = useCallback(
    (
      projectId: string,
      updates: {
        title?: string;
        description?: string;
        status?: Project["status"];
        assignee?: Project["assignee"];
        startDate?: string | null;
        endDate?: string | null;
      }
    ) => {
      setPrefetchedProjects((prev) =>
        prev.map((item) => {
          if (item.id !== projectId) {
            return item;
          }

          return {
            ...item,
            ...(updates.title !== undefined ? { title: updates.title } : {}),
            ...(updates.description !== undefined ? { description: updates.description } : {}),
            ...(updates.status !== undefined ? { status: updates.status } : {}),
            ...(updates.assignee !== undefined ? { assignee: updates.assignee ?? null } : {}),
            ...(updates.startDate !== undefined ? { startDate: updates.startDate || "" } : {}),
            ...(updates.endDate !== undefined ? { endDate: updates.endDate || "" } : {}),
          };
        })
      );

      setSelectedProject((prev) => {
        if (!prev || prev.projectId !== projectId) {
          return prev;
        }

        const nextSelected: ProjectDetailPayload = {
          ...prev,
          ...(updates.title !== undefined ? { title: updates.title } : {}),
          ...(updates.description !== undefined ? { description: updates.description } : {}),
          ...(updates.status !== undefined ? { status: updates.status } : {}),
          ...(updates.assignee !== undefined ? { assignee: updates.assignee ?? null } : {}),
          ...(updates.startDate !== undefined ? { startDate: updates.startDate ?? "" } : {}),
          ...(updates.endDate !== undefined ? { endDate: updates.endDate ?? "" } : {}),
        };

        return nextSelected;
      });

      // Dispatch event to notify RequestsCard and TasksCard of project updates
      if (updates.title !== undefined) {
        const event = new CustomEvent('projectUpdated', {
          detail: {
            projectId,
            connectionId,
            title: updates.title,
          }
        });
        window.dispatchEvent(event);
        if (process.env.NODE_ENV !== 'production') {
          console.log('[ProjectsCard] Dispatched projectUpdated event:', { projectId, connectionId, title: updates.title });
        }
      }
    },
    [connectionId]
  );

  const handleProjectDeleted = useCallback(
    (projectId: string) => {
      setPrefetchedProjects((prev) => prev.filter((item) => item.id !== projectId));

      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
        setSelectedProject(null);
        setSelectedComments([]);
        setIsDetailModalOpen(false);
      }
    },
    [selectedProjectId]
  );

  const handleDetailModalClose = useCallback(() => {
    setIsDetailModalOpen(false);
    setTimeout(() => {
      setSelectedProjectId(null);
      setSelectedProject(null);
      setSelectedComments([]);
    }, 300);
  }, []);

  const handleDetailModalExpand = useCallback(() => {
    if (!selectedProjectId) return;
    router.push(`/${baseRoute}/${connectionId}/projects/${selectedProjectId}`);
  }, [baseRoute, connectionId, router, selectedProjectId]);

  const handleCommentsUpdate = useCallback((comments: CommentItem[]) => {
    setSelectedComments(comments);
  }, []);

  const handleNewProjectOptimistic = useCallback(
    (payload: {
      tempId: string;
      title: string;
      description: string;
      type: string | null;
      assigneeUserId: string | null;
      startDate: string;
      endDate: string;
    }) => {
      const optimisticProject: Project = {
        id: payload.tempId,
        connectionId,
        title: payload.title,
        description: payload.description || "",
        status: "planned",
        type: payload.type,
        submittedBy: {
          id: context.user.id,
          name: `${context.user.firstName} ${context.user.lastName}`.trim() || "You",
          email: context.user.email,
          avatarUrl: context.user.avatarUrl,
          jobTitle: context.user.jobTitle || undefined,
          orgId: context.organization.id,
          orgName: context.organization.name || "",
          orgLogo: context.organization.logoUrl || undefined,
        },
        assignee: null,
        client: {
          id: snapshot.partner.id,
          name: snapshot.partner.name,
          logoUrl: snapshot.partner.logo || undefined,
        },
        agency: {
          id: snapshot.agency.id,
          name: snapshot.agency.name,
          logoUrl: snapshot.agency.logo || undefined,
        },
        startDate: payload.startDate || "",
        endDate: payload.endDate || "",
        createdAt: formatCreatedAt(),
        requestsCount: 0,
        tasksCount: 0,
        createdByOrgId: context.organization.id,
        createdByOrgType: context.variant === "agency" ? "agency" : "client",
      };

      setPrefetchedProjects((prev) => {
        const next = [optimisticProject, ...prev.filter((item) => item.id !== payload.tempId)];
        return next.slice(0, 2);
      });
    },
    [connectionId, context.organization, context.user, context.variant, snapshot.agency, snapshot.partner]
  );

  const handleNewProjectCreated = useCallback(
    async ({ projectId, tempId }: { projectId: string; tempId?: string }) => {
      try {
        const fetched = await fetchProjectById(connectionId, projectId);
        if (!fetched) {
          return;
        }

        setPrefetchedProjects((prev) => {
          const filtered = prev.filter((item) => item.id !== tempId && item.id !== fetched.id);
          const next = [fetched, ...filtered];
          return next.slice(0, 2);
        });
      } catch (error) {
        console.error("Failed to reconcile new project:", error);
      }
    },
    [connectionId]
  );

  const handleNewProjectButtonClick = useCallback(() => {
    setIsNewModalOpen(true);
  }, []);

  const handleNewProjectModalClose = useCallback(() => {
    setIsNewModalOpen(false);
  }, []);

  return (
    <Card className="w-full h-full min-h-[370px] pt-5 pb-6 px-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-xl-medium" style={{ color: "var(--color-base-text-primary)" }}>
          {title}
        </CardTitle>
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="text-xs border-0"
              style={{
                borderRadius: "var(--radius-1-max, 3px)",
                backgroundColor: "var(--color-neutral-3, #f0f0f3)",
                border: "none",
                cursor: "default",
              }}
            >
              <Eye size={12} weight="fill" style={{ color: "var(--color-neutral-11, #44474f)" }} />
              <span className="ml-1" style={{ color: "var(--color-neutral-11, #44474f)" }}>
                {isAgency ? "Client visible" : "View only"}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            {isAgency
              ? "Visible in client portal. Only your agency can edit."
              : "Only your agency can edit this"}
          </TooltipContent>
        </Tooltip>
      </div>

      {hasProjects ? (
        <div className="mt-1">
          <Table className="table-fixed w-full border-collapse">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                  Project
                </TableHead>
                <TableHead className="w-[20%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                  Status
                </TableHead>
                <TableHead className="w-[20%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                  Start date
                </TableHead>
                <TableHead className="w-[20%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                  End date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prefetchedProjects.map((project) => (
                <TableRow
                  key={project.id}
                  tabIndex={0}
                  className="cursor-pointer transition-colors duration-75 hover:bg-[var(--color-interactive-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-interactive-border-focus)]"
                  onClick={() => handleRowClick(project.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleRowClick(project.id);
                    }
                  }}
                >
                  <TableCell className="w-[40%] py-2">
                    <span
                      className="text-sm-regular truncate"
                      style={{ color: "var(--color-base-text-primary)" }}
                    >
                      {project.title?.trim() || "Untitled project"}
                    </span>
                  </TableCell>
                  <TableCell className="w-[20%] py-2">
                  <ProjectBadge
                    variant={project.status}
                    size="sm"
                    showText
                    className="inline-flex"
                  />
                  </TableCell>
                  <TableCell className="w-[20%] py-2">
                    <span
                      className="text-sm-regular"
                      style={
                        project.startDate
                          ? { color: "var(--color-base-text-primary)" }
                          : { color: "var(--color-base-text-tertiary)" }
                      }
                    >
                      {project.startDate || "No start date"}
                    </span>
                  </TableCell>
                  <TableCell className="w-[20%] py-2">
                    <span
                      className="text-sm-regular"
                      style={
                        project.endDate
                          ? { color: "var(--color-base-text-primary)" }
                          : { color: "var(--color-base-text-tertiary)" }
                      }
                    >
                      {project.endDate || "No end date"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-xs-regular text-tertiary">{description}</p>
      )}

      <div className="mt-auto flex justify-end">
        {isAgency && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 shadow-none cursor-pointer transition-all duration-75"
            onClick={handleNewProjectButtonClick}
          >
            <Plus size={16} weight="regular" />
            Add project
          </Button>
        )}
      </div>

      <ProjectDetailModal
        projectData={selectedProject}
        agencyMembers={agencyMembers}
        isOpen={isDetailModalOpen}
        onClose={handleDetailModalClose}
        onExpand={handleDetailModalExpand}
        onProjectUpdate={(projectId, updates) => {
          handleProjectUpdate(projectId, updates);
        }}
        onProjectDeleted={handleProjectDeleted}
        connectionId={connectionId}
        currentOrgId={context.organization.id}
        variant={context.variant}
        activeUser={{
          id: context.user.id,
          firstName: context.user.firstName,
          lastName: context.user.lastName,
          avatarUrl: context.user.avatarUrl,
        }}
        initialComments={selectedComments}
        onCommentsUpdate={handleCommentsUpdate}
      />

      <NewProjectModal
        client={{
          id: snapshot.partner.id,
          name: snapshot.partner.name,
          logoUrl: snapshot.partner.logo || undefined,
        }}
        agencyMembers={agencyMembers}
        isOpen={isNewModalOpen}
        onClose={handleNewProjectModalClose}
        onProjectOptimistic={handleNewProjectOptimistic}
        onProjectCreated={handleNewProjectCreated}
        connectionId={connectionId}
        currentOrgId={context.organization.id}
        variant={context.variant}
      />
    </Card>
  );
}

