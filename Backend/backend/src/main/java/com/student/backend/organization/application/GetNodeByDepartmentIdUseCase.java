package com.student.backend.organization.application;

import com.student.backend.common.exception.BadRequestException;
import com.student.backend.common.exception.NotFoundException;
import com.student.backend.organization.domain.model.Department;
import com.student.backend.organization.domain.repository.DepartmentRepository;
import com.student.backend.organization.dto.response.DepartmentNodeResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GetNodeByDepartmentIdUseCase {

    private final DepartmentRepository departmentRepository;

    public DepartmentNodeResponse execute(UUID departmentId) {
        validate(departmentId);

        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new NotFoundException("Подразделение не найдено"));

        if (!department.isActive()) {
            throw new BadRequestException("Подразделение неактивно");
        }

        boolean hasChildren = departmentRepository.existsByParentDepartment_DepartmentIdAndIsActiveTrue(departmentId);

        return DepartmentNodeResponse.builder()
                .departmentId(department.getDepartmentId())
                .parentDepartmentId(department.getParentDepartment() != null
                        ? department.getParentDepartment().getDepartmentId()
                        : null)
                .name(department.getName())
                .shortName(department.getShortName())
                .hasChildren(hasChildren)
                .build();
    }

    private void validate(UUID departmentId) {
        if (departmentId == null) {
            throw new BadRequestException("departmentId обязателен");
        }
    }
}