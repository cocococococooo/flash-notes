import { API_BASE_URL } from "../constants/config";

interface Project {
  id: number;
  title: string;
  createdAt: string;
}

interface Image {
  id: number;
  projectId: number;
  localUri: string;
  ocrText: string;
  aiSummary: string;
  userSummary: string;
  tags: string;
  status: string;
}

interface Note {
  id: number;
  projectId: number;
  content: string;
  tags?: string;
  updatedAt: string;
}

export interface NoteListItem {
  id: number;
  projectId: number;
  projectTitle: string;
  content: string;
  tags: string;
  imageCount: number;
  imageUrls: string[];
  updatedAt: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      ...(options?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listProjects: () => request<Project[]>("/projects"),

  createProject: (title: string) =>
    request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  deleteProject: (id: number) =>
    request<void>(`/projects/${id}`, { method: "DELETE" }),

  uploadImages: (projectId: number, uris: string[]) => {
    const formData = new FormData();
    uris.forEach((uri) => {
      const filename = uri.split("/").pop() || "photo.jpg";
      const ext = filename.split(".").pop() || "jpg";
      formData.append("files", {
        uri,
        name: filename,
        type: `image/${ext === "png" ? "png" : "jpeg"}`,
      } as any);
    });
    return request<Image[]>(`/projects/${projectId}/images`, {
      method: "POST",
      body: formData,
    });
  },

  listImages: (projectId: number) =>
    request<Image[]>(`/projects/${projectId}/images`),

  updateImage: (imageId: number, data: { userSummary?: string; tags?: string }) =>
    request<Image>(`/images/${imageId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  generateNote: (projectId: number) =>
    request<Note>(`/projects/${projectId}/generate-note`, {
      method: "POST",
    }),

  listAllNotes: () => request<NoteListItem[]>("/notes"),

  getNote: (projectId: number) =>
    request<Note>(`/projects/${projectId}/note`),

  updateNote: (projectId: number, content: string, tags?: string) =>
    request<Note>(`/projects/${projectId}/note`, {
      method: "PUT",
      body: JSON.stringify({ content, tags }),
    }),
};
