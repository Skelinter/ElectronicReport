package com.student.backend.organization.domain.repository;

import com.student.backend.organization.domain.model.Department;
import com.student.backend.organization.domain.projection.DepartmentHierarchyProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface DepartmentRepository extends JpaRepository<Department, UUID> {
    
    List<Department> findAllByParentDepartment_DepartmentIdAndIsActiveTrueOrderByNameAsc(UUID parentDepartmentId);
    
    List<Department> findAllByParentDepartment_DepartmentIdOrderByNameAsc(UUID parentDepartmentId);
    
    List<Department> findAllByHierarchyLevelAndIsActiveOrderByNameAsc(Integer hierarchyLevel, boolean isActive);
    
    boolean existsByParentDepartment_DepartmentIdAndIsActiveTrue(UUID departmentId);
    
    @Query(value = """
        WITH RECURSIVE dept_hierarchy AS (
            -- Базовый запрос: корневые узлы
            SELECT 
                d.department_id AS departmentId,
                d.parent_department_id AS parentDepartmentId,
                d.name AS name,
                d.short_name AS shortName,
                d.hierarchy_level AS hierarchyLevel,
                0 as depth,
                ARRAY[d.department_id] as path,
                d.is_active
            FROM departments d
            WHERE d.parent_department_id IS NULL 
              AND d.is_active = true
            
            UNION ALL
            
            -- Рекурсивный запрос: дочерние узлы
            SELECT 
                d.department_id AS departmentId,
                d.parent_department_id AS parentDepartmentId,
                d.name AS name,
                d.short_name AS shortName,
                d.hierarchy_level AS hierarchyLevel,
                dh.depth + 1 as depth,
                dh.path || d.department_id as path,
                d.is_active
            FROM departments d
            INNER JOIN dept_hierarchy dh ON d.parent_department_id = dh.departmentId
            WHERE d.is_active = true
        )
        SELECT 
            departmentId,
            parentDepartmentId,
            name,
            shortName,
            hierarchyLevel,
            depth,
            path
        FROM dept_hierarchy
        ORDER BY depth ASC, name ASC
        """, nativeQuery = true)
    List<DepartmentHierarchyProjection> findFlatHierarchyWithDepthAndPath();
    
    @Query(value = """
        WITH RECURSIVE dept_hierarchy AS (
            -- Базовый запрос: указанное подразделение
            SELECT 
                d.department_id AS departmentId,
                d.parent_department_id AS parentDepartmentId,
                d.name AS name,
                d.short_name AS shortName,
                d.hierarchy_level AS hierarchyLevel,
                0 as depth,
                ARRAY[d.department_id] as path,
                d.is_active
            FROM departments d
            WHERE d.department_id = :departmentId 
              AND d.is_active = true
            
            UNION ALL
            
            -- Рекурсивный запрос: дочерние узлы
            SELECT 
                d.department_id AS departmentId,
                d.parent_department_id AS parentDepartmentId,
                d.name AS name,
                d.short_name AS shortName,
                d.hierarchy_level AS hierarchyLevel,
                dh.depth + 1 as depth,
                dh.path || d.department_id as path,
                d.is_active
            FROM departments d
            INNER JOIN dept_hierarchy dh ON d.parent_department_id = dh.departmentId
            WHERE d.is_active = true
        )
        SELECT 
            departmentId,
            parentDepartmentId,
            name,
            shortName,
            hierarchyLevel,
            depth,
            path
        FROM dept_hierarchy
        ORDER BY depth ASC, name ASC
        """, nativeQuery = true)
    List<DepartmentHierarchyProjection> findSubtreeHierarchyWithDepthAndPath(@Param("departmentId") UUID departmentId);
}