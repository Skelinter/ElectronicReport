import { getApiBaseUrl } from "~/lib/auth";

export type ApiErrorResponse = {
  message?: string;
  error?: string;
};

export type DepartmentNodeResponse = {
  departmentId: string;
  parentDepartmentId?: string | null;
  name: string;
  shortName: string;
  hasChildren: boolean;
};

export type FlatDepartmentNodeResponse = {
  departmentId: string;
  parentDepartmentId?: string | null;
  name: string;
  shortName: string;
  depth: number;
  path: string[];
};

export type CreateDepartmentRequest = {
  name: string;
  shortName?: string | null;
  parentDepartmentId?: string | null;
};

function getErrorText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";

  const errorPayload = payload as ApiErrorResponse;
  return errorPayload.message || errorPayload.error || "";
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  const contentType = response.headers.get("content-type") ?? "";
  let payload: T | ApiErrorResponse | null = null;

  if (contentType.includes("application/json")) {
    try {
      payload = (await response.json()) as T | ApiErrorResponse;
    } catch {
      payload = null;
    }
  } else {
    try {
      const text = await response.text();
      payload = text ? ({ message: text } as ApiErrorResponse) : null;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new Error(getErrorText(payload) || "Не удалось выполнить запрос к серверу.");
  }

  return payload as T;
}

export function fetchDepartmentById(departmentId: string): Promise<DepartmentNodeResponse> {
  return requestJson<DepartmentNodeResponse>(`/api/departments/${encodeURIComponent(departmentId)}`);
}

export function fetchDepartmentHierarchy(): Promise<FlatDepartmentNodeResponse[]> {
  return requestJson<FlatDepartmentNodeResponse[]>("/api/departments/hierarchy");
}

export function createDepartment(data: CreateDepartmentRequest): Promise<string> {
  return requestJson<string>("/api/departments", {
    method: "POST",
    body: JSON.stringify(data)
  });
}