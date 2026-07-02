package com.student.backend.report.application;

import com.student.backend.common.exception.BadRequestException;
import com.student.backend.organization.domain.model.Department;
import com.student.backend.report.domain.model.ReportInstance;
import com.student.backend.report.domain.repository.ReportInstanceRepository;
import com.student.backend.report.dto.response.ReportArchiveRowResponse;
import com.student.backend.shift.domain.model.Shift;
import com.student.backend.shift.domain.repository.ShiftRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GetPagedReportPeriodTableUseCase {

    private static final ZoneOffset PROJECT_OFFSET = ZoneOffset.of("+05:00");

    private final ShiftRepository shiftRepository;
    private final ReportInstanceRepository reportInstanceRepository;

    public Page<ReportArchiveRowResponse> execute(
            UUID departmentId,
            LocalDate dateFrom,
            LocalDate dateTo,
            String search,
            int page,
            int size
    ) {
        validate(dateFrom, dateTo);

        OffsetDateTime fromInclusive = dateFrom.atStartOfDay().atOffset(PROJECT_OFFSET);
        OffsetDateTime toExclusive = dateTo.plusDays(1).atStartOfDay().atOffset(PROJECT_OFFSET);

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "startedAt"));

        String searchPattern = (search == null || search.isBlank()) ? "" : search.trim();

        Page<Shift> shiftPage;

        if (departmentId != null) {
            shiftPage = shiftRepository.findByDepartmentAndDateRangeWithSearch(
                    departmentId, fromInclusive, toExclusive, searchPattern, pageable
            );
        } else {
            shiftPage = shiftRepository.findByDateRangeWithSearchAllDepartments(
                    fromInclusive, toExclusive, searchPattern, pageable
            );
        }

        List<Shift> shifts = shiftPage.getContent();

        List<UUID> shiftIds = shifts.stream()
                .map(Shift::getShiftId)
                .collect(Collectors.toList());

        List<ReportInstance> reports = reportInstanceRepository.findAllByShift_ShiftIdIn(shiftIds);
        Map<UUID, ReportInstance> reportByShiftId = reports.stream()
                .collect(Collectors.toMap(
                        r -> r.getShift().getShiftId(),
                        r -> r
                ));

        List<ReportArchiveRowResponse> items = shifts.stream()
                .map(shift -> {
                    Department dept = shift.getDepartment();
                    ReportInstance report = reportByShiftId.get(shift.getShiftId());
                    return ReportArchiveRowResponse.builder()
                            .departmentId(dept.getDepartmentId())
                            .departmentName(dept.getName())
                            .departmentShortName(dept.getShortName())
                            .date(shift.getStartedAt().atZoneSameInstant(PROJECT_OFFSET).toLocalDate())
                            .shiftId(shift.getShiftId())
                            .reportId(report != null ? report.getReportId() : null)
                            .build();
                })
                .collect(Collectors.toList());

        return new PageImpl<>(items, pageable, shiftPage.getTotalElements());
    }

    private void validate(LocalDate dateFrom, LocalDate dateTo) {
        if (dateFrom == null || dateTo == null) {
            throw new BadRequestException("dateFrom и dateTo обязательны");
        }
        if (dateFrom.isAfter(dateTo)) {
            throw new BadRequestException("dateFrom не может быть позже dateTo");
        }
    }
}