package com.student.backend.organization.domain.projection;

import java.util.List;
import java.util.UUID;

public interface DepartmentHierarchyProjection {
    UUID getDepartmentId();
    UUID getParentDepartmentId();
    String getName();
    String getShortName();
    Integer getHierarchyLevel();
    Integer getDepth();
    List<UUID> getPath();
}