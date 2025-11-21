'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { layoutClasses } from '@/lib/layout';
import { cn, formatDistanceToNow } from '@/lib/utils';
import { useProject, useProjects } from '@/hooks/useProject';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Plus } from 'lucide-react';

export default function ProjectsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  
  // Use the hook for managing a single project (for create/update/delete operations)
  const { createProject, deleteProject: deleteProjectApi } = useProject();
  
  // Use the hook for listing all user projects
  const { projects, isLoading, error, refresh } = useProjects(user?.id);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Show loading while Clerk is initializing
  const showLoading = !isLoaded || isLoading;

  // Sort by updatedAt (most recent first)
  const sortedProjects = (projects || []).sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const handleCreateProject = async () => {
    if (isCreating) return; // Prevent double-clicking
    
    setIsCreating(true);
    const name = projectName.trim() || undefined;
    try {
      const project = await createProject({ name: name || 'Untitled Project' });
      console.log('[ProjectsPage] Created project:', project);
      setProjectName('');
      setShowCreateModal(false);
      // Refresh the projects list
      refresh();
      // Route to chat page - the first step in the workflow
      router.push(`/project/${project.id}/chat`);
    } catch (error) {
      console.error('[ProjectsPage] Failed to create project:', error);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRenameProject = async () => {
    if (!selectedProject || !projectName.trim()) return;
    
    // Find the project in our local list
    const project = projects.find(p => p.id === selectedProject);
    if (!project) {
      console.error('[ProjectsPage] Project not found for rename:', selectedProject);
      return;
    }

    try {
      // Update via API
      const { projectsApi } = await import('@/lib/api/projects');
      await projectsApi.update(selectedProject, { name: projectName.trim() });
      
      setProjectName('');
      setShowRenameModal(false);
      setSelectedProject(null);
      // Refresh the projects list
      refresh();
    } catch (error) {
      console.error('[ProjectsPage] Failed to rename project:', error);
      alert('Failed to rename project. Please try again.');
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    const project = projects.find(p => p.id === selectedProject);
    if (project && deleteConfirmName === project.name) {
      try {
        await deleteProjectApi(selectedProject);
        setDeleteConfirmName('');
        setShowDeleteModal(false);
        setSelectedProject(null);
        // Refresh the projects list
        refresh();
      } catch (error) {
        console.error('[ProjectsPage] Failed to delete project:', error);
        alert('Failed to delete project. Please try again.');
      }
    }
  };

  const handleOpenRename = (projectId: string, currentName: string) => {
    setSelectedProject(projectId);
    setProjectName(currentName);
    setShowRenameModal(true);
  };

  const handleOpenDelete = (projectId: string) => {
    setSelectedProject(projectId);
    setDeleteConfirmName('');
    setShowDeleteModal(true);
  };

  const handleDuplicate = async (projectId: string) => {
    // For now, just create a copy by creating a new project with the same name + (Copy)
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    try {
      const newProject = await createProject({ 
        name: `${project.name} (Copy)`,
        description: project.description 
      });
      // Route to the new project's first step
      router.push(`/project/${newProject.id}/chat`);
    } catch (error) {
      console.error('[ProjectsPage] Failed to duplicate project:', error);
      alert('Failed to duplicate project. Please try again.');
    }
  };

  const handleProjectClick = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) {
      console.error(`[ProjectsPage] Project not found: ${projectId}`);
      return;
    }

    // Route to chat page (first step) - the project page will handle loading
    router.push(`/project/${projectId}/chat`);
  };

  return (
    <div className={cn(layoutClasses.fullScreen, 'flex flex-col pt-16')}>
      <main className={cn(layoutClasses.scrollableContainer, 'flex-1 p-6')}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Your Projects</h1>
              <p className="text-muted-foreground">
                Manage and view all your video generation projects
              </p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} size="lg">
              <Plus className="w-4 h-4 mr-2" />
              Create New Project
            </Button>
          </div>

          {showLoading ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg">
              <p className="text-muted-foreground text-center">
                Loading projects...
              </p>
            </div>
          ) : !user ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg">
              <p className="text-muted-foreground text-center mb-4">
                Please sign in to view your projects.
              </p>
              <Button onClick={() => router.push('/sign-in')}>
                Sign In
              </Button>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg">
              <p className="text-destructive text-center mb-4">
                Failed to load projects: {error.message}
              </p>
              <Button onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          ) : sortedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg">
              <p className="text-muted-foreground text-center mb-4">
                No projects yet. Start creating your first video project!
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedProjects.map((project) => {
                // Get thumbnail from first scene or storyboard
                const thumbnail = project.scenes?.[0]?.assets?.thumbnailPath || 
                                 project.storyboard?.selectedMood?.images?.[0]?.url;
                
                return (
                  <Card
                    key={project.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleProjectClick(project.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="truncate">{project.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {project.stats?.totalScenes 
                              ? `${project.stats.completedScenes}/${project.stats.totalScenes} scenes completed`
                              : 'No scenes yet'}
                          </CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            onClick={(e) => e.stopPropagation()}
                            className="ml-2"
                          >
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRename(project.id, project.name);
                              }}
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicate(project.id);
                              }}
                            >
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDelete(project.id);
                              }}
                              className="text-destructive"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {thumbnail ? (
                        <div className="aspect-video w-full rounded-md overflow-hidden bg-muted mb-3">
                          <img
                            src={thumbnail}
                            alt={project.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video w-full rounded-md bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-3">
                          <div className="text-center px-4">
                            <p className="text-2xl font-bold text-foreground/80 line-clamp-2">
                              {project.name}
                            </p>
                          </div>
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Updated {formatDistanceToNow(project.updatedAt)}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create New Project</CardTitle>
              <CardDescription>
                Enter a name for your project (optional - will auto-generate if left blank)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project 1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateProject();
                    } else if (e.key === 'Escape') {
                      setShowCreateModal(false);
                      setProjectName('');
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setProjectName('');
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateProject} disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rename Project Modal */}
      {showRenameModal && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Rename Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="rename-project-name">Project Name</Label>
                <Input
                  id="rename-project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameProject();
                    } else if (e.key === 'Escape') {
                      setShowRenameModal(false);
                      setProjectName('');
                      setSelectedProject(null);
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRenameModal(false);
                    setProjectName('');
                    setSelectedProject(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleRenameProject} disabled={!projectName.trim()}>
                  Rename
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Delete Project</CardTitle>
              <CardDescription>
                This action cannot be undone. Type the project name to confirm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="delete-confirm-name">Project Name</Label>
                <Input
                  id="delete-confirm-name"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder={projects.find(p => p.id === selectedProject)?.name}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleDeleteProject();
                    } else if (e.key === 'Escape') {
                      setShowDeleteModal(false);
                      setDeleteConfirmName('');
                      setSelectedProject(null);
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmName('');
                    setSelectedProject(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteProject}
                  disabled={
                    deleteConfirmName !== projects.find(p => p.id === selectedProject)?.name
                  }
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
