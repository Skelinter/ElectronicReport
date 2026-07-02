package com.student.backend.report.api;

import com.student.backend.report.application.GetPagedReportPeriodTableUseCase;
import com.student.backend.report.application.GetReportPeriodTableUseCase;
import com.student.backend.report.application.GetShiftReportFormUseCase;
import com.student.backend.report.application.SaveReportValuesUseCase;
import com.student.backend.report.dto.request.SaveReportValuesRequest;
import com.student.backend.report.dto.response.ReportArchiveRowResponse;
import com.student.backend.report.dto.response.ReportPeriodTableResponse;
import com.student.backend.report.dto.response.SaveReportValuesResponse;
import com.student.backend.report.dto.response.ShiftReportFormResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ReportController {

    private final GetShiftReportFormUseCase getShiftReportFormUseCase;
    private final SaveReportValuesUseCase saveReportValuesUseCase;
    private final GetReportPeriodTableUseCase getReportPeriodTableUseCase;
    private final GetPagedReportPeriodTableUseCase getPagedReportPeriodTableUseCase;

    @GetMapping("/api/shifts/{shiftId}/report-form")
    public ShiftReportFormResponse getShiftReportForm(@PathVariable UUID shiftId) {
        return getShiftReportFormUseCase.getByShiftId(shiftId);
    }

    @PutMapping("/api/reports/{reportId}/values")
    public SaveReportValuesResponse saveReportValues(
            @PathVariable UUID reportId,
            @RequestBody SaveReportValuesRequest request
    ) {
        return saveReportValuesUseCase.save(reportId, request);
    }

    @GetMapping("/api/reports/period")
    public ReportPeriodTableResponse getPeriodTable(
            @RequestParam UUID departmentId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo
    ) {
        return getReportPeriodTableUseCase.execute(departmentId, dateFrom, dateTo);
    }

    @GetMapping("/api/reports/paged")
    public Page<ReportArchiveRowResponse> getPagedReports(
            @RequestParam(required = false) UUID departmentId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return getPagedReportPeriodTableUseCase.execute(departmentId, dateFrom, dateTo, search, page, size);
    }
}