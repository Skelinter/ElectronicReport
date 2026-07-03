package com.student.backend.organization.api;

import com.student.backend.organization.application.CreateDepartmentUseCase;
import com.student.backend.organization.application.GetFlatDepartmentHierarchyUseCase;
import com.student.backend.organization.application.GetNodeByDepartmentIdUseCase;
import com.student.backend.organization.dto.request.CreateDepartmentRequest;
import com.student.backend.organization.dto.response.DepartmentNodeResponse;
import com.student.backend.organization.dto.response.FlatDepartmentNodeResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class OrganizationController {

    private final GetNodeByDepartmentIdUseCase getNodeByDepartmentIdUseCase;
    private final GetFlatDepartmentHierarchyUseCase getFlatDepartmentHierarchyUseCase;
    private final CreateDepartmentUseCase createDepartmentUseCase;

    @GetMapping("/api/departments/{departmentId}")
    public DepartmentNodeResponse getDepartment(@PathVariable UUID departmentId) {
        return getNodeByDepartmentIdUseCase.execute(departmentId);
    }

    @GetMapping("/api/departments/hierarchy")
    public List<FlatDepartmentNodeResponse> getFlatDepartmentHierarchy() {
        return getFlatDepartmentHierarchyUseCase.execute();
    }
    
    @PostMapping("/api/departments")
    public UUID createDepartment(@RequestBody CreateDepartmentRequest request) {
        return createDepartmentUseCase.execute(
            request.getName(),
            request.getShortName(),
            request.getParentDepartmentId()
        );
    }
}