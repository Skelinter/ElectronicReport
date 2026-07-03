import { getApiBaseUrl } from "~/lib/auth";

export type ApiErrorResponse = {
  message?: string;
  error?: string;
};

export type EmployeeDepartmentOptionResponse = {
  departmentId: string;
  parentDepartmentId?: string | null;
  name: string;
  shortName?: string | null;
  hierarchyLevel?: number | null;
  isActive?: boolean | null;
};

export type EmployeeFilterContextResponse = {
  departments?: EmployeeDepartmentOptionResponse[] | null;
};

export type ReportPeriodColumnResponse = {
  columnKey: string;
  date: string;
  scheduleId?: string | null;
  scheduleName?: string | null;
  shiftLabel?: string | null;
  timeLabel?: string | null;
  columnStatus?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  shiftId?: string | null;
  reportId?: string | null;
};

export type ReportPeriodCellResponse = {
  attributeValueId?: string | null;
  value?: string | null;
  changedAt?: string | null;
  reportId?: string | null;
  shiftId?: string | null;
};

export type ReportPeriodRowResponse = {
  rowKey: string;
  attributeId: string;
  name: string;
  nodeType?: string | null;
  sortOrder?: number | null;
  isNumbered?: boolean | null;
  displayStyle?: string | null;
  dataType?: string | null;
  unit?: string | null;
  values?: Record<string, ReportPeriodCellResponse | null> | null;
};

export type ReportPeriodTableResponse = {
  departmentId: string;
  departmentName: string;
  period: {
    dateFrom: string;
    dateTo: string;
  };
  columns: ReportPeriodColumnResponse[];
  rows: ReportPeriodRowResponse[];
};

export type ReportsArchiveItemResponse = {
  id?: string | null;
  reportId?: string | null;
  date?: string | null;
  reportDate?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentShortName?: string | null;
  status?: string | null;
  reportStatus?: string | null;
};

export type ReportsArchiveResponse = {
  reports?: ReportsArchiveItemResponse[] | null;
  items?: ReportsArchiveItemResponse[] | null;
  content?: ReportsArchiveItemResponse[] | null;
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

export async function requestBlob(path: string, init?: RequestInit, fallbackMimeType?: string): Promise<Blob> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      try {
        const payload = (await response.json()) as ApiErrorResponse;
        throw new Error(getErrorText(payload) || "Не удалось выполнить запрос к серверу.");
      } catch (error) {
        if (error instanceof Error) throw error;
      }
    }

    try {
      const text = await response.text();
      throw new Error(text || "Не удалось выполнить запрос к серверу.");
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("Не удалось выполнить запрос к серверу.");
    }
  }

  const responseMimeType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  const blobMimeType = responseMimeType && responseMimeType !== "application/octet-stream"
    ? responseMimeType
    : fallbackMimeType || responseMimeType || "application/octet-stream";
  const buffer = await response.arrayBuffer();

  return new Blob([buffer], { type: blobMimeType });
}

export function fetchReportDepartments(userId: string): Promise<EmployeeFilterContextResponse> {
  return requestJson<EmployeeFilterContextResponse>(`/api/employees/filter-context?userId=${encodeURIComponent(userId)}`);
}

export function fetchDailyReport(departmentId: string, date: string): Promise<ReportPeriodTableResponse> {
  const params = new URLSearchParams({
    departmentId,
    dateFrom: date,
    dateTo: date
  });

  return requestJson<ReportPeriodTableResponse>(`/api/reports/period?${params.toString()}`);
}

export function fetchReportPeriod(departmentId: string, dateFrom: string, dateTo: string): Promise<ReportPeriodTableResponse> {
  const params = new URLSearchParams({
    departmentId,
    dateFrom,
    dateTo
  });

  return requestJson<ReportPeriodTableResponse>(`/api/reports/period?${params.toString()}`);
}

export function fetchReportsArchive(dateFrom: string, dateTo: string, departmentId?: string): Promise<ReportsArchiveResponse> {
  const params = new URLSearchParams({ dateFrom, dateTo });

  if (departmentId && departmentId !== "all") {
    params.set("departmentId", departmentId);
  }

  return requestJson<ReportsArchiveResponse>(`/api/reports?${params.toString()}`);
}

export function formatDateForDailyReportPdf(date: string): string {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}-${month}-${year}`;
}

export function fetchDailyReportPdf(departmentId: string, date: string): Promise<Blob> {
  const params = new URLSearchParams({
    departmentId,
    date: formatDateForDailyReportPdf(date)
  });

  return requestBlob(`/api/reports/daily/pdf?${params.toString()}`, undefined, "application/pdf");
}

export type PagedReportItem = {
  departmentId: string;
  departmentName: string;
  departmentShortName: string;
  date: string;           // LocalDate в формате YYYY-MM-DD
  shiftId: string | null;
  reportId: string | null;
};

export type PagedReportsResponse = {
  content: PagedReportItem[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;        // номер текущей страницы (0‑индекс)
};

export function fetchPagedReports(
  departmentId: string | null,
  dateFrom: string,
  dateTo: string,
  search: string,
  page: number,
  pageSize: number
): Promise<PagedReportsResponse> {
  const params = new URLSearchParams();
  if (departmentId) params.append('departmentId', departmentId);
  params.append('dateFrom', dateFrom);
  params.append('dateTo', dateTo);
  if (search) params.append('search', search);
  params.append('page', String(page));
  params.append('size', String(pageSize));

  return requestJson<PagedReportsResponse>(`/api/reports/paged?${params.toString()}`);
}
