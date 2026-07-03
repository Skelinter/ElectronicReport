package com.student.backend.organization.application;

import com.student.backend.common.exception.BadRequestException;
import com.student.backend.common.exception.NotFoundException;
import com.student.backend.organization.domain.model.Department;
import com.student.backend.organization.domain.repository.DepartmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CreateDepartmentUseCase {

    private final DepartmentRepository departmentRepository;

    @Transactional
    public UUID execute(String name, String shortName, UUID parentDepartmentId) {
        validateName(name);

        Department parent = null;
        if (parentDepartmentId != null) {
            parent = departmentRepository.findById(parentDepartmentId)
                    .orElseThrow(() -> new NotFoundException("Родительское подразделение не найдено"));
            
            if (!parent.isActive()) {
                throw new BadRequestException("Родительское подразделение неактивно");
            }
        }

        Department department = Department.builder()
                .departmentId(UUID.randomUUID())
                .parentDepartment(parent)
                .hierarchyLevel(parent != null ? parent.getHierarchyLevel() + 1 : 0)
                .name(name.trim())
                .shortName(shortName != null ? shortName.trim() : null)
                .isActive(true)
                .build();

        return departmentRepository.save(department).getDepartmentId();
    }

    private void validateName(String name) {
        if (name == null || name.isBlank()) {
            throw new BadRequestException("Название подразделения обязательно");
        }
    }
}