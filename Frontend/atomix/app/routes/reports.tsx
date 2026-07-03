import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { SvgIcon } from "~/components/svg-icon";
import { UiPagination } from "~/components/ui-pagination";
import {
  fetchReportDepartments,
  fetchPagedReports,
  type EmployeeDepartmentOptionResponse,
  type PagedReportItem,
} from "~/components/reportApi";
import { getStoredAuthUser } from "~/lib/auth";

type DatePeriodMode = "all" | "single" | "range";

const ALL_REPORTS_DATE_FROM = "2000-01-01";
const REPORTS_PAGE_SIZE = 10;

function getTodayIsoDate(): string {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function formatRussianDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateForPeriodInput(value: string): string {
  if (!value) return "";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function parsePeriodInputDate(value: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) return "";

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);
  if (isoMatch) return trimmedValue;

  const ruMatch = /^(\d{2})[./-](\d{2})[./-](\d{4})$/.exec(trimmedValue);
  if (!ruMatch) return "";

  const [, day, month, year] = ruMatch;
  const isoDate = `${year}-${month}-${day}`;
  const date = new Date(`${isoDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "";
  if (formatDateForPeriodInput(isoDate) !== `${day}/${month}/${year}`) return "";

  return isoDate;
}

function formatDatePeriodLabel(dateFrom: string, dateTo: string): string {
  if (!dateFrom && !dateTo) return "Выберите дату";
  if (dateFrom && (!dateTo || dateFrom === dateTo)) return `За ${formatRussianDate(dateFrom)}`;
  if (!dateFrom && dateTo) return `До ${formatRussianDate(dateTo)}`;

  return `${formatRussianDate(dateFrom)} — ${formatRussianDate(dateTo)}`;
}

function getDepartmentLabel(department: EmployeeDepartmentOptionResponse): string {
  return department.shortName?.trim() || department.name || "Без названия";
}

export default function ReportsPage(): React.ReactElement {
  const navigate = useNavigate();
  const authUser = useMemo(() => getStoredAuthUser(), []);
  const today = useMemo(() => getTodayIsoDate(), []);
  const datePickerRef = useRef<HTMLDivElement | null>(null);

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [isAllReportsMode, setIsAllReportsMode] = useState(true);
  const [datePeriodMode, setDatePeriodMode] = useState<DatePeriodMode>("all");
  const [draftDateFrom, setDraftDateFrom] = useState(today);
  const [draftDateTo, setDraftDateTo] = useState(today);
  const [draftDateFromText, setDraftDateFromText] = useState(formatDateForPeriodInput(today));
  const [draftDateToText, setDraftDateToText] = useState(formatDateForPeriodInput(today));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const [departments, setDepartments] = useState<EmployeeDepartmentOptionResponse[]>([]);
  const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(true);
  const [isReportsLoading, setIsReportsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [pagedContent, setPagedContent] = useState<PagedReportItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!isDatePickerOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!datePickerRef.current) return;
      if (datePickerRef.current.contains(event.target as Node)) return;
      setIsDatePickerOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDatePickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDatePickerOpen]);

  useEffect(() => {
    let isMounted = true;

    const loadDepartments = async () => {
      if (!authUser?.userId) {
        setErrorMessage("Не удалось определить текущего пользователя. Выполните вход заново.");
        setIsDepartmentsLoading(false);
        return;
      }

      try {
        setIsDepartmentsLoading(true);
        setErrorMessage("");

        const context = await fetchReportDepartments(authUser.userId);
        const activeDepartments = (context.departments ?? [])
          .filter((department) => department.departmentId && department.isActive !== false)
          .sort((a, b) => getDepartmentLabel(a).localeCompare(getDepartmentLabel(b), "ru"));

        if (!isMounted) return;

        setDepartments(activeDepartments);
        if (activeDepartments.length === 1) {
          setDepartmentId(activeDepartments[0].departmentId);
        }
      } catch (error) {
        if (!isMounted) return;
        setDepartments([]);
        setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить подразделения.");
      } finally {
        if (isMounted) {
          setIsDepartmentsLoading(false);
        }
      }
    };

    void loadDepartments();

    return () => {
      isMounted = false;
    };
  }, [authUser?.userId]);

  const requestedDateFrom = isAllReportsMode ? ALL_REPORTS_DATE_FROM : dateFrom;
  const requestedDateTo = isAllReportsMode ? today : dateTo;
  const isInvalidRange = !isAllReportsMode && Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const datePeriodLabel = isAllReportsMode ? "Все существующие рапорты" : formatDatePeriodLabel(dateFrom, dateTo);

  useEffect(() => {
    setCurrentPage(1);
  }, [departmentId, searchValue, requestedDateFrom, requestedDateTo]);

  useEffect(() => {
    let isMounted = true;

    const loadPagedReports = async () => {
      if (isDepartmentsLoading || isInvalidRange) {
        setPagedContent([]);
        setTotalItems(0);
        setTotalPages(1);
        return;
      }

      const deptId = departmentId === "all" ? null : departmentId;

      try {
        setIsReportsLoading(true);
        setErrorMessage("");

        const response = await fetchPagedReports(
          deptId,
          requestedDateFrom,
          requestedDateTo,
          searchValue,
          currentPage - 1,
          REPORTS_PAGE_SIZE
        );

        if (!isMounted) return;

        setPagedContent(response.content);
        setTotalItems(response.totalElements);
        setTotalPages(response.totalPages);
      } catch (error) {
        if (!isMounted) return;
        setPagedContent([]);
        setTotalItems(0);
        setTotalPages(1);
        setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить список рапортов.");
      } finally {
        if (isMounted) {
          setIsReportsLoading(false);
        }
      }
    };

    void loadPagedReports();

    return () => {
      isMounted = false;
    };
  }, [departmentId, requestedDateFrom, requestedDateTo, searchValue, currentPage, isDepartmentsLoading, isInvalidRange]);

  const isLoading = isDepartmentsLoading || isReportsLoading;

  const handleDatePickerToggle = (): void => {
    const nextDraftDateFrom = dateFrom || today;
    const nextDraftDateTo = dateTo || dateFrom || today;

    setDraftDateFrom(nextDraftDateFrom);
    setDraftDateTo(nextDraftDateTo);
    setDraftDateFromText(formatDateForPeriodInput(nextDraftDateFrom));
    setDraftDateToText(formatDateForPeriodInput(nextDraftDateTo));
    setDatePeriodMode(isAllReportsMode ? "all" : dateFrom && dateTo && dateFrom !== dateTo ? "range" : "single");
    setIsDatePickerOpen((prev) => !prev);
  };

  const handleApplyDatePeriod = (): void => {
    const normalizedDraftDateFrom = parsePeriodInputDate(draftDateFromText) || draftDateFrom;
    const normalizedDraftDateTo = parsePeriodInputDate(draftDateToText) || draftDateTo;

    setDraftDateFrom(normalizedDraftDateFrom);
    setDraftDateTo(normalizedDraftDateTo);
    setDraftDateFromText(formatDateForPeriodInput(normalizedDraftDateFrom));
    setDraftDateToText(formatDateForPeriodInput(normalizedDraftDateTo));

    if (datePeriodMode === "all") {
      setIsAllReportsMode(true);
      setIsDatePickerOpen(false);
      return;
    }

    setIsAllReportsMode(false);

    if (datePeriodMode === "single") {
      const selectedDate = normalizedDraftDateFrom || normalizedDraftDateTo || today;
      setDateFrom(selectedDate);
      setDateTo(selectedDate);
      setIsDatePickerOpen(false);
      return;
    }

    const selectedFrom = normalizedDraftDateFrom || normalizedDraftDateTo || today;
    const selectedTo = normalizedDraftDateTo || normalizedDraftDateFrom || selectedFrom;

    if (selectedFrom > selectedTo) {
      setDateFrom(selectedTo);
      setDateTo(selectedFrom);
    } else {
      setDateFrom(selectedFrom);
      setDateTo(selectedTo);
    }

    setIsDatePickerOpen(false);
  };

  const handleResetDatePeriod = (): void => {
    setDatePeriodMode("all");
    setDraftDateFrom(today);
    setDraftDateTo(today);
    setDraftDateFromText(formatDateForPeriodInput(today));
    setDraftDateToText(formatDateForPeriodInput(today));
    setIsAllReportsMode(true);
    setIsDatePickerOpen(false);
  };

  const handleSelectToday = (): void => {
    setDatePeriodMode("single");
    setDraftDateFrom(today);
    setDraftDateTo(today);
    setDraftDateFromText(formatDateForPeriodInput(today));
    setDraftDateToText(formatDateForPeriodInput(today));
    setDateFrom(today);
    setDateTo(today);
    setIsAllReportsMode(false);
    setIsDatePickerOpen(false);
  };

  const handleOpenReport = (row: PagedReportItem): void => {
    const params = new URLSearchParams({
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      date: row.date,
    });

    navigate(`/reports/view?${params.toString()}`);
  };

  return (
    <div className="reports-page">
      <div className="ui-page__header reports-page__header">
        <div>
          <h1 className="ui-page__title">Рапорты</h1>
        </div>
      </div>

      <div className="ui-divider" />

      <section className="ui-card reports-filter-card">
        <div className="ui-card__body reports-filters">
          <div className="ui-field reports-filter-field reports-filter-field--period">
            <label className="ui-field__label" htmlFor="reports-date-period">Период рапортов</label>
            <div className="reports-date-period" ref={datePickerRef}>
              <button
                id="reports-date-period"
                type="button"
                className={`reports-date-period__trigger ${isDatePickerOpen ? "reports-date-period__trigger--open" : ""}`}
                aria-haspopup="dialog"
                aria-expanded={isDatePickerOpen}
                onClick={handleDatePickerToggle}
              >
                <span className="reports-date-period__trigger-copy">
                  <SvgIcon name="paper" className="reports-date-period__trigger-icon" />
                  <span>{datePeriodLabel}</span>
                </span>
                <SvgIcon name="chevron-down" className="reports-date-period__trigger-chevron" />
              </button>

              {isDatePickerOpen ? (
                <div className="reports-date-period__panel" role="dialog" aria-label="Выбор периода рапортов">
                  <div className="reports-date-period__tabs reports-date-period__tabs--three" role="tablist" aria-label="Тип периода">
                    <button
                      type="button"
                      className={`reports-date-period__tab ${datePeriodMode === "all" ? "reports-date-period__tab--active" : ""}`}
                      aria-selected={datePeriodMode === "all"}
                      onClick={() => setDatePeriodMode("all")}
                    >
                      Все
                    </button>
                    <button
                      type="button"
                      className={`reports-date-period__tab ${datePeriodMode === "single" ? "reports-date-period__tab--active" : ""}`}
                      aria-selected={datePeriodMode === "single"}
                      onClick={() => {
                        const nextDraftDate = draftDateFrom || today;

                        setDatePeriodMode("single");
                        setDraftDateTo(nextDraftDate);
                        setDraftDateToText(formatDateForPeriodInput(nextDraftDate));
                      }}
                    >
                      Один день
                    </button>
                    <button
                      type="button"
                      className={`reports-date-period__tab ${datePeriodMode === "range" ? "reports-date-period__tab--active" : ""}`}
                      aria-selected={datePeriodMode === "range"}
                      onClick={() => {
                        const nextDraftDateTo = draftDateTo || draftDateFrom || today;

                        setDatePeriodMode("range");
                        setDraftDateTo(nextDraftDateTo);
                        setDraftDateToText(formatDateForPeriodInput(nextDraftDateTo));
                      }}
                    >
                      Период
                    </button>
                  </div>

                  {datePeriodMode === "all" ? null : datePeriodMode === "single" ? (
                    <div className="ui-field reports-date-period__field">
                      <label className="ui-field__label" htmlFor="reports-single-date">Дата рапорта</label>
                      <input
                        id="reports-single-date"
                        className="ui-input"
                        type="text"
                        inputMode="numeric"
                        placeholder="дд/мм/гггг"
                        value={draftDateFromText}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          const parsedDate = parsePeriodInputDate(nextValue);

                          setDraftDateFromText(nextValue);
                          setDraftDateToText(nextValue);
                          if (parsedDate) {
                            setDraftDateFrom(parsedDate);
                            setDraftDateTo(parsedDate);
                          }
                        }}
                        onBlur={() => {
                          const parsedDate = parsePeriodInputDate(draftDateFromText) || draftDateFrom || today;

                          setDraftDateFrom(parsedDate);
                          setDraftDateTo(parsedDate);
                          setDraftDateFromText(formatDateForPeriodInput(parsedDate));
                          setDraftDateToText(formatDateForPeriodInput(parsedDate));
                        }}
                      />
                    </div>
                  ) : (
                    <div className="reports-date-period__range">
                      <div className="ui-field reports-date-period__field">
                        <label className="ui-field__label" htmlFor="reports-range-from">Дата с</label>
                        <input
                          id="reports-range-from"
                          className="ui-input"
                          type="text"
                          inputMode="numeric"
                          placeholder="дд/мм/гггг"
                          value={draftDateFromText}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            const parsedDate = parsePeriodInputDate(nextValue);

                            setDraftDateFromText(nextValue);
                            if (parsedDate) {
                              setDraftDateFrom(parsedDate);
                            }
                          }}
                          onBlur={() => {
                            const parsedDate = parsePeriodInputDate(draftDateFromText) || draftDateFrom || today;

                            setDraftDateFrom(parsedDate);
                            setDraftDateFromText(formatDateForPeriodInput(parsedDate));
                          }}
                        />
                      </div>
                      <div className="ui-field reports-date-period__field">
                        <label className="ui-field__label" htmlFor="reports-range-to">Дата по</label>
                        <input
                          id="reports-range-to"
                          className="ui-input"
                          type="text"
                          inputMode="numeric"
                          placeholder="дд/мм/гггг"
                          value={draftDateToText}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            const parsedDate = parsePeriodInputDate(nextValue);

                            setDraftDateToText(nextValue);
                            if (parsedDate) {
                              setDraftDateTo(parsedDate);
                            }
                          }}
                          onBlur={() => {
                            const parsedDate = parsePeriodInputDate(draftDateToText) || draftDateTo || draftDateFrom || today;

                            setDraftDateTo(parsedDate);
                            setDraftDateToText(formatDateForPeriodInput(parsedDate));
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="reports-date-period__hint">
                    По умолчанию показываются все найденные рапорты. При необходимости выберите день или период.
                  </div>

                  <div className="reports-date-period__actions">
                    <button type="button" className="btn btn--ghost btn--small" onClick={handleResetDatePeriod}>
                      Все рапорты
                    </button>
                    <button type="button" className="btn btn--ghost btn--small" onClick={handleSelectToday}>
                      Сегодня
                    </button>
                    <button type="button" className="btn btn--primary btn--small" onClick={handleApplyDatePeriod}>
                      Применить
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="ui-field reports-filter-field reports-filter-field--department">
            <label className="ui-field__label" htmlFor="reports-department">Подразделение</label>
            <div className="ui-select-wrap reports-select-wrap">
              <select
                id="reports-department"
                className="ui-select"
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
                disabled={isLoading || departments.length === 0}
              >
                <option value="all">Все доступные подразделения</option>
                {departments.map((department) => (
                  <option key={department.departmentId} value={department.departmentId}>
                    {getDepartmentLabel(department)}
                  </option>
                ))}
              </select>
              <SvgIcon name="chevron-down" className="ui-select-wrap__icon" />
            </div>
          </div>

          <div className="ui-search reports-searchbar">
            <span className="ui-search__icon">
              <SvgIcon name="search" />
            </span>
            <input
              className="ui-search__input"
              type="text"
              placeholder="Поиск подразделения..."
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </div>
        </div>
      </section>

      {isInvalidRange ? (
        <div className="reports-inline-note reports-inline-note--warning">
          Дата начала периода не может быть позже даты окончания.
        </div>
      ) : null}

      <section className="ui-card reports-card">
        <div className="ui-card__header">
          <div>
            <h2 className="ui-card__title">Список рапортов</h2>
          </div>
        </div>

        <div className="ui-table-wrap">
          <table className="ui-table reports-list-table">
            <thead>
              <tr>
                <th className="reports-list-table__num">№</th>
                <th className="reports-list-table__date">Дата</th>
                <th>Подразделение</th>
                <th className="reports-list-table__actions">Действия</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && pagedContent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="ui-empty reports-list-table__empty">Загрузка списка рапортов...</td>
                </tr>
              ) : pagedContent.length > 0 ? (
                pagedContent.map((row, index) => (
                  <tr key={`${row.departmentId}_${row.date}_${row.shiftId}`}>
                    <td>{(currentPage - 1) * REPORTS_PAGE_SIZE + index + 1}</td>
                    <td className="reports-list-table__date-cell">{formatRussianDate(row.date)}</td>
                    <td>
                      <div className="reports-department-cell">
                        <span className="reports-department-cell__title">{row.departmentShortName}</span>
                        {row.departmentName !== row.departmentShortName ? (
                          <span className="reports-department-cell__subtitle">{row.departmentName}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--primary btn--small"
                        onClick={() => handleOpenReport(row)}
                      >
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="ui-empty reports-list-table__empty">Рапорты по выбранным условиям не найдены</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && totalPages > 0 ? (
          <UiPagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={REPORTS_PAGE_SIZE}
            onPageChange={setCurrentPage}
            className="ui-pagination--attached"
            ariaLabel="Пагинация списка рапортов"
          />
        ) : null}

        {errorMessage && pagedContent.length > 0 ? (
          <div className="reports-card__footer-note">{errorMessage}</div>
        ) : null}
      </section>
    </div>
  );
}