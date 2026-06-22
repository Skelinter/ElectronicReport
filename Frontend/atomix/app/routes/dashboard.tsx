import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppModal } from "~/components/app-modal";
import { SvgIcon } from "~/components/svg-icon";
import { getApiBaseUrl, getStoredAuthUser } from "~/lib/auth";

type ToastState = {
  message: string;
  type: "success" | "info";
};

type ApiErrorResponse = {
  message?: string;
  error?: string;
};

type ShiftStartScheduleItem = {
  scheduleId: string;
  name: string;
  sortOrder?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  crossesMidnight?: boolean | null;
};

type ShiftStartContextResponse = {
  engineerUserId: string;
  departmentId: string;
  departmentName: string;
  schedules: ShiftStartScheduleItem[];
};

type WorkspaceCurrentShiftResponse = {
  shiftId: string;
  departmentId: string;
  departmentName: string;
  scheduleId: string;
  scheduleName: string;
  startedAt: string;
  plannedEndAt?: string | null;
  status: string;
};

type WorkspaceCurrentReportResponse = {
  reportId: string;
  status: string;
};

type WorkspaceCurrentResponse = {
  workspaceStatus:
    | "NO_ACTIVE_SHIFT"
    | "ACTIVE_SHIFT"
    | "AUTO_CLOSED_SHIFT"
    | string;
  autoClosed?: boolean | null;
  autoCloseReason?: string | null;
  message?: string | null;
  shift?: WorkspaceCurrentShiftResponse | null;
  report?: WorkspaceCurrentReportResponse | null;
};

type OpenShiftResponse = {
  shiftId: string;
  reportId: string;
  templateId: string;
  templateName: string;
  shiftStatus: string;
  reportStatus: string;
  startedAt: string;
  departmentId: string;
  scheduleId: string;
  engineerUserId: string;
  previousShiftFound: boolean;
  previousShiftId?: string | null;
  previousShiftStatus?: string | null;
  previousShiftMessage?: string | null;
};

type ReportFormItemResponse = {
  attributeId: string;
  name: string;
  nodeType: "section" | "metric" | string;
  sortOrder?: number | null;
  isRequired?: boolean | null;
  isNumbered?: boolean | null;
  displayStyle?: string | null;
  dataType?: string | null;
  unit?: string | null;
  value?: string | null;
};

type ReportFormGroupResponse = {
  groupId: string;
  name: string;
  description?: string | null;
  sortOrder?: number | null;
  attributes: ReportFormItemResponse[];
};

type ShiftReportFormResponse = {
  shiftId: string;
  reportId: string;
  templateId: string;
  templateName: string;
  reportStatus: string;
  groups: ReportFormGroupResponse[];
};

type SaveReportValuesResponse = {
  reportId: string;
  savedCount: number;
};

type ReportValues = Record<string, string>;

type ReportTableRow = ReportFormItemResponse & {
  rowNumber?: number;
  isEditable: boolean;
};

type GroupedReportSection = {
  title: string;
  rows: ReportTableRow[];
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
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
    const backendMessage =
      payload && typeof payload === "object" && "message" in payload
        ? payload.message
        : "";
    const fallbackError =
      payload && typeof payload === "object" && "error" in payload
        ? payload.error
        : "";
    throw new Error(
      backendMessage ||
        fallbackError ||
        "Не удалось выполнить запрос к серверу.",
    );
  }

  return payload as T;
}

function formatRussianDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("ru-RU");
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatScheduleClock(value?: string | null): string {
  if (!value) return "—";
  return value.slice(0, 5);
}

function formatScheduleRange(schedule?: ShiftStartScheduleItem | null): string {
  if (!schedule) return "—";
  const start = formatScheduleClock(schedule.startTime);
  const end = formatScheduleClock(schedule.endTime);
  return `${start} – ${end}`;
}

const PREVIOUS_SHIFT_STORAGE_PREFIX = "atomix.dashboard.previousShift.";

function getPreviousShiftStorageKey(shiftId: string): string {
  return `${PREVIOUS_SHIFT_STORAGE_PREFIX}${shiftId}`;
}

function readStoredPreviousShiftId(shiftId?: string | null): string | null {
  if (!shiftId || typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(getPreviousShiftStorageKey(shiftId));
  } catch {
    return null;
  }
}

function saveStoredPreviousShiftId(
  shiftId?: string | null,
  previousShiftId?: string | null,
): void {
  if (!shiftId || typeof window === "undefined") return;

  try {
    const key = getPreviousShiftStorageKey(shiftId);

    if (previousShiftId) {
      window.localStorage.setItem(key, previousShiftId);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Если localStorage недоступен, копирование просто не будет восстановлено после перезагрузки.
  }
}

function isMetricReportItem(item: ReportFormItemResponse): boolean {
  return item.nodeType?.toLowerCase() === "metric";
}

function getReportFormAttributes(
  form: ShiftReportFormResponse | null,
): ReportFormItemResponse[] {
  if (!form) return [];

  return form.groups
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .flatMap((group) =>
      group.attributes
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    );
}

function buildCopiedReportValuesFromShiftForm(
  currentReportForm: ShiftReportFormResponse,
  sourceReportForm: ShiftReportFormResponse,
): ReportValues {
  const sourceValuesByAttributeId = getReportFormAttributes(
    sourceReportForm,
  ).reduce<Record<string, string>>((acc, item) => {
    if (isMetricReportItem(item)) {
      acc[item.attributeId] = item.value ?? "";
    }
    return acc;
  }, {});

  return getReportFormAttributes(currentReportForm).reduce<ReportValues>(
    (acc, item) => {
      if (isMetricReportItem(item)) {
        acc[item.attributeId] = sourceValuesByAttributeId[item.attributeId] ?? "";
      }
      return acc;
    },
    {},
  );
}

function isNumericField(item: ReportFormItemResponse): boolean {
  const dataType = item.dataType?.toLowerCase() ?? "";
  return (
    dataType.includes("int") ||
    dataType.includes("number") ||
    dataType.includes("decimal") ||
    dataType.includes("numeric")
  );
}

function sanitizeFieldValue(
  item: ReportFormItemResponse,
  value: string,
): string {
  return isNumericField(item) ? value.replace(/[^\d.,-]/g, "") : value;
}

function buildInitialReportValues(
  form: ShiftReportFormResponse | null,
): ReportValues {
  return getReportFormAttributes(form).reduce<ReportValues>((acc, item) => {
    if (item.nodeType === "metric") {
      acc[item.attributeId] = item.value ?? "";
    }
    return acc;
  }, {});
}

function groupReportSections(
  form: ShiftReportFormResponse | null,
): GroupedReportSection[] {
  if (!form) return [];

  let rowNumber = 0;

  return form.groups
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((group) => {
      const rows = (group.attributes ?? [])
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map<ReportTableRow>((item) => {
          const shouldNumber = item.isNumbered !== false;

          if (shouldNumber) {
            rowNumber += 1;
          }

          return {
            ...item,
            rowNumber: shouldNumber ? rowNumber : undefined,
            isEditable: item.nodeType === "metric",
          };
        });

      return {
        title: group.name,
        rows,
      };
    })
    .filter((section) => section.rows.length > 0);
}

function getMinutesFromTimeString(value?: string | null): number | null {
  if (!value) return null;

  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return hours * 60 + minutes;
}

function getDefaultScheduleId(schedules: ShiftStartScheduleItem[]): string {
  if (!schedules.length) return "";

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const matchingSchedule = schedules.find((schedule) => {
    const startMinutes = getMinutesFromTimeString(schedule.startTime);
    const endMinutes = getMinutesFromTimeString(schedule.endTime);

    if (startMinutes === null || endMinutes === null) return false;

    if (schedule.crossesMidnight) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  });

  return matchingSchedule?.scheduleId ?? schedules[0].scheduleId;
}

function canStartScheduleNow(schedule?: ShiftStartScheduleItem | null): boolean {
  const endMinutes = getMinutesFromTimeString(schedule?.endTime);

  if (endMinutes === null) return true;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return currentMinutes < endMinutes;
}

function findScheduleById(
  schedules: ShiftStartScheduleItem[],
  scheduleId?: string | null,
): ShiftStartScheduleItem | null {
  if (!scheduleId) return null;
  return (
    schedules.find((schedule) => schedule.scheduleId === scheduleId) ?? null
  );
}

function buildPrintTable(
  reportForm: ShiftReportFormResponse,
  sections: GroupedReportSection[],
  values: ReportValues,
  shift: WorkspaceCurrentShiftResponse | null,
  departmentName: string,
): string {
  const bodyRows = sections
    .map((section) => {
      const sectionRow = `<tr><td colspan="2" class="section">${section.title}</td></tr>`;
      const valueRows = section.rows
        .map((item) => {
          const value = item.isEditable ? values[item.attributeId] || "—" : "—";
          const unit = item.unit
            ? `<div class="unit-text">${item.unit}</div>`
            : "";
          const number = item.rowNumber
            ? `<div class="row-number">${item.rowNumber}</div>`
            : `<div class="row-number row-number--empty"></div>`;

          return `
            <tr class="${item.nodeType === "section" ? "subsection-row" : ""}">
              <td class="label-cell">
                ${number}
                <div>
                  <div class="label-text">${item.name}</div>
                  ${unit}
                </div>
              </td>
              <td>${value}</td>
            </tr>
          `;
        })
        .join("");

      return sectionRow + valueRows;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <title>Отчет за смену</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; padding: 28px; }
          .title { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
          .subtitle { font-size: 14px; color: #4b5563; margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 18px; }
          th, td { border: 1px solid #98a4b3; padding: 10px 12px; vertical-align: top; font-size: 13px; }
          th { background: #f2f5f8; text-align: center; font-weight: 700; }
          .section { background: #eef5fd; color: #2b67b2; font-weight: 700; text-align: left; }
          .label-cell { width: 68%; text-align: left; }
          .row-number { display: inline-block; min-width: 18px; margin-right: 8px; color: #2b67b2; font-weight: 700; }
          .row-number--empty { color: transparent; }
          .subsection-row .label-text { font-weight: 700; }
          .label-text { display: inline; font-weight: 500; }
          .unit-text { margin-top: 4px; color: #6b7280; font-style: italic; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="title">${reportForm.templateName || "Отчет за смену"}</div>
        <div class="subtitle">Подразделение: ${departmentName || "—"}</div>
        <div class="subtitle">Смена: ${shift?.scheduleName || "—"}</div>
        <div class="subtitle">Дата начала: ${formatDateTime(shift?.startedAt)}</div>
        <table>
          <thead>
            <tr>
              <th style="width:68%">Наименование отчетной позиции</th>
              <th>Значение</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

export default function DashboardPage(): React.ReactElement {
  const authUser = getStoredAuthUser();

  const [toast, setToast] = useState<ToastState | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [isPreviousShiftLoading, setIsPreviousShiftLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [startContext, setStartContext] =
    useState<ShiftStartContextResponse | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceCurrentResponse | null>(
    null,
  );
  const [reportForm, setReportForm] = useState<ShiftReportFormResponse | null>(
    null,
  );
  const [reportValues, setReportValues] = useState<ReportValues>({});
  const [savedReportValues, setSavedReportValues] = useState<ReportValues>({});
  const [previousShiftValues, setPreviousShiftValues] =
    useState<ReportValues | null>(null);
  const [previousShiftSourceId, setPreviousShiftSourceId] = useState<
    string | null
  >(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState(false);
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);

  const showToast = useCallback(
    (message: string, type: ToastState["type"] = "success") => {
      setToast({ message, type });
    },
    [],
  );

  const loadReportForm = useCallback(async (shiftId: string) => {
    setIsReportLoading(true);

    try {
      const form = await requestJson<ShiftReportFormResponse>(
        `/api/shifts/${shiftId}/report-form`,
      );
      const initialValues = buildInitialReportValues(form);
      setReportForm(form);
      setReportValues(initialValues);
      setSavedReportValues(initialValues);
      setPreviousShiftValues(null);
    } finally {
      setIsReportLoading(false);
    }
  }, []);

  const syncWorkspace = useCallback(async () => {
    if (!authUser?.userId) {
      setErrorMessage(
        "Не удалось определить пользователя. Выполните вход заново.",
      );
      setIsInitialLoading(false);
      return;
    }

    setIsInitialLoading(true);
    setErrorMessage("");

    try {
      const [context, currentWorkspace] = await Promise.all([
        requestJson<ShiftStartContextResponse>(
          `/api/shifts/start-context?userId=${authUser.userId}`,
        ),
        requestJson<WorkspaceCurrentResponse>(
          `/api/shifts/workspace/current?userId=${authUser.userId}`,
        ),
      ]);

      setStartContext(context);
      setSelectedScheduleId(
        (prev) => prev || getDefaultScheduleId(context.schedules),
      );
      setWorkspace(currentWorkspace);
      setLastSavedAt("");

      if (
        currentWorkspace.workspaceStatus === "ACTIVE_SHIFT" &&
        currentWorkspace.shift?.shiftId
      ) {
        setPreviousShiftSourceId(
          readStoredPreviousShiftId(currentWorkspace.shift.shiftId),
        );
        await loadReportForm(currentWorkspace.shift.shiftId);
      } else {
        setReportForm(null);
        setReportValues({});
        setSavedReportValues({});
        setPreviousShiftValues(null);
        setPreviousShiftSourceId(null);

        if (
          currentWorkspace.workspaceStatus === "AUTO_CLOSED_SHIFT" &&
          currentWorkspace.message
        ) {
          showToast(currentWorkspace.message, "info");
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось загрузить данные по смене.";
      setErrorMessage(message);
      setWorkspace(null);
      setReportForm(null);
      setReportValues({});
      setSavedReportValues({});
      setPreviousShiftValues(null);
      setPreviousShiftSourceId(null);
    } finally {
      setIsInitialLoading(false);
    }
  }, [authUser?.userId, loadReportForm, showToast]);

  useEffect(() => {
    void syncWorkspace();
  }, [syncWorkspace]);

  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const reportSections = useMemo(
    () => groupReportSections(reportForm),
    [reportForm],
  );

  const totalFilledFields = useMemo(() => {
    return reportSections
      .flatMap((section) => section.rows)
      .filter((item) => (reportValues[item.attributeId] ?? "").trim() !== "")
      .length;
  }, [reportSections, reportValues]);

  const activeShift =
    workspace?.workspaceStatus === "ACTIVE_SHIFT"
      ? (workspace.shift ?? null)
      : null;
  const availableSchedules = startContext?.schedules ?? [];
  const selectedSchedule = findScheduleById(
    availableSchedules,
    selectedScheduleId,
  );
  const isSelectedScheduleStartAvailable = canStartScheduleNow(selectedSchedule);
  const hasStartedShift = Boolean(activeShift);
  const hasActiveShift = Boolean(activeShift && reportForm);
  const isShiftStateLoading =
    isInitialLoading ||
    (hasStartedShift && (isReportLoading || !reportForm));
  const hasUnsavedChanges = useMemo(() => {
    if (!reportForm) return false;

    return getReportFormAttributes(reportForm)
      .filter((item) => item.nodeType === "metric")
      .some(
        (item) =>
          (reportValues[item.attributeId] ?? "") !==
          (savedReportValues[item.attributeId] ?? ""),
      );
  }, [reportForm, reportValues, savedReportValues]);

  const handleValueChange = (
    item: ReportFormItemResponse,
    value: string,
  ): void => {
    setReportValues((prev) => ({
      ...prev,
      [item.attributeId]: sanitizeFieldValue(item, value),
    }));
  };

  const loadPreviousShiftValues = useCallback(async (): Promise<void> => {
    if (!previousShiftSourceId || !reportForm) {
      setPreviousShiftValues(null);
      return;
    }

    setIsPreviousShiftLoading(true);

    try {
      const sourceReportForm = await requestJson<ShiftReportFormResponse>(
        `/api/shifts/${previousShiftSourceId}/report-form`,
      );

      setPreviousShiftValues(
        buildCopiedReportValuesFromShiftForm(reportForm, sourceReportForm),
      );
    } catch {
      setPreviousShiftValues(null);
    } finally {
      setIsPreviousShiftLoading(false);
    }
  }, [previousShiftSourceId, reportForm]);

  useEffect(() => {
    if (!hasActiveShift || !reportForm) {
      setPreviousShiftValues(null);
      return;
    }

    void loadPreviousShiftValues();
  }, [hasActiveShift, loadPreviousShiftValues, reportForm]);

  const persistReportValues = useCallback(
    async (successMessage?: string): Promise<boolean> => {
      if (!reportForm || !authUser?.userId) {
        showToast("Не удалось определить активный отчет.", "info");
        return false;
      }

      const values = getReportFormAttributes(reportForm)
        .filter((item) => item.nodeType === "metric")
        .map((item) => ({
          attributeId: item.attributeId,
          value: reportValues[item.attributeId] ?? "",
        }));

      setIsSavingReport(true);

      try {
        await requestJson<SaveReportValuesResponse>(
          `/api/reports/${reportForm.reportId}/values`,
          {
            method: "PUT",
            body: JSON.stringify({
              changedByUserId: authUser.userId,
              comment: "",
              values,
            }),
          },
        );

        setSavedReportValues({ ...reportValues });
        setLastSavedAt(formatSavedTime(new Date()));

        if (successMessage) {
          showToast(successMessage);
        }

        return true;
      } finally {
        setIsSavingReport(false);
      }
    },
    [authUser?.userId, reportForm, reportValues, showToast],
  );

  const handleOpenShift = async (): Promise<void> => {
    if (!startContext) {
      showToast("Не удалось загрузить данные для начала смены.", "info");
      return;
    }

    if (!selectedScheduleId) {
      showToast("Выберите смену перед началом работы.", "info");
      return;
    }

    if (!canStartScheduleNow(selectedSchedule)) {
      showToast("Сейчас нельзя начать выбранную смену", "info");
      return;
    }

    setIsActionLoading(true);

    try {
      const response = await requestJson<OpenShiftResponse>("/api/shifts", {
        method: "POST",
        body: JSON.stringify({
          departmentId: startContext.departmentId,
          scheduleId: selectedScheduleId,
          engineerUserId: startContext.engineerUserId,
          startedAt: new Date().toISOString(),
        }),
      });

      saveStoredPreviousShiftId(response.shiftId, response.previousShiftId);
      setPreviousShiftSourceId(response.previousShiftId ?? null);

      setIsStartShiftModalOpen(false);
      await syncWorkspace();

      const additionalMessage = response.previousShiftMessage
        ? ` ${response.previousShiftMessage}.`
        : "";
      showToast(`Смена начата.${additionalMessage}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось начать смену.";
      showToast(message, "info");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!hasActiveShift) {
      setIsStartShiftModalOpen(true);
      showToast("Сначала начните смену.", "info");
      return;
    }

    setIsActionLoading(true);

    try {
      await persistReportValues("Результаты успешно сохранены.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось сохранить отчет.";
      showToast(message, "info");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmFinishShift = async (): Promise<void> => {
    if (!activeShift?.shiftId) {
      showToast("Активная смена не найдена.", "info");
      return;
    }

    setIsActionLoading(true);

    try {
      await persistReportValues();
      await requestJson<void>(`/api/shifts/${activeShift.shiftId}/complete`, {
        method: "POST",
      });

      setIsFinishConfirmOpen(false);
      await syncWorkspace();
      showToast("Смена завершена. Можно начать следующую.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось завершить смену.";
      showToast(message, "info");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCopyPreviousShift = (): void => {
    if (!hasActiveShift || !reportForm) {
      showToast("Нет активного отчета для копирования.", "info");
      return;
    }

    if (!previousShiftValues) {
      showToast("Последняя смена с данными не найдена.", "info");
      return;
    }

    setReportValues((prev) => {
      const nextValues = { ...prev };

      getReportFormAttributes(reportForm)
        .filter((item) => item.nodeType === "metric")
        .forEach((item) => {
          nextValues[item.attributeId] =
            previousShiftValues[item.attributeId] ?? "";
        });

      return nextValues;
    });

    showToast("Результаты последней смены скопированы.");
  };

  const handlePrint = (): void => {
    if (!reportForm || !activeShift) {
      showToast("Нет активного отчета для печати.", "info");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      showToast("Не удалось открыть окно печати.", "info");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintTable(
        reportForm,
        reportSections,
        reportValues,
        activeShift,
        startContext?.departmentName ?? "",
      ),
    );
    printWindow.document.close();
    printWindow.focus();

    window.setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const isBusy = isInitialLoading || isActionLoading || isReportLoading;
  const saveStatusVariant = isSavingReport
    ? "saving"
    : hasUnsavedChanges
      ? "unsaved"
      : "saved";
  const saveStatusLabel = isSavingReport
    ? "Сохранение..."
    : hasUnsavedChanges
      ? "Изменения не сохранены"
      : "Изменения сохранены";

  return (
    <div className="dashboard-page">
      <div className="dashboard-toolbar">
        <div className="dashboard-toolbar__left">
          <h1 className="ui-page__title">Отчет за смену</h1>
          {hasActiveShift ? (
            <button
              type="button"
              className="btn btn--success dashboard-toolbar__save"
              onClick={() => void handleSave()}
              disabled={isBusy}
            >
              <SvgIcon name="save" />
              <span>{isSavingReport ? "Сохранение..." : "Сохранить"}</span>
            </button>
          ) : null}
        </div>

        {isShiftStateLoading ? (
          <div className="dashboard-status">
            <span className="status-badge status-badge--info">
              Загрузка...
            </span>
          </div>
        ) : hasStartedShift ? (
          <div className="dashboard-toolbar__right">
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setIsFinishConfirmOpen(true)}
              disabled={isBusy || !hasActiveShift}
            >
              <SvgIcon name="finish" />
              <span>Завершить смену</span>
            </button>
          </div>
        ) : (
          <div className="dashboard-status">
            <span className="status-badge status-badge--danger">
              Смена не начата
            </span>
            <button
              type="button"
              className="btn btn--success btn--small"
              onClick={() => setIsStartShiftModalOpen(true)}
              disabled={isBusy || !startContext}
            >
              Начать смену
            </button>
          </div>
        )}
      </div>

      <div className="ui-divider" />

      {errorMessage ? (
        <div className="ui-card ui-card__body dashboard-error-card">
          <div className="dashboard-error-card__content">
            <span className="dashboard-error-card__text">{errorMessage}</span>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void syncWorkspace()}
              disabled={isBusy}
            >
              Повторить загрузку
            </button>
          </div>
        </div>
      ) : null}

      <div className="dashboard-controls">
        <div className="dashboard-controls__left">
          <div className="dashboard-meta-pill">
            <span className="dashboard-meta-pill__label">Подразделение</span>
            <span className="dashboard-meta-pill__value">
              {activeShift?.departmentName ||
                startContext?.departmentName ||
                "—"}
            </span>
          </div>

          <div className="dashboard-meta-pill">
            <span className="dashboard-meta-pill__label">Смена</span>
            <span className="dashboard-meta-pill__value">
              {activeShift?.scheduleName || selectedSchedule?.name || "—"}
            </span>
          </div>

          <div className="dashboard-meta-pill">
            <span className="dashboard-meta-pill__label">Начало</span>
            <span className="dashboard-meta-pill__value">
              {formatDateTime(activeShift?.startedAt)}
            </span>
          </div>

          <div className="dashboard-meta-pill">
            <span className="dashboard-meta-pill__label">
              Плановое завершение
            </span>
            <span className="dashboard-meta-pill__value">
              {formatDateTime(activeShift?.plannedEndAt)}
            </span>
          </div>
        </div>

        {hasActiveShift ? (
          <div className="dashboard-controls__right">
            <span
              className={`status-badge dashboard-save-status dashboard-save-status--${saveStatusVariant}`}
            >
              {saveStatusLabel}
            </span>

            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleCopyPreviousShift}
              disabled={
                isBusy || isPreviousShiftLoading || !previousShiftValues
              }
            >
              <SvgIcon name="copy" />
              <span>
                {isPreviousShiftLoading
                  ? "Поиск данных..."
                  : "Копировать результаты последней смены"}
              </span>
            </button>

            <button
              type="button"
              className="btn btn--info"
              onClick={handlePrint}
              disabled={isBusy}
            >
              <SvgIcon name="print" />
              <span>Печать</span>
            </button>
          </div>
        ) : null}
      </div>

      {isInitialLoading ? (
        <div className="ui-card ui-card__body dashboard-empty">
          <span className="dashboard-empty__hint">
            Загрузка рабочего места...
          </span>
        </div>
      ) : hasActiveShift ? (
        <div className="ui-card dashboard-card">
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th className="dashboard-table__head-left">
                    Наименование отчетной позиции
                  </th>
                  <th className="dashboard-table__head-right">Значения</th>
                </tr>
              </thead>
              <tbody>
                {reportSections.map((section) => (
                  <React.Fragment key={section.title}>
                    <tr className="dashboard-table__section">
                      <td colSpan={2}>{section.title}</td>
                    </tr>

                    {section.rows.map((item) => (
                      <tr
                        key={item.attributeId}
                        className={
                          item.nodeType === "section"
                            ? "dashboard-table__subsection-row"
                            : undefined
                        }
                      >
                        <td className="dashboard-table__label">
                          <div className="dashboard-table__label-content">
                            {item.rowNumber ? (
                              <span className="dashboard-table__num">
                                {item.rowNumber}
                              </span>
                            ) : (
                              <span className="dashboard-table__num dashboard-table__num--empty" />
                            )}
                            <div className="dashboard-table__text">
                              <div className="dashboard-table__field">
                                {item.name}
                                {item.isRequired ? (
                                  <span className="dashboard-required-mark">
                                    {" "}
                                    *
                                  </span>
                                ) : null}
                              </div>
                              {item.unit ? (
                                <div className="dashboard-table__unit">
                                  {item.unit}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="dashboard-table__value">
                          {item.isEditable ? (
                            <input
                              className="dashboard-value-input"
                              type="text"
                              inputMode={
                                isNumericField(item) ? "decimal" : "text"
                              }
                              value={reportValues[item.attributeId] ?? ""}
                              onChange={(e) =>
                                handleValueChange(item, e.target.value)
                              }
                              disabled={isBusy}
                            />
                          ) : (
                            <span className="dashboard-table__readonly-value">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="dashboard-footer ui-card__body">
            <span>Заполнено полей: {totalFilledFields}</span>
            <span>
              {lastSavedAt
                ? `Последнее сохранение: ${lastSavedAt}`
                : "Данные не сохранены"}
            </span>
          </div>
        </div>
      ) : (
        <div className="ui-card ui-card__body dashboard-empty">
          <span className="dashboard-empty__hint">
            Начните смену чтобы загрузить отчет.
          </span>
        </div>
      )}

      <AppModal
        open={isStartShiftModalOpen}
        title="Начать смену?"
        description="После начала смены будет доступен отчет для заполнения."
        bodyAlign="left"
        onClose={() => !isActionLoading && setIsStartShiftModalOpen(false)}
        actions={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setIsStartShiftModalOpen(false)}
              disabled={isActionLoading}
            >
              Нет
            </button>
            <button
              type="button"
              className="btn btn--success"
              onClick={() => void handleOpenShift()}
              disabled={isActionLoading || !selectedScheduleId}
            >
              {isActionLoading ? "Запуск..." : "Да"}
            </button>
          </>
        }
      >
        <div className="dashboard-modal-fields">
          <div className="ui-field">
            <span className="ui-field__label">Подразделение</span>
            <div className="dashboard-modal-value">
              {startContext?.departmentName || "—"}
            </div>
          </div>

          <div className="ui-field">
            <label
              className="ui-field__label"
              htmlFor="dashboard-start-shift-select"
            >
              Смена
            </label>
            <div className="ui-select-wrap">
              <select
                id="dashboard-start-shift-select"
                className="ui-select dashboard-shift"
                value={selectedScheduleId}
                onChange={(e) => setSelectedScheduleId(e.target.value)}
                disabled={isActionLoading}
              >
                {availableSchedules.map((schedule) => (
                  <option key={schedule.scheduleId} value={schedule.scheduleId}>
                    {schedule.name} ({formatScheduleRange(schedule)})
                  </option>
                ))}
              </select>
              <SvgIcon name="chevron-down" className="ui-select-wrap__icon" />
            </div>
          </div>

          <div className="dashboard-modal-note">
            Время выбранной смены: {formatScheduleRange(selectedSchedule)}
          </div>

          {!isSelectedScheduleStartAvailable ? (
            <div className="dashboard-modal-note">
              Сейчас нельзя начать выбранную смену
            </div>
          ) : null}
        </div>
      </AppModal>

      <AppModal
        open={isFinishConfirmOpen}
        title="Завершить смену?"
        description="Перед завершением текущие значения будут сохранены."
        bodyAlign="center"
        onClose={() => !isActionLoading && setIsFinishConfirmOpen(false)}
        actions={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setIsFinishConfirmOpen(false)}
              disabled={isActionLoading}
            >
              Нет
            </button>
            <button
              type="button"
              className="btn btn--success"
              onClick={() => void handleConfirmFinishShift()}
              disabled={isActionLoading}
            >
              {isActionLoading ? "Завершение..." : "Да"}
            </button>
          </>
        }
      />

      {toast ? (
        <div className={`toast toast--${toast.type}`}>{toast.message}</div>
      ) : null}
    </div>
  );
}
