package com.student.backend.organization.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DepartmentNodeResponse {
    private UUID departmentId;
    private UUID parentDepartmentId;   // может быть null
    private String name;
    private String shortName;
	private Boolean hasChildren;
}