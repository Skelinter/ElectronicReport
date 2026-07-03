package com.student.backend.organization.application;

import com.student.backend.organization.domain.repository.DepartmentRepository;
import com.student.backend.organization.domain.projection.DepartmentHierarchyProjection;
import com.student.backend.organization.dto.response.FlatDepartmentNodeResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GetFlatDepartmentHierarchyUseCase {

    private final DepartmentRepository departmentRepository;

    @Transactional(readOnly = true)
    public List<FlatDepartmentNodeResponse> execute() {
        return map(departmentRepository.findFlatHierarchyWithDepthAndPath());
    }

    @Transactional(readOnly = true)
    public List<FlatDepartmentNodeResponse> execute(UUID departmentId) {
        return map(departmentRepository.findSubtreeHierarchyWithDepthAndPath(departmentId));
    }

    private List<FlatDepartmentNodeResponse> map(List<DepartmentHierarchyProjection> projections) {
        return projections.stream()
                .map(this::toResponse)
                .toList();
    }

    private FlatDepartmentNodeResponse toResponse(DepartmentHierarchyProjection projection) {
        return FlatDepartmentNodeResponse.builder()
                .departmentId(projection.getDepartmentId())
                .parentDepartmentId(projection.getParentDepartmentId())
                .name(projection.getName())
                .shortName(projection.getShortName())
                .depth(projection.getDepth())
                .path(projection.getPath())
                .build();
    }
}