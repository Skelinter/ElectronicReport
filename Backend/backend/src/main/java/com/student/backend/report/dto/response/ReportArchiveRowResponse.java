package com.student.backend.report.dto.response;

import lombok.Builder;
import lombok.Value;
import java.time.LocalDate;
import java.util.UUID;

@Value
@Builder
public class ReportArchiveRowResponse {
    UUID departmentId;
    String departmentName;
    String departmentShortName;
    LocalDate date;
    UUID shiftId;
    UUID reportId;
}